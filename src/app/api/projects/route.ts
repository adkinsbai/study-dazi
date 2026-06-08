import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { chatCompletion } from '@/lib/ai';
import { extractJSON } from '@/lib/extract-json';
import { GENERATE_PROJECT_PROMPT } from '@/lib/coding-prompts';
import { verifyAccessToken } from '@/lib/auth';
import { DEFAULT_PROVIDER } from '@/lib/ai-providers';

// GET /api/projects - 实战项目列表
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const domain = url.searchParams.get('domain') || undefined;
    const difficulty = url.searchParams.get('difficulty') || undefined;
    const nodeId = url.searchParams.get('nodeId') || undefined;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));

    const where: Record<string, unknown> = {};
    if (domain) where.domain = domain;
    if (difficulty) where.difficulty = difficulty;
    if (nodeId) where.nodeId = nodeId;

    const [items, total] = await Promise.all([
      prisma.projectTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          description: true,
          difficulty: true,
          estimatedHours: true,
          techStack: true,
          domain: true,
          nodeId: true,
          createdAt: true,
          _count: { select: { submissions: true } },
        },
      }),
      prisma.projectTemplate.count({ where }),
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

const GenerateProjectBodySchema = z.object({
  nodeId: z.string().optional(),
  domain: z.string().min(1, '请提供学习领域'),
  nodeName: z.string().min(1, '请提供节点名称'),
  keywords: z.string().optional(),
  provider: z.string().optional(),
});

// POST /api/projects - AI 生成实战项目
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const body = GenerateProjectBodySchema.parse(await req.json());

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

    const systemPrompt = GENERATE_PROJECT_PROMPT
      .replace('{domain}', body.domain)
      .replace('{nodeName}', body.nodeName)
      .replace('{keywords}', body.keywords || '通用');

    const userMsg = `请为「${body.domain} - ${body.nodeName}」设计一个实战项目。`;

    const rawResponse = await chatCompletion(provider, apiKey, systemPrompt, userMsg, {
      maxTokens: 3000,
      baseUrl,
      temperature: 0.3,
    });

    let projectData: Record<string, unknown>;
    try {
      projectData = extractJSON(rawResponse) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'AI 响应解析失败，请重试' }, { status: 500 });
    }

    // Save to database
    const project = await prisma.projectTemplate.create({
      data: {
        title: String(projectData.title || '未命名项目'),
        description: String(projectData.description || ''),
        requirements: Array.isArray(projectData.requirements) ? projectData.requirements : [],
        difficulty: String(projectData.difficulty || 'medium') as 'beginner' | 'intermediate' | 'advanced',
        estimatedHours: typeof projectData.estimatedHours === 'number' ? projectData.estimatedHours : null,
        techStack: Array.isArray(projectData.techStack) ? projectData.techStack : [],
        hints: Array.isArray(projectData.hints) ? projectData.hints : [],
        evaluationCriteria: Array.isArray(projectData.evaluationCriteria) ? projectData.evaluationCriteria : [],
        resources: Array.isArray(projectData.resources) ? projectData.resources : [],
        nodeId: body.nodeId || null,
        domain: body.domain,
        aiGenerated: true,
      },
    });

    return NextResponse.json(project);
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
