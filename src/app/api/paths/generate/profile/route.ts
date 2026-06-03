import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth';
import { chatCompletionStream } from '@/lib/ai';
import { PROFILE_PROMPT } from '@/lib/path-prompts';
import prisma from '@/lib/prisma';

const BodySchema = z.object({
  domain: z.string().min(1),
  occupation: z.enum(['student', 'employee', 'freelancer', 'hobby']),
  level: z.enum(['zero', 'beginner', 'intermediate', 'advanced']),
  goal: z.enum(['job', 'exam', 'project', 'improve', 'understand']),
  goalDetail: z.string().optional(),
  hoursPerWeek: z.number().min(1).max(40),
  deadline: z.string().optional(),
  learningStyle: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  provider: z.string().optional(),
});

const OCCUPATION_MAP: Record<string, string> = {
  student: '学生',
  employee: '上班族',
  freelancer: '自由职业/待业',
  hobby: '纯粹兴趣爱好',
};

const LEVEL_MAP: Record<string, string> = {
  zero: '完全没接触过',
  beginner: '看过一些教程/视频，但没怎么动手',
  intermediate: '做过一些小项目/练习',
  advanced: '有完整项目经验',
};

const GOAL_MAP: Record<string, string> = {
  job: '找工作/转行',
  exam: '应付考试/作业',
  project: '做出一个完整的项目',
  improve: '提升专业能力',
  understand: '了解原理就行',
};

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const body = BodySchema.parse(await req.json());

    // 获取用户的 API Key
    const provider = body.provider || 'deepseek';
    const saved = await prisma.userApiKey.findUnique({
      where: { userId_provider: { userId: payload.sub, provider } },
    });

    if (!saved) {
      return NextResponse.json({
        error: `未配置 ${provider} 的 API Key，请先在设置中配置`
      }, { status: 400 });
    }

    // 构建用户信息描述
    const userInfo = {
      occupation: OCCUPATION_MAP[body.occupation] || body.occupation,
      level: LEVEL_MAP[body.level] || body.level,
      goal: GOAL_MAP[body.goal] || body.goal,
      goalDetail: body.goalDetail || '未提供',
      hoursPerWeek: body.hoursPerWeek,
      deadline: body.deadline || '未设定',
      learningStyle: body.learningStyle?.length ? body.learningStyle : ['未指定'],
      interests: body.interests?.length ? body.interests : ['未指定'],
    };

    // 获取当前时间
    const now = new Date();
    const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 构建 user message
    const userMsg = `学习领域：${body.domain}
当前日期：${currentDate}

用户信息：
- 当前身份：${userInfo.occupation}
- 当前水平：${userInfo.level}
- 学习目标：${userInfo.goal}
- 目标详情：${userInfo.goalDetail}
- 每周时间：${userInfo.hoursPerWeek}小时
- 学习期限：${userInfo.deadline}
- 学习风格：${userInfo.learningStyle.join('、')}
- 感兴趣方向：${userInfo.interests.join('、')}`;

    // 调用 AI 生成用户画像
    console.log('[Profile] 开始生成用户画像...', { provider, domain: body.domain });

    const wantStream = req.headers.get('X-Stream') === 'true';

    if (wantStream) {
      const aiStream = await chatCompletionStream(provider, saved.apiKey, PROFILE_PROMPT, userMsg, { baseUrl: saved.baseUrl || undefined });
      const reader = aiStream.getReader();
      let fullText = '';
      let chunkCount = 0;

      const stream = new ReadableStream({
        async pull(controller) {
          const encoder = new TextEncoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log('[Profile] Stream done. Chunks:', chunkCount, 'Length:', fullText.length);
              controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ result: { profile: fullText.trim() } })}\n\n`));
              controller.close();
              return;
            }
            fullText += String(value);
            chunkCount++;
            controller.enqueue(
              encoder.encode(`event: progress\ndata: ${JSON.stringify({ chunks: chunkCount })}\n\n`)
            );
          }
        },
        cancel() {
          reader.cancel();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    return NextResponse.json({ error: '请使用流式模式' }, { status: 400 });
  } catch (err) {
    console.error('[Profile] 生成失败:', err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: '参数错误', details: err.issues }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : '生成失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
