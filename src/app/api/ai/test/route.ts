import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth';
import { chatCompletion } from '@/lib/ai';

const BodySchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().min(1),
  baseUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    await verifyAccessToken(auth);
    const body = BodySchema.parse(await req.json());

    // 发一个最简单的请求测试连通性
    const reply = await chatCompletion(
      body.provider,
      body.apiKey,
      'Reply with exactly one word: ok',
      'ping',
      { temperature: 0, maxTokens: 10, baseUrl: body.baseUrl }
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
