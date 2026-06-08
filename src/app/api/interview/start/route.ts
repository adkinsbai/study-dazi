import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { chatCompletion } from '@/lib/ai';
import { extractJSON } from '@/lib/extract-json';
import { INTERVIEW_SYSTEM_PROMPT } from '@/lib/interview-prompts';
import { verifyAccessToken } from '@/lib/auth';
import { DEFAULT_PROVIDER } from '@/lib/ai-providers';

// POST /api/interview/start - 开始模拟面试
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const body = z.object({
      domain: z.string().min(1),
      position: z.string().min(1),
      pathId: z.string().optional(),
      round: z.enum(['general', 'technical', 'behavioral', 'system_design']).default('technical'),
      language: z.enum(['zh', 'en']).default('zh'),
      difficulty: z.number().int().min(1).max(5).default(3),
      provider: z.string().optional(),
    }).parse(await req.json());

    const provider = body.provider || DEFAULT_PROVIDER;

    // 获取 API Key
    const userApiKey = await prisma.userApiKey.findUnique({
      where: { userId_provider: { userId: payload.sub, provider } },
    });
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    const apiKey = userApiKey?.apiKey
      || (provider === 'deepseek' ? user?.deepseekApiKey : null)
      || (provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : null);
    const baseUrl = userApiKey?.baseUrl || undefined;

    if (!apiKey) {
      return NextResponse.json({ error: '请先在设置中配置 API Key' }, { status: 400 });
    }

    // 生成面试开场白
    const systemPrompt = INTERVIEW_SYSTEM_PROMPT
      .replace(/\{domain\}/g, body.domain)
      .replace(/\{position\}/g, body.position)
      .replace(/\{round\}/g, body.round)
      .replace(/\{difficulty\}/g, String(body.difficulty))
      .replace(/\{language\}/g, body.language);

    const greeting = await chatCompletion(provider, apiKey, systemPrompt, '请开始面试。', {
      maxTokens: 500,
      baseUrl,
      temperature: 0.7,
    });

    // 创建面试会话
    const session = await prisma.interviewSession.create({
      data: {
        userId: payload.sub,
        pathId: body.pathId || null,
        domain: body.domain,
        position: body.position,
        round: body.round,
        language: body.language,
        difficulty: body.difficulty,
        status: 'in_progress',
      },
    });

    // 保存第一个问题（面试官开场）
    await prisma.interviewQuestion.create({
      data: {
        sessionId: session.id,
        order: 1,
        question: greeting,
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      greeting,
      round: body.round,
      difficulty: body.difficulty,
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
