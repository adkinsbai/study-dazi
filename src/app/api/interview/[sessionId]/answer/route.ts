import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { chatCompletion } from '@/lib/ai';
import { extractJSON } from '@/lib/extract-json';
import { EVALUATE_ANSWER_PROMPT, INTERVIEW_SUMMARY_PROMPT } from '@/lib/interview-prompts';
import { verifyAccessToken } from '@/lib/auth';
import { DEFAULT_PROVIDER } from '@/lib/ai-providers';

const AnswerBodySchema = z.object({
  answer: z.string().min(1),
  provider: z.string().optional(),
});

// POST /api/interview/[sessionId]/answer - 回答面试问题
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const body = AnswerBodySchema.parse(await req.json());

    // 获取面试会话
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    if (!session || session.userId !== payload.sub) {
      return NextResponse.json({ error: '面试会话不存在' }, { status: 404 });
    }

    if (session.status !== 'in_progress') {
      return NextResponse.json({ error: '面试已结束' }, { status: 400 });
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

    if (!apiKey) {
      return NextResponse.json({ error: '请先在设置中配置 API Key' }, { status: 400 });
    }

    // 获取当前问题
    const currentQuestion = session.questions[session.questions.length - 1];
    if (!currentQuestion) {
      return NextResponse.json({ error: '没有待回答的问题' }, { status: 400 });
    }

    // 评估回答
    const evalPrompt = EVALUATE_ANSWER_PROMPT
      .replace('{question}', currentQuestion.question)
      .replace('{answer}', body.answer);

    const evalRaw = await chatCompletion(provider, apiKey, evalPrompt, '请评估这个回答。', {
      maxTokens: 1000,
      baseUrl,
      temperature: 0.2,
    });

    let evaluation: Record<string, unknown>;
    try {
      evaluation = extractJSON(evalRaw) as Record<string, unknown>;
    } catch {
      evaluation = {
        score: 50,
        isCorrect: false,
        evaluation: '评估失败，请重试',
        keyPointsHit: [],
        keyPointsMissed: [],
        suggestions: [],
        nextDifficulty: session.difficulty,
        shouldFollowUp: false,
      };
    }

    // 更新当前问题的评估
    await prisma.interviewQuestion.update({
      where: { id: currentQuestion.id },
      data: {
        answer: body.answer,
        evaluation: typeof evaluation.evaluation === 'string' ? evaluation.evaluation : null,
        score: typeof evaluation.score === 'number' ? evaluation.score : null,
        isCorrect: typeof evaluation.isCorrect === 'boolean' ? evaluation.isCorrect : null,
      },
    });

    const totalQuestions = session.questions.length;
    const maxQuestions = 10;

    // 判断是否需要追问还是继续下一题
    const shouldFollowUp = evaluation.shouldFollowUp === true && totalQuestions < maxQuestions;
    const isLastQuestion = totalQuestions >= maxQuestions && !shouldFollowUp;

    if (isLastQuestion) {
      // 面试结束，生成总结
      return await finishInterview(session, provider, apiKey, baseUrl || undefined);
    }

    // 生成下一个问题
    const nextDifficulty = typeof evaluation.nextDifficulty === 'number'
      ? evaluation.nextDifficulty
      : session.difficulty;

    const followUpText = shouldFollowUp
      ? `候选人回答不够完整，请追问一个引导性问题。`
      : `请问下一个问题（第 ${totalQuestions + 1} 题，共 ${maxQuestions} 题）。难度：${nextDifficulty}/5。`;

    const systemPrompt = `你是技术面试官。领域：${session.domain}，岗位：${session.position}。
当前面试进展：已问 ${totalQuestions} 题。
候选人上一题得分：${evaluation.score}分。
${followUpText}
只输出下一个问题，不要多余的话。`;

    const nextQuestion = await chatCompletion(provider, apiKey, systemPrompt, '请出下一题。', {
      maxTokens: 300,
      baseUrl,
      temperature: 0.7,
    });

    // 保存下一题
    const newQuestion = await prisma.interviewQuestion.create({
      data: {
        sessionId,
        order: shouldFollowUp ? totalQuestions : totalQuestions + 1,
        question: nextQuestion,
        difficulty: nextDifficulty,
      },
    });

    // 更新难度
    if (nextDifficulty !== session.difficulty) {
      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: { difficulty: nextDifficulty },
      });
    }

    return NextResponse.json({
      evaluation: {
        score: evaluation.score,
        isCorrect: evaluation.isCorrect,
        feedback: evaluation.evaluation,
        keyPointsHit: evaluation.keyPointsHit,
        keyPointsMissed: evaluation.keyPointsMissed,
        suggestions: evaluation.suggestions,
      },
      nextQuestion: {
        id: newQuestion.id,
        content: nextQuestion,
        order: newQuestion.order,
        isFollowUp: shouldFollowUp,
        difficulty: nextDifficulty,
      },
      progress: {
        current: totalQuestions,
        total: maxQuestions,
        remaining: maxQuestions - totalQuestions,
      },
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

async function finishInterview(
  session: { id: string; domain: string; position: string; round: string; questions: Array<{ question: string; answer: string | null; score: number | null; order: number }> },
  provider: string,
  apiKey: string,
  baseUrl?: string,
) {
  // 收集所有题目表现
  const answered = session.questions.filter(q => q.answer && q.score != null);
  const avgScore = answered.length > 0
    ? Math.round(answered.reduce((s, q) => s + (q.score || 0), 0) / answered.length)
    : 0;

  const questionDetails = session.questions
    .filter(q => q.answer)
    .map(q => `第${q.order}题: ${q.question.substring(0, 100)}... | 回答: ${q.answer?.substring(0, 200)}... | 得分: ${q.score}`)
    .join('\n');

  const summaryPrompt = INTERVIEW_SUMMARY_PROMPT
    .replace('{domain}', session.domain)
    .replace('{position}', session.position)
    .replace('{round}', session.round)
    .replace('{totalQuestions}', String(session.questions.length))
    .replace('{avgScore}', String(avgScore))
    .replace('{questionDetails}', questionDetails);

  let summary: Record<string, unknown>;
  try {
    const summaryRaw = await chatCompletion(provider, apiKey, summaryPrompt, '请总结面试。', {
      maxTokens: 2000,
      baseUrl,
      temperature: 0.3,
    });
    summary = extractJSON(summaryRaw) as Record<string, unknown>;
  } catch {
    summary = {
      overallScore: avgScore,
      level: avgScore >= 80 ? 'B+' : avgScore >= 70 ? 'B' : avgScore >= 60 ? 'C' : 'D',
      summary: '面试总结生成失败，请查看各题详情。',
      strengths: [],
      weaknesses: [],
      recommendations: [],
      hireDecision: '需要改进',
    };
  }

  // 更新会话
  const duration = Math.round((Date.now() - session.questions[0]?.order * 60000) / 60000) || 0;
  await prisma.interviewSession.update({
    where: { id: session.id },
    data: {
      status: 'completed',
      score: typeof summary.overallScore === 'number' ? summary.overallScore : avgScore,
      overallFeedback: typeof summary.summary === 'string' ? summary.summary : null,
      duration,
      completedAt: new Date(),
    },
  });

  return NextResponse.json({
    finished: true,
    summary: {
      overallScore: summary.overallScore,
      level: summary.level,
      summary: summary.summary,
      strengths: summary.strengths,
      weaknesses: summary.weaknesses,
      recommendations: summary.recommendations,
      hireDecision: summary.hireDecision,
      detailedFeedback: summary.detailedFeedback,
    },
    stats: {
      totalQuestions: session.questions.length,
      answeredQuestions: answered.length,
      averageScore: avgScore,
      duration,
    },
  });
}
