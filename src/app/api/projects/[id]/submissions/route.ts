import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

// GET /api/projects/[id]/submissions - 当前用户的提交记录
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);

    const submissions = await prisma.projectSubmission.findMany({
      where: {
        projectId: id,
        userId: payload.sub,
      },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        content: true,
        repoUrl: true,
        demoUrl: true,
        score: true,
        feedback: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
      },
    });

    return NextResponse.json({ submissions });
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
