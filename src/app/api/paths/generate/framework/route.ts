import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { chatCompletion, chatCompletionStream } from '@/lib/ai';
import { extractJSON } from '@/lib/extract-json';
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
});

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const body = BodySchema.parse(await req.json());

    const provider = body.provider || DEFAULT_PROVIDER;

    // 从 UserApiKey 表获取 key，回退到旧字段和环境变量
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
    let maxTokens = 1500;

    if (body.userProfile) {
      // 使用用户画像版本的 prompt
      systemPrompt = FRAMEWORK_PROMPT_WITH_PROFILE
        .replace('{userProfile}', body.userProfile)
        .replace('{domain}', body.domain)
        .replace('{hoursPerWeek}', String(body.hours_per_week || '未指定'));
      userMsg = `请根据用户画像生成个性化的学习路径。`;
      maxTokens = 2500; // 用户画像较长，需要更大的 token 限制
    } else {
      // 使用原有的简单 prompt
      systemPrompt = FRAMEWORK_PROMPT;
      userMsg = [
        `领域：${body.domain}`,
        `水平：${body.level}`,
        body.goal && `目标：${body.goal}`,
        body.hours_per_week && `每周投入：${body.hours_per_week}h`,
      ].filter(Boolean).join('\n');
    }

    // 流式模式
    const wantStream = req.headers.get('X-Stream') === 'true';

    if (wantStream) {
      try {
        const aiStream = await chatCompletionStream(provider, apiKey, systemPrompt, userMsg, { maxTokens, baseUrl });
        const reader = aiStream.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let chunkCount = 0;

        const stream = new ReadableStream({
          async pull(controller) {
            const encoder = new TextEncoder();
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                // 解析最终结果，失败时回退到非流式
                try {
                  const result = extractJSON(fullText);
                  const normalized = Array.isArray(result) ? { phases: result } : result;
                  controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ result: normalized })}\n\n`));
                } catch (parseErr) {
                  console.warn('[Framework] extractJSON failed on stream, falling back to non-stream. Raw:', fullText.substring(0, 300));
                  try {
                    const fallback = await chatCompletion(provider, apiKey, systemPrompt, userMsg, { maxTokens, baseUrl });
                    const result = extractJSON(fallback);
                    const normalized = Array.isArray(result) ? { phases: result } : result;
                    controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ result: normalized })}\n\n`));
                  } catch (fallbackErr) {
                    console.error('[Framework] Fallback also failed:', fallbackErr);
                    controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: 'AI 响应解析失败，请重试' })}\n\n`));
                  }
                }
                controller.close();
                return;
              }
              const text = typeof value === 'string' ? value : decoder.decode(value, { stream: true });
              fullText += text;
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
      } catch (streamErr) {
        // 流式初始化失败，回退到非流式
        console.warn('[Framework] Stream init failed, falling back:', streamErr);
      }
    }

    // 非流式模式（原有逻辑）
    const response = await chatCompletion(provider, apiKey, systemPrompt, userMsg, { maxTokens, baseUrl });

    // 调试日志
    console.log('[Framework] AI response length:', response.length);
    console.log('[Framework] AI response (first 500 chars):', response.substring(0, 500));
    console.log('[Framework] AI response (last 500 chars):', response.substring(response.length - 500));

    let result: object;
    try {
      result = extractJSON(response);
    } catch (parseErr) {
      console.error('[Framework] extractJSON failed. Raw response:', response);
      throw parseErr;
    }

    // 防御：AI 可能返回裸数组而非 { phases: [...] }，统一归一化
    const normalized = Array.isArray(result) ? { phases: result } : result;

    return NextResponse.json(normalized);
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
