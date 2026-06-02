import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth';
import { getProviderConfig } from '@/lib/ai-providers';
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

    // 获取 key：优先用请求里的，没有就从数据库查
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

    const config = getProviderConfig(body.provider, baseUrl);
    const format = config.format || 'openai';

    let url: string;
    let headers: Record<string, string>;
    let bodyData: object;

    if (format === 'anthropic') {
      // Anthropic 格式: POST /v1/messages
      url = `${config.baseUrl}/v1/messages`;
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };
      bodyData = {
        model: config.model,
        system: 'Reply with exactly one word: ok',
        messages: [
          { role: 'user', content: 'ping' },
        ],
        temperature: 0,
        max_tokens: 10,
      };
    } else {
      // OpenAI 格式: POST /chat/completions
      url = `${config.baseUrl}/chat/completions`;
      headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };
      bodyData = {
        model: config.model,
        messages: [
          { role: 'system', content: 'Reply with exactly one word: ok' },
          { role: 'user', content: 'ping' },
        ],
        temperature: 0,
        max_tokens: 10,
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyData),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let msg = `HTTP ${res.status}`;
      try {
        const err = JSON.parse(text);
        msg = err.error?.message || err.message || msg;
      } catch {
        if (text) msg = `${msg}: ${text.slice(0, 300)}`;
      }
      return NextResponse.json({ ok: false, error: msg, url, model: config.model });
    }

    const data = await res.json();
    let reply: string;

    if (format === 'anthropic') {
      reply = data.content?.[0]?.text?.trim() || 'ok';
    } else {
      reply = data.choices?.[0]?.message?.content?.trim() || 'ok';
    }

    return NextResponse.json({ ok: true, reply, url, model: config.model });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: '参数错误' }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : '连接失败';
    return NextResponse.json({ ok: false, error: msg });
  }
}
