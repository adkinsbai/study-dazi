import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

// GET /api/interview/history - 面试历史
export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
    const domain = url.searchParams.get('domain') || undefined;
    const round = url.searchParams.get('round') || undefined;

    const where: Record<string, unknown> = { userId: payload.sub };
    if (domain) where.domain = domain;
    if (round) where.round = round;

    const [sessions, total] = await Promise.all([
      prisma.interviewSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          domain: true,
          position: true,
          round: true,
          difficulty: true,
          score: true,
          status: true,
          duration: true,
          createdAt: true,
          completedAt: true,
          _count: { select: { questions: true } },
        },
      }),
      prisma.interviewSession.count({ where }),
    ]);

    return NextResponse.json({
      items: sessions,
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
