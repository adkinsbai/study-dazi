import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

const QuestionSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  tags: z.array(z.string()).default([]),
  examples: z.array(z.object({
    input: z.string(),
    output: z.string(),
    explanation: z.string().optional(),
  })).default([]),
  constraints: z.string().optional(),
  hints: z.array(z.string()).default([]),
  solution: z.string().optional(),
  language: z.string().default('python'),
});

const ImportBodySchema = z.object({
  company: z.string().min(1, '请提供公司名称'),
  year: z.number().int().min(2000).max(2100),
  position: z.string().min(1, '请提供岗位名称'),
  source: z.enum(['nowcoder', 'leetcode', 'saiding', 'other']).default('other'),
  url: z.string().url().optional(),
  questions: z.array(QuestionSchema).min(1, '至少导入一道题目'),
});

// POST /api/company-tests/import - 导入公司真题
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const body = ImportBodySchema.parse(await req.json());

    // Create company test and associated problems in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the company test
      const companyTest = await tx.companyTest.create({
        data: {
          company: body.company,
          year: body.year,
          position: body.position,
          source: body.source,
          url: body.url || null,
          questionCount: body.questions.length,
        },
      });

      // Create coding problems and link them
      const problems = [];
      for (let i = 0; i < body.questions.length; i++) {
        const q = body.questions[i];
        const problem = await tx.codingProblem.create({
          data: {
            title: q.title,
            description: q.description,
            difficulty: q.difficulty,
            tags: q.tags,
            examples: q.examples,
            constraints: q.constraints || null,
            hints: q.hints,
            solution: q.solution || null,
          },
        });

        // Link problem to company test
        await tx.companyTestProblem.create({
          data: {
            testId: companyTest.id,
            problemId: problem.id,
            order: i,
          },
        });

        problems.push(problem);
      }

      return { companyTest, problems };
    });

    return NextResponse.json({
      id: result.companyTest.id,
      company: result.companyTest.company,
      year: result.companyTest.year,
      position: result.companyTest.position,
      problemCount: result.problems.length,
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
