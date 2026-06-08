import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { FRAMEWORK_PROMPT, FRAMEWORK_PROMPT_WITH_PROFILE } from '@/lib/path-prompts';
import { verifyAccessToken } from '@/lib/auth';
import { DEFAULT_PROVIDER } from '@/lib/ai-providers';
import { sseHeaders, streamJSONGeneration } from '@/lib/stream-json-generation';

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
      const stream = streamJSONGeneration({
        provider,
        apiKey,
        systemPrompt,
        userMessage: userMsg,
        baseUrl,
        initialMaxTokens: maxTokens,
        maxRetries: 2,
        tokenStep: body.materials ? 2500 : 1800,
        label: 'Framework',
        normalize: result => Array.isArray(result) ? { phases: result } : result,
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
