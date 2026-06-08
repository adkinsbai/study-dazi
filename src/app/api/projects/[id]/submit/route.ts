import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { chatCompletion } from '@/lib/ai';
import { extractJSON } from '@/lib/extract-json';
import { EVALUATE_PROJECT_PROMPT } from '@/lib/coding-prompts';
import { verifyAccessToken } from '@/lib/auth';
import { DEFAULT_PROVIDER } from '@/lib/ai-providers';

const SubmitBodySchema = z.object({
  content: z.string().min(10, '提交内容至少 10 个字符'),
  repoUrl: z.string().url().optional(),
  demoUrl: z.string().url().optional(),
  provider: z.string().optional(),
});

// POST /api/projects/[id]/submit - 提交项目
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const body = SubmitBodySchema.parse(await req.json());

    // 获取项目信息
    const project = await prisma.projectTemplate.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    const provider = body.provider || DEFAULT_PROVIDER;

    // 获取 API Key
    const userApiKey = await prisma.userApiKey.findUnique({
      where: { userId_provider: { userId: payload.sub, provider } },
    });
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    const apiKey = userApiKey?.apiKey
      || (provider === 'deepseek' ? user?.deepseekApiKey : null)
      || (provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : null);
    const baseUrl = userApiKey?.baseUrl || undefined;

    let evaluation: Record<string, unknown> | null = null;
    let score: number | null = null;
    let feedback: string | null = null;

    // 尝试 AI 评估
    if (apiKey) {
      try {
        const requirements = Array.isArray(project.requirements)
          ? (project.requirements as string[]).map((r, i) => `${i + 1}. ${r}`).join('\n')
          : '';

        const criteria = Array.isArray(project.evaluationCriteria)
          ? (project.evaluationCriteria as Array<Record<string, unknown>>)
              .map(c => `- ${c.criterion}（权重: ${c.weight}）: ${c.description}`)
              .join('\n')
          : '';

        const systemPrompt = EVALUATE_PROJECT_PROMPT
          .replace('{projectTitle}', project.title)
          .replace('{requirements}', requirements)
          .replace('{evaluationCriteria}', criteria)
          .replace('{userContent}', body.content);

        const rawResponse = await chatCompletion(provider, apiKey, systemPrompt, '请评估这个项目提交。', {
          maxTokens: 2000,
          baseUrl,
          temperature: 0.2,
        });

        evaluation = extractJSON(rawResponse) as Record<string, unknown>;
        score = typeof evaluation.score === 'number' ? evaluation.score : null;
        feedback = typeof evaluation.feedback === 'string' ? evaluation.feedback : null;
      } catch {
        // AI 评估失败，不阻塞提交
      }
    }

    // 保存提交
    const submission = await prisma.projectSubmission.create({
      data: {
        userId: payload.sub,
        projectId: id,
        content: body.content,
        repoUrl: body.repoUrl || null,
        demoUrl: body.demoUrl || null,
        score,
        feedback,
        aiEvaluation: evaluation ? JSON.parse(JSON.stringify(evaluation)) : undefined,
        status: evaluation ? 'reviewed' : 'submitted',
        reviewedAt: evaluation ? new Date() : null,
      },
    });

    return NextResponse.json({
      submissionId: submission.id,
      status: submission.status,
      score,
      feedback,
      evaluation: evaluation ? {
        criteriaScores: evaluation.criteriaScores,
      } : null,
    });
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
