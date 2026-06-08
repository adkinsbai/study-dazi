import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const auth = await authenticate(req);
    if (auth instanceof NextResponse) return auth;

    const { sessionId } = await params;

    // 查询测试会话及关联数据
    const session = await prisma.testSession.findFirst({
      where: { id: sessionId, userId: auth.sub },
      include: {
        questions: {
          include: {
            question: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: '测试会话不存在' }, { status: 404 });
    }

    // 构建详情，包含正确答案和用户答案
    const questionDetails = await Promise.all(
      session.questions.map(async (sq) => {
        // 获取用户答案
        let userAnswer = null;
        if (sq.userAnswerId) {
          userAnswer = await prisma.userAnswer.findUnique({
            where: { id: sq.userAnswerId },
          });
        }

        return {
          questionId: sq.questionId,
          order: sq.order,
          type: sq.question.type,
          difficulty: sq.question.difficulty,
          title: sq.question.title,
          content: sq.question.content,
          tags: sq.question.tags,
          // 正确答案
          correctAnswer: sq.question.answer,
          explanation: sq.question.explanation,
          // 用户答案
          userAnswer: userAnswer?.answer || null,
          isCorrect: sq.isCorrect,
          score: userAnswer?.score || null,
          feedback: userAnswer?.feedback || null,
          timeSpent: userAnswer?.timeSpent || null,
        };
      })
    );

    return NextResponse.json({
      sessionId: session.id,
      title: session.title,
      type: session.type,
      status: session.status,
      score: session.score,
      correctCount: session.correctCount,
      totalQuestions: session.totalQuestions,
      duration: session.duration,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      createdAt: session.createdAt,
      questions: questionDetails,
    });
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
