import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { chatWithDeepSeek } from '@/lib/deepseek';
import { extractJSON } from '@/lib/extract-json';
import { NODES_PROMPT } from '@/lib/path-prompts';
import { verifyAccessToken } from '@/lib/auth';

const BodySchema = z.object({
  domain: z.string().min(1),
  phases_json: z.string(),
  phase_id: z.string().min(1),
  phase_title: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    const apiKey = user?.deepseekApiKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: '请先在设置中配置 DeepSeek API Key，或设置服务端 DEEPSEEK_API_KEY 环境变量' }, { status: 400 });
    }

    const body = BodySchema.parse(await req.json());

    const userMsg = [
      `领域：${body.domain}`,
      `已确认的完整一级框架：`,
      body.phases_json,
      `当前要展开的阶段：${body.phase_id} — ${body.phase_title}`,
    ].join('\n');

    const response = await chatWithDeepSeek(apiKey, NODES_PROMPT, userMsg, { maxTokens: 700 });
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
