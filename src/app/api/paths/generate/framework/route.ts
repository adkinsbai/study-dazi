import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { chatCompletion } from '@/lib/ai';
import { extractJSON } from '@/lib/extract-json';
import { FRAMEWORK_PROMPT } from '@/lib/path-prompts';
import { verifyAccessToken } from '@/lib/auth';
import { DEFAULT_PROVIDER } from '@/lib/ai-providers';

const BodySchema = z.object({
  domain: z.string().min(1, '请输入想学的领域'),
  level: z.enum(['零基础', '有基础', '进阶']),
  goal: z.string().optional(),
  hours_per_week: z.number().optional(),
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

    if (!apiKey) {
      return NextResponse.json({ error: `请先在设置中配置 API Key` }, { status: 400 });
    }

    const userMsg = [
      `领域：${body.domain}`,
      `水平：${body.level}`,
      body.goal && `目标：${body.goal}`,
      body.hours_per_week && `每周投入：${body.hours_per_week}h`,
    ].filter(Boolean).join('\n');

    const response = await chatCompletion(provider, apiKey, FRAMEWORK_PROMPT, userMsg, { maxTokens: 1500 });
    let result: object;
    try {
      result = extractJSON(response);
    } catch (parseErr) {
      console.error('[Framework] extractJSON failed. Raw response (last 300 chars):',
        response.slice(-300));
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
