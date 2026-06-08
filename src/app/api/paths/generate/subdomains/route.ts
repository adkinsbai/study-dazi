import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { SUBDOMAIN_PROMPT } from '@/lib/path-prompts';
import { verifyAccessToken } from '@/lib/auth';
import { DEFAULT_PROVIDER } from '@/lib/ai-providers';
import { sseHeaders, streamJSONGeneration } from '@/lib/stream-json-generation';

const BodySchema = z.object({
  domain: z.string().min(1, '请输入学习领域'),
  provider: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const body = BodySchema.parse(await req.json());

    const provider = body.provider || DEFAULT_PROVIDER;

    const userApiKey = await prisma.userApiKey.findUnique({
      where: {
        userId_provider: { userId: payload.sub, provider },
      },
    });
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    const apiKey = userApiKey?.apiKey
      || (provider === 'deepseek' ? user?.deepseekApiKey : null)
      || (provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : null);
    const baseUrl = userApiKey?.baseUrl || undefined;

    if (!apiKey) {
      return NextResponse.json({ error: '请先在设置中配置 API Key' }, { status: 400 });
    }

    const systemPrompt = SUBDOMAIN_PROMPT.replace('{domain}', body.domain);
    const userMsg = `请为「${body.domain}」列出细分方向。`;

    const wantStream = req.headers.get('X-Stream') === 'true';

    if (wantStream) {
      const stream = streamJSONGeneration({
        provider,
        apiKey,
        systemPrompt,
        userMessage: userMsg,
        baseUrl,
        initialMaxTokens: 1800,
        maxRetries: 2,
        tokenStep: 1200,
        label: 'Subdomains',
        normalize: result => Array.isArray(result) ? { options: result } : result,
      });

      return new Response(stream, { headers: sseHeaders() });
    }

    return NextResponse.json({ error: '请使用流式模式' }, { status: 400 });
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
