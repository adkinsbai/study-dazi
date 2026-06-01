import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth';
import { chatCompletion } from '@/lib/ai';
import prisma from '@/lib/prisma';

const BodySchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const body = BodySchema.parse(await req.json());

    // 如果请求没带 key，从数据库读取已保存的
    let apiKey = body.apiKey;
    let baseUrl = body.baseUrl;
    if (!apiKey) {
      const saved = await prisma.userApiKey.findUnique({
        where: { userId_provider: { userId: payload.sub, provider: body.provider } },
      });
      if (!saved) {
        return NextResponse.json({ ok: false, error: '未配置该模型的 API Key' }, { status: 200 });
      }
      apiKey = saved.apiKey;
      if (!baseUrl && saved.baseUrl) baseUrl = saved.baseUrl;
    }

    const reply = await chatCompletion(
      body.provider,
      apiKey,
      'Reply with exactly one word: ok',
      'ping',
      { temperature: 0, maxTokens: 10, baseUrl }
    );

    return NextResponse.json({ ok: true, reply: reply.trim() });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: '参数错误' }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : '连接失败';
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
