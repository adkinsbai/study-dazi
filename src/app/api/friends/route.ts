import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

// GET /api/friends — 好友列表 + 待处理申请
export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);

    const [friends, requests] = await Promise.all([
      // 已接受的好友
      prisma.friendship.findMany({
        where: {
          OR: [{ fromUserId: payload.sub }, { toUserId: payload.sub }],
          status: 'accepted',
        },
        include: {
          fromUser: { select: { id: true, username: true, avatarUrl: true } },
          toUser: { select: { id: true, username: true, avatarUrl: true } },
        },
      }),
      // 我收到的待处理申请
      prisma.friendship.findMany({
        where: { toUserId: payload.sub, status: 'pending' },
        include: { fromUser: { select: { id: true, username: true, avatarUrl: true } } },
      }),
    ]);

    const friendList = friends.map(f => f.fromUserId === payload.sub ? f.toUser : f.fromUser);
    return NextResponse.json({ friends: friendList, requests });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// POST /api/friends — 发送好友申请
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);
    const { toUserId } = await req.json();
    if (!toUserId || toUserId === payload.sub) {
      return NextResponse.json({ error: '无效的用户' }, { status: 400 });
    }

    const existing = await prisma.friendship.findUnique({
      where: { fromUserId_toUserId: { fromUserId: payload.sub, toUserId } },
    });
    if (existing) {
      return NextResponse.json({ error: existing.status === 'accepted' ? '已经是好友' : '已发送过申请' }, { status: 400 });
    }

    await prisma.friendship.create({
      data: { fromUserId: payload.sub, toUserId, status: 'pending' },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
