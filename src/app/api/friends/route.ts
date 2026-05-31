import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/auth';
import { logError } from '@/lib/log';
import { pushToUser } from '@/lib/push';

// GET /api/friends — 好友列表 + 待处理申请
export async function GET(req: NextRequest) {
  try {
    const payload = await authenticate(req);
    if (payload instanceof NextResponse) return payload;

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
  } catch (err) {
    logError('GET /api/friends', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// POST /api/friends — 发送好友申请
export async function POST(req: NextRequest) {
  try {
    const payload = await authenticate(req);
    if (payload instanceof NextResponse) return payload;
    const { toUserId } = await req.json();
    if (!toUserId || toUserId === payload.sub) {
      return NextResponse.json({ error: '无效的用户' }, { status: 400 });
    }

    // 检查两个方向是否已有好友关系
    const [forward, reverse] = await Promise.all([
      prisma.friendship.findUnique({
        where: { fromUserId_toUserId: { fromUserId: payload.sub, toUserId } },
      }),
      prisma.friendship.findUnique({
        where: { fromUserId_toUserId: { fromUserId: toUserId, toUserId: payload.sub } },
      }),
    ]);
    const existing = forward || reverse;
    if (existing) {
      if (existing.status === 'accepted') {
        return NextResponse.json({ error: '已经是好友' }, { status: 400 });
      }
      // 如果对方已经向你发过申请，直接接受
      if (reverse && reverse.status === 'pending') {
        await prisma.friendship.update({
          where: { id: reverse.id },
          data: { status: 'accepted', acceptedAt: new Date() },
        });
        return NextResponse.json({ autoAccepted: true }, { status: 201 });
      }
      return NextResponse.json({ error: '已发送过申请' }, { status: 400 });
    }

    const fromUser = await prisma.user.findUnique({ where: { id: payload.sub }, select: { username: true } });
    await prisma.friendship.create({
      data: { fromUserId: payload.sub, toUserId, status: 'pending' },
    });
    await prisma.notification.create({
      data: { userId: toUserId, type: 'friend_request', content: `${fromUser?.username || '用户'} 请求添加你为好友`, referenceId: payload.sub },
    });
    pushToUser(toUserId, { title: '新的好友申请', body: `${fromUser?.username || '用户'} 请求添加你为好友`, data: { url: '/friends' } });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    logError('POST /api/friends', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
