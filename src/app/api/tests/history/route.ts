import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if (auth instanceof NextResponse) return auth;

    const url = new URL(req.url);
    const pathId = url.searchParams.get('pathId') || undefined;
    const nodeId = url.searchParams.get('nodeId') || undefined;
    const type = url.searchParams.get('type') || undefined;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));

    // 构建查询条件
    const where: any = { userId: auth.sub };
    if (pathId) where.pathId = pathId;
    if (nodeId) where.nodeId = nodeId;
    if (type) where.type = type;

    // 查询总数
    const total = await prisma.testSession.count({ where });

    // 查询列表
    const sessions = await prisma.testSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        score: true,
        correctCount: true,
        totalQuestions: true,
        duration: true,
        pathId: true,
        nodeId: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      sessions,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
