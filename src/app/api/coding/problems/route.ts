import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { chatCompletion } from '@/lib/ai';
import { extractJSON } from '@/lib/extract-json';
import { GENERATE_CODING_PROBLEMS_PROMPT } from '@/lib/coding-prompts';
import { verifyAccessToken } from '@/lib/auth';
import { DEFAULT_PROVIDER } from '@/lib/ai-providers';

// GET /api/coding/problems - 分页列表
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const difficulty = url.searchParams.get('difficulty') || undefined;
    const tags = url.searchParams.get('tags') || undefined;
    const source = url.searchParams.get('source') || undefined;
    const domain = url.searchParams.get('domain') || undefined;
    const nodeId = url.searchParams.get('nodeId') || undefined;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));

    const where: Record<string, unknown> = {};
    if (difficulty) where.difficulty = difficulty;
    if (source) where.source = source;
    if (domain) where.domain = domain;
    if (nodeId) where.nodeId = nodeId;
    if (tags) {
      // Filter by tag in JSON array
      where.tags = { array_contains: [tags] };
    }

    const [items, total] = await Promise.all([
      prisma.codingProblem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          difficulty: true,
          tags: true,
          createdAt: true,
        },
      }),
      prisma.codingProblem.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

const GenerateBodySchema = z.object({
  nodeId: z.string().optional(),
  domain: z.string().min(1, '请提供学习领域'),
  nodeName: z.string().min(1, '请提供节点名称'),
  keywords: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  count: z.number().int().min(1).max(10).default(5),
  provider: z.string().optional(),
});

// POST /api/coding/problems - AI 生成编码题
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const body = GenerateBodySchema.parse(await req.json());

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
      return NextResponse.json({ error: '请先在设置中配置 API Key' }, { status: 400 });
    }

    const systemPrompt = GENERATE_CODING_PROBLEMS_PROMPT
      .replace('{domain}', body.domain)
      .replace('{nodeName}', body.nodeName)
      .replace('{keywords}', body.keywords || '通用')
      .replace('{difficulty}', body.difficulty)
      .replace('{count}', String(body.count));

    const userMsg = `请为「${body.domain} - ${body.nodeName}」生成 ${body.count} 道 ${body.difficulty} 难度的编程题。`;

    const rawResponse = await chatCompletion(provider, apiKey, systemPrompt, userMsg, {
      maxTokens: 4000,
      baseUrl,
      temperature: 0.3,
    });

    let problems: unknown[];
    try {
      const parsed = extractJSON(rawResponse);
      problems = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return NextResponse.json({ error: 'AI 响应解析失败，请重试' }, { status: 500 });
    }

    // Save to database
    const created = await Promise.all(
      problems.map((p: unknown) => {
        const item = p as Record<string, unknown>;
        return prisma.codingProblem.create({
          data: {
            title: String(item.title || '未命名题目'),
            description: String(item.description || ''),
            difficulty: String(item.difficulty || body.difficulty) as 'easy' | 'medium' | 'hard',
            tags: Array.isArray(item.tags) ? item.tags : [],
            examples: Array.isArray(item.examples) ? item.examples : [],
            constraints: item.constraints ? String(item.constraints) : null,
            hints: Array.isArray(item.hints) ? item.hints : [],
            solution: item.solution ? String(item.solution) : null,
          },
        });
      })
    );

    return NextResponse.json({ items: created, count: created.length });
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
