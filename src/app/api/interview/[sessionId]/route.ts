import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

// GET /api/interview/[sessionId] - 获取面试详情
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);

    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            order: true,
            question: true,
            answer: true,
            evaluation: true,
            score: true,
            isCorrect: true,
            hints: true,
            difficulty: true,
          },
        },
      },
    });

    if (!session || session.userId !== payload.sub) {
      return NextResponse.json({ error: '面试会话不存在' }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
