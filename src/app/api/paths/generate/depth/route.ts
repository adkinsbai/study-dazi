import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { chatCompletionStream } from '@/lib/ai';
import { extractJSON, isTruncatedJSON } from '@/lib/extract-json';
import { DEPTH_PROMPT } from '@/lib/path-prompts';
import { verifyAccessToken } from '@/lib/auth';
import { DEFAULT_PROVIDER } from '@/lib/ai-providers';

const BodySchema = z.object({
  domain: z.string().min(1),
  subdomain: z.string().min(1),
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

    const systemPrompt = DEPTH_PROMPT
      .replace('{domain}', body.domain)
      .replace('{subdomain}', body.subdomain);
    const userMsg = `领域「${body.domain}」方向「${body.subdomain}」，请生成深度追问。`;

    const wantStream = req.headers.get('X-Stream') === 'true';

    if (wantStream) {
      const stream = new ReadableStream({
        async pull(controller) {
          const encoder = new TextEncoder();
          let fullText = '';
          let chunkCount = 0;

          const aiStream = await chatCompletionStream(provider, apiKey, systemPrompt, userMsg, {
            maxTokens: 1500,
            baseUrl,
          });
          const reader = aiStream.getReader();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              fullText += String(value);
              chunkCount++;
              controller.enqueue(
                encoder.encode(`event: progress\ndata: ${JSON.stringify({ chunks: chunkCount })}\n\n`)
              );
            }
          } catch (e) {
            reader.cancel();
            throw e;
          }

          try {
            const result = extractJSON(fullText);
            const normalized = Array.isArray(result) ? { questions: result } : result;
            controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ result: normalized })}\n\n`));
            controller.close();
            return;
          } catch {
            if (isTruncatedJSON(fullText)) {
              controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: 'AI 响应被截断，请重试' })}\n\n`));
            } else {
              controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: 'AI 响应解析失败，请重试' })}\n\n`));
            }
            controller.close();
          }
        },
        cancel() {},
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
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: '参数错误', details: err.issues }, { status: 422 });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
