import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { chatCompletion } from '@/lib/ai';
import { extractJSON } from '@/lib/extract-json';
import { DAILY_REVIEW_PROMPT } from '@/lib/test-prompts';
import { authenticate } from '@/lib/auth';
import { DEFAULT_PROVIDER } from '@/lib/ai-providers';

const BodySchema = z.object({
  pathId: z.string().optional(),
  count: z.number().int().min(1).max(20).default(10),
  provider: z.string().optional(),
});

/** 安全解析 LLM 返回的 JSON 数组 */
function parseQuestionsFromLLM(raw: string): any[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key])) return parsed[key];
      }
    }
  } catch { /* continue */ }

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
      try { return JSON.parse(raw.slice(start, end + 1)); } catch { /* continue */ }
    }
  }

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

    // 1. 获取已完成的节点
    const completedProgress = await prisma.userNodeProgress.findMany({
      where: {
        userId: auth.sub,
        status: 'completed',
        ...(body.pathId ? { pathId: body.pathId } : {}),
      },
      take: 20,
      orderBy: { completedAt: 'desc' },
    });

    // 2. 获取最近的错误题目
    const recentErrors = await prisma.userAnswer.findMany({
      where: {
        userId: auth.sub,
        isCorrect: false,
      },
      include: {
        question: {
          select: {
            id: true,
            title: true,
            domain: true,
            nodeId: true,
            tags: true,
            type: true,
          },
        },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    // 3. 分析薄弱知识点
    const allWrongAnswers = await prisma.userAnswer.findMany({
      where: { userId: auth.sub, isCorrect: false },
      include: { question: { select: { tags: true, domain: true, nodeId: true } } },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    // 统计错误频次
    const tagCounts: Record<string, number> = {};
    const nodeCounts: Record<string, number> = {};
    for (const ans of allWrongAnswers) {
      const tags = (ans.question.tags as string[]) || [];
      for (const tag of tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
      if (ans.question.nodeId) {
        nodeCounts[ans.question.nodeId] = (nodeCounts[ans.question.nodeId] || 0) + 1;
      }
    }

    const weakTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => `${tag}(${count}次错误)`);

    // 构建 prompt 参数
    const completedNodesStr = completedProgress.length > 0
      ? completedProgress.map((p) => `- ${p.nodeId} (路径: ${p.pathId})`).join('\n')
      : '暂无已完成节点';

    const recentErrorsStr = recentErrors.length > 0
      ? recentErrors.map((a) => `- [${a.question.domain}] ${a.question.title} (${a.question.type})`).join('\n')
      : '暂无错误记录';

    const weakPointsStr = weakTags.length > 0
      ? weakTags.join('、')
      : '暂无明显薄弱点';

    const systemPrompt = DAILY_REVIEW_PROMPT
      .replace('{completedNodes}', completedNodesStr)
      .replace('{recentErrors}', recentErrorsStr)
      .replace('{weakPoints}', weakPointsStr)
      .replace('{count}', String(body.count));

    const userMsg = `请生成 ${body.count} 道每日复习题。`;

    // 调用 LLM
    const rawResponse = await chatCompletion(provider, apiKey, systemPrompt, userMsg, {
      temperature: 0.3,
      maxTokens: 4096,
      baseUrl,
    });

    // 解析题目
    const questions = parseQuestionsFromLLM(rawResponse);

    // 获取用户的第一个学习路径作为默认路径
    let defaultPathId = body.pathId;
    if (!defaultPathId) {
      const firstPath = await prisma.learningPath.findFirst({
        where: { userId: auth.sub },
        orderBy: { createdAt: 'desc' },
      });
      defaultPathId = firstPath?.id || undefined;
    }

    // 保存题目到 QuestionBank 并创建 TestSession
    const savedQuestions = await prisma.$transaction(async (tx) => {
      const saved: any[] = [];
      for (const q of questions) {
        const questionType = q.type || 'single_choice';
        const content = q.content || { stem: q.title, options: q.options };
        const answerStr = typeof q.answer === 'string' ? q.answer : JSON.stringify(q.answer);

        const record = await tx.questionBank.create({
          data: {
            pathId: q.pathId || defaultPathId,
            nodeId: q.nodeId || null,
            domain: q.domain || '综合复习',
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
        pathId: defaultPathId,
        type: 'review',
        title: `每日复习 - ${new Date().toLocaleDateString('zh-CN')}`,
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
      weakPoints: weakTags,
      recentErrorCount: recentErrors.length,
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
