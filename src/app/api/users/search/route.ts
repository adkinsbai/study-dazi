import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);

    const q = req.nextUrl.searchParams.get('q') || '';
    if (q.length < 2) return NextResponse.json({ users: [] });

    // 排除自己 + 已有好友关系的用户
    const existingRelations = await prisma.friendship.findMany({
      where: { OR: [{ fromUserId: payload.sub }, { toUserId: payload.sub }] },
      select: { fromUserId: true, toUserId: true },
    });
    const excludeIds = new Set([payload.sub]);
    for (const r of existingRelations) {
      excludeIds.add(r.fromUserId === payload.sub ? r.toUserId : r.fromUserId);
    }

    const users = await prisma.user.findMany({
      where: { username: { contains: q, mode: 'insensitive' }, id: { notIn: [...excludeIds] } },
      select: { id: true, username: true, avatarUrl: true },
      take: 10,
    });

    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
