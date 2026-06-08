import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { chatCompletion } from '@/lib/ai';
import { extractJSON } from '@/lib/extract-json';
import { GENERATE_QUESTIONS_PROMPT } from '@/lib/test-prompts';
import { authenticate } from '@/lib/auth';
import { DEFAULT_PROVIDER } from '@/lib/ai-providers';

const BodySchema = z.object({
  pathId: z.string().min(1, '请选择学习路径'),
  nodeId: z.string().min(1, '请选择学习节点'),
  count: z.number().int().min(1).max(20).default(10),
  typeDistribution: z
    .object({
      singleChoice: z.number().int().min(0).optional(),
      multiChoice: z.number().int().min(0).optional(),
      fillBlank: z.number().int().min(0).optional(),
      shortAnswer: z.number().int().min(0).optional(),
    })
    .optional(),
  provider: z.string().optional(),
});

/** 从 treeData 中递归查找节点 */
function findNode(treeData: any, nodeId: string): any {
  if (!treeData) return null;
  if (treeData.id === nodeId) return treeData;
  if (treeData.children) {
    for (const child of treeData.children) {
      const found = findNode(child, nodeId);
      if (found) return found;
    }
  }
  if (Array.isArray(treeData)) {
    for (const item of treeData) {
      const found = findNode(item, nodeId);
      if (found) return found;
    }
  }
  return null;
}

/** 安全解析 LLM 返回的 JSON 数组 */
function parseQuestionsFromLLM(raw: string): any[] {
  // 尝试直接解析
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    // 如果是对象且包含数组属性
    if (parsed && typeof parsed === 'object') {
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key])) return parsed[key];
      }
    }
  } catch { /* continue */ }

  // 尝试从 markdown code block 提取
  const match = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') {
        for (const key of Object.keys(parsed)) {
          if (Array.isArray(parsed[key])) return parsed[key];
        }
      }
    } catch { /* continue */ }
  }

  // 尝试找到数组的起止位置
  const start = raw.indexOf('[');
  if (start !== -1) {
    let depth = 0;
    let end = -1;
    for (let i = start; i < raw.length; i++) {
      if (raw[i] === '[') depth++;
      else if (raw[i] === ']') depth--;
      if (depth === 0) { end = i; break; }
    }
    if (end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch { /* continue */ }
    }
  }

  // 使用通用 extractJSON
  try {
    const result = extractJSON(raw);
    if (Array.isArray(result)) return result;
    if (result && typeof result === 'object') {
      for (const key of Object.keys(result as any)) {
        if (Array.isArray((result as any)[key])) return (result as any)[key];
      }
    }
  } catch { /* continue */ }

  throw new Error('AI 返回了无法解析的题目数据，请重试');
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if (auth instanceof NextResponse) return auth;

    const body = BodySchema.parse(await req.json());

    // 获取学习路径
    const path = await prisma.learningPath.findFirst({
      where: { id: body.pathId, userId: auth.sub },
    });
    if (!path) {
      return NextResponse.json({ error: '学习路径不存在' }, { status: 404 });
    }

    // 从 treeData 中查找节点
    const node = findNode(path.treeData, body.nodeId);
    if (!node) {
      return NextResponse.json({ error: '学习节点不存在' }, { status: 404 });
    }

    // 获取 API Key
    const provider = body.provider || DEFAULT_PROVIDER;
    const userApiKey = await prisma.userApiKey.findUnique({
      where: { userId_provider: { userId: auth.sub, provider } },
    });
    const user = await prisma.user.findUnique({ where: { id: auth.sub } });
    const apiKey =
      userApiKey?.apiKey ||
      (provider === 'deepseek' ? user?.deepseekApiKey : null) ||
      (provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : null);
    const baseUrl = userApiKey?.baseUrl || undefined;

    if (!apiKey) {
      return NextResponse.json({ error: '请先在设置中配置 API Key' }, { status: 400 });
    }

    // 构建题型分布描述
    const dist = body.typeDistribution;
    const typeDistStr = dist
      ? `单选题 ${dist.singleChoice ?? 0} 道，多选题 ${dist.multiChoice ?? 0} 道，填空题 ${dist.fillBlank ?? 0} 道，简答题 ${dist.shortAnswer ?? 0} 道`
      : `单选题约 ${Math.ceil(body.count * 0.4)} 道，多选题约 ${Math.ceil(body.count * 0.2)} 道，填空题约 ${Math.ceil(body.count * 0.2)} 道，简答题约 ${Math.ceil(body.count * 0.2)} 道`;

    // 构建 prompt
    const keywords = Array.isArray(node.keywords) ? node.keywords.join('、') : (node.keywords || '');
    const systemPrompt = GENERATE_QUESTIONS_PROMPT
      .replace('{domain}', path.domain)
      .replace('{nodeName}', node.title || node.name || '')
      .replace('{nodeDesc}', node.description || node.desc || '')
      .replace('{keywords}', keywords)
      .replace('{difficulty}', '中等')
      .replace('{count}', String(body.count))
      .replace('{typeDistribution}', typeDistStr);

    const userMsg = `请为「${node.title || node.name}」节点生成 ${body.count} 道测试题。`;

    // 调用 LLM
    const rawResponse = await chatCompletion(provider, apiKey, systemPrompt, userMsg, {
      temperature: 0.3,
      maxTokens: 4096,
      baseUrl,
    });

    // 解析题目
    const questions = parseQuestionsFromLLM(rawResponse);

    // 保存题目到 QuestionBank 并创建 TestSession
    const savedQuestions = await prisma.$transaction(async (tx) => {
      const saved: any[] = [];
      for (const q of questions) {
        const questionType = q.type || 'single_choice';
        const content = q.content || { stem: q.title, options: q.options };
        const answerStr = typeof q.answer === 'string' ? q.answer : JSON.stringify(q.answer);

        const record = await tx.questionBank.create({
          data: {
            pathId: body.pathId,
            nodeId: body.nodeId,
            domain: path.domain,
            type: questionType as any,
            difficulty: typeof q.difficulty === 'number' ? q.difficulty : 3,
            title: q.title || '未命名题目',
            content: content,
            answer: answerStr,
            explanation: q.explanation || null,
            tags: q.tags || [],
            source: 'ai',
            aiGenerated: true,
          },
        });
        saved.push(record);
      }
      return saved;
    });

    // 创建测试会话
    const session = await prisma.testSession.create({
      data: {
        userId: auth.sub,
        pathId: body.pathId,
        nodeId: body.nodeId,
        type: 'test',
        title: `${node.title || node.name} - 测试`,
        totalQuestions: savedQuestions.length,
        status: 'in_progress',
      },
    });

    // 创建 TestSessionQuestion 关联
    for (let i = 0; i < savedQuestions.length; i++) {
      await prisma.testSessionQuestion.create({
        data: {
          sessionId: session.id,
          questionId: savedQuestions[i].id,
          order: i + 1,
        },
      });
    }

    // 返回题目（不含答案）
    const questionsForClient = savedQuestions.map((q) => ({
      id: q.id,
      type: q.type,
      difficulty: q.difficulty,
      title: q.title,
      content: q.content,
      tags: q.tags,
    }));

    return NextResponse.json({
      sessionId: session.id,
      questions: questionsForClient,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: '参数错误', details: err.issues }, { status: 422 });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
