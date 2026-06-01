import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { chatCompletion } from '@/lib/ai';
import { extractJSON } from '@/lib/extract-json';
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

    const userMsg = [
      `领域：${body.domain}`,
      `已确认的完整一级框架：`,
      body.phases_json,
      `当前要展开的阶段：${body.phase_id} — ${body.phase_title}`,
    ].join('\n');

    const response = await chatCompletion(provider, apiKey, NODES_PROMPT, userMsg, { maxTokens: 1200, baseUrl });
    let result: object;
    try {
      result = extractJSON(response);
    } catch (parseErr) {
      console.error('[Nodes] extractJSON failed. Raw response (last 300 chars):',
        response.slice(-300));
      throw parseErr;
    }

    // 防御：AI 可能返回裸数组而非 { nodes: [...] }，统一归一化
    const normalized = Array.isArray(result) ? { nodes: result } : result;

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
