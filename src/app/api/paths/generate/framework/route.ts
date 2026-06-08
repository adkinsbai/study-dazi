import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { chatCompletionStream } from '@/lib/ai';
import { extractJSON, isTruncatedJSON } from '@/lib/extract-json';
import { FRAMEWORK_PROMPT, FRAMEWORK_PROMPT_WITH_PROFILE } from '@/lib/path-prompts';
import { verifyAccessToken } from '@/lib/auth';
import { DEFAULT_PROVIDER } from '@/lib/ai-providers';

const BodySchema = z.object({
  domain: z.string().min(1, '请输入想学的领域'),
  level: z.enum(['零基础', '有基础', '进阶']),
  goal: z.string().optional(),
  hours_per_week: z.number().optional(),
  provider: z.string().optional(),
  userProfile: z.string().optional(),
  materials: z.string().optional(),
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

    let systemPrompt: string;
    let userMsg: string;
    let maxTokens = 2000;

    if (body.userProfile) {
      systemPrompt = FRAMEWORK_PROMPT_WITH_PROFILE
        .replace('{userProfile}', body.userProfile)
        .replace('{domain}', body.domain)
        .replace('{hoursPerWeek}', String(body.hours_per_week || '未指定'));
      userMsg = `请根据用户画像生成个性化的学习路径。`;
      maxTokens = 2500;
    } else {
      systemPrompt = FRAMEWORK_PROMPT;
      userMsg = [
        `领域：${body.domain}`,
        `水平：${body.level}`,
        body.goal && `目标：${body.goal}`,
        body.hours_per_week && `每周投入：${body.hours_per_week}h`,
      ].filter(Boolean).join('\n');
    }

    // 如果有上传的学习资料，追加到用户消息中
    if (body.materials) {
      userMsg += `\n\n以下是我的学习资料，请参考这些内容来设计学习路径：\n\n${body.materials}`;
      maxTokens = 3500; // 资料较长，需要更多输出空间
    }

    const wantStream = req.headers.get('X-Stream') === 'true';

    if (wantStream) {
      const MAX_RETRIES = 1;
      let attempt = 0;
      let currentMaxTokens = maxTokens;

      const stream = new ReadableStream({
        async pull(controller) {
          const encoder = new TextEncoder();

          // 首次或重试时创建新的 AI 流
          if (attempt === 0 || (attempt <= MAX_RETRIES)) {
            attempt++;
            let fullText = '';
            let chunkCount = 0;

            const aiStream = await chatCompletionStream(provider, apiKey, systemPrompt, userMsg, { maxTokens: currentMaxTokens, baseUrl });
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

            console.log(`[Framework] Attempt ${attempt} done. Chunks: ${chunkCount}, Length: ${fullText.length}`);

            // 尝试解析
            try {
              const result = extractJSON(fullText);
              const normalized = Array.isArray(result) ? { phases: result } : result;
              controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ result: normalized })}\n\n`));
              controller.close();
              return;
            } catch {
              // 检测是否截断，且还有重试机会
              if (isTruncatedJSON(fullText) && attempt <= MAX_RETRIES) {
                console.warn(`[Framework] Truncated JSON detected, retrying with higher max_tokens (${currentMaxTokens} -> ${currentMaxTokens + 1500})`);
                currentMaxTokens += 1500;
                controller.enqueue(encoder.encode(`event: retry\ndata: ${JSON.stringify({ attempt, maxTokens: currentMaxTokens })}\n\n`));
                // pull 会被再次调用，进入下一次循环
                return;
              }
              // 非截断错误或重试用尽
              console.error('[Framework] extractJSON failed. Text length:', fullText.length);
              console.error('[Framework] Raw text (first 500):', fullText.substring(0, 500));
              console.error('[Framework] Raw text (last 500):', fullText.substring(Math.max(0, fullText.length - 500)));
              controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: 'AI 响应解析失败，请重试' })}\n\n`));
              controller.close();
              return;
            }
          }

          // 不应该到这里
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
