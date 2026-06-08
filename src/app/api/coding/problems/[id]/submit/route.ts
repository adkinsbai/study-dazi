import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { chatCompletion } from '@/lib/ai';
import { verifyAccessToken } from '@/lib/auth';
import { DEFAULT_PROVIDER } from '@/lib/ai-providers';

const SubmitBodySchema = z.object({
  code: z.string().min(1, '请提交代码'),
  language: z.string().default('python'),
  provider: z.string().optional(),
});

// POST /api/coding/problems/[id]/submit - 提交代码
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const { id: problemId } = await params;
    const body = SubmitBodySchema.parse(await req.json());

    // Check problem exists
    const problem = await prisma.codingProblem.findUnique({
      where: { id: problemId },
    });

    if (!problem) {
      return NextResponse.json({ error: '题目不存在' }, { status: 404 });
    }

    // Save the attempt
    const attempt = await prisma.userCodingAttempt.create({
      data: {
        userId: payload.sub,
        problemId,
        code: body.code,
        language: body.language,
        status: 'pending',
      },
    });

    // Optional: LLM evaluation of code quality
    let feedback: string | null = null;
    let score: number | null = null;
    let status = 'pending';

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

    if (apiKey) {
      try {
        const systemPrompt = `你是一位编程面试评审专家。请评估以下代码提交。

题目：${problem.title}
题目描述：${problem.description}
参考示例：${JSON.stringify(problem.examples)}

用户提交的代码：
语言：${body.language}
\`\`\`${body.language}
${body.code}
\`\`\`

请返回纯 JSON（不要 markdown 代码块）：
{"status": "correct", "score": 85, "feedback": "评价内容"}

其中：
- status: "correct"（正确）、"incorrect"（有错误）、"error"（代码有语法/运行错误）
- score: 0-100 分
- feedback: 简要评价代码质量、算法效率、代码风格等（中文）`;

        const rawResponse = await chatCompletion(provider, apiKey, systemPrompt, '请评估这段代码。', {
          maxTokens: 1000,
          baseUrl,
          temperature: 0.1,
        });

        // Robust JSON extraction
        let parsed: Record<string, unknown>;
        try {
          // Try direct parse first
          parsed = JSON.parse(rawResponse);
        } catch {
          // Try extracting JSON from text
          const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('无法解析评估结果');
          }
        }

        status = String(parsed.status || 'pending');
        score = typeof parsed.score === 'number' ? parsed.score : null;
        feedback = String(parsed.feedback || '');

        // Map LLM status to AttemptStatus enum
        const statusMap: Record<string, string> = {
          correct: 'accepted',
          incorrect: 'wrong_answer',
          error: 'runtime_error',
        };
        const attemptStatus = statusMap[status] || 'pending';

        // Update the attempt with evaluation results
        await prisma.userCodingAttempt.update({
          where: { id: attempt.id },
          data: { status: attemptStatus as 'pending' | 'accepted' | 'wrong_answer' | 'time_limit' | 'runtime_error' | 'compilation_error' },
        });
      } catch (evalErr) {
        // If LLM evaluation fails, still return the attempt
        console.error('[CodingSubmit] LLM evaluation failed:', evalErr);
        feedback = '代码已提交，AI 评估暂时不可用';
      }
    }

    return NextResponse.json({
      attemptId: attempt.id,
      status,
      score,
      feedback,
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
