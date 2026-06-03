import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { chatCompletionStream } from '@/lib/ai';
import { extractJSON, isTruncatedJSON } from '@/lib/extract-json';
import { NODES_PROMPT } from '@/lib/path-prompts';
import { verifyAccessToken } from '@/lib/auth';
import { DEFAULT_PROVIDER } from '@/lib/ai-providers';

const BodySchema = z.object({
  domain: z.string().min(1),
  phases_json: z.string(),
  phase_id: z.string().min(1),
  phase_title: z.string().min(1),
  provider: z.string().optional(),
});

const STOP = ['\n\n'];

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
      const MAX_RETRIES = 1;
      let attempt = 0;
      let currentMaxTokens = 1800;

      const stream = new ReadableStream({
        async pull(controller) {
          const encoder = new TextEncoder();

          if (attempt === 0 || (attempt <= MAX_RETRIES)) {
            attempt++;
            let fullText = '';
            let chunkCount = 0;

            const aiStream = await chatCompletionStream(provider, apiKey, NODES_PROMPT, userMsg, { maxTokens: currentMaxTokens, baseUrl, stop: STOP });
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

            console.log(`[Nodes] Attempt ${attempt} done. Chunks: ${chunkCount}, Length: ${fullText.length}`);

            try {
              const result = extractJSON(fullText);
              const normalized = Array.isArray(result) ? { nodes: result } : result;
              controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ result: normalized })}\n\n`));
              controller.close();
              return;
            } catch (parseErr) {
              if (isTruncatedJSON(fullText) && attempt <= MAX_RETRIES) {
                console.warn(`[Nodes] Truncated JSON, retrying (${currentMaxTokens} -> ${currentMaxTokens + 1500})`);
                currentMaxTokens += 1500;
                controller.enqueue(encoder.encode(`event: retry\ndata: ${JSON.stringify({ attempt, maxTokens: currentMaxTokens })}\n\n`));
                return;
              }
              console.error('[Nodes] extractJSON failed. Text length:', fullText.length);
              console.error('[Nodes] Raw text (first 500):', fullText.substring(0, 500));
              console.error('[Nodes] Raw text (last 500):', fullText.substring(Math.max(0, fullText.length - 500)));
              controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: 'AI 响应解析失败，请重试' })}\n\n`));
              controller.close();
              return;
            }
          }

          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: '重试次数用尽' })}\n\n`));
          controller.close();
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
