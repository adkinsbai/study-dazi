import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { NODES_PROMPT } from '@/lib/path-prompts';
import { verifyAccessToken } from '@/lib/auth';
import { DEFAULT_PROVIDER } from '@/lib/ai-providers';
import { sseHeaders, streamJSONGeneration } from '@/lib/stream-json-generation';

const BodySchema = z.object({
  domain: z.string().min(1),
  phases_json: z.string(),
  phase_id: z.string().min(1),
  phase_title: z.string().min(1),
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
      return NextResponse.json({ error: `请先在设置中配置 API Key` }, { status: 400 });
    }

    const userMsg = [
      `领域：${body.domain}`,
      `已确认的完整一级框架：`,
      body.phases_json,
      `当前要展开的阶段：${body.phase_id} — ${body.phase_title}`,
    ].join('\n');

    const wantStream = req.headers.get('X-Stream') === 'true';

    if (wantStream) {
      const stream = streamJSONGeneration({
        provider,
        apiKey,
        systemPrompt: NODES_PROMPT.replace('{domain}', body.domain),
        userMessage: userMsg,
        baseUrl,
        initialMaxTokens: 2200,
        maxRetries: 2,
        tokenStep: 1600,
        label: 'Nodes',
        normalize: result => Array.isArray(result) ? { nodes: result } : result,
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
