import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { pushToUser } from '@/lib/push';

// GET /api/messages — 会话列表
export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);
    const withUser = req.nextUrl.searchParams.get('with');

    if (withUser) {
      // 与某人的对话记录
      const msgs = await prisma.message.findMany({
        where: { OR: [{ fromUserId: payload.sub, toUserId: withUser }, { fromUserId: withUser, toUserId: payload.sub }] },
        orderBy: { createdAt: 'asc' }, take: 100,
        include: { fromUser: { select: { username: true } } },
      });
      // Mark as read
      await prisma.message.updateMany({ where: { toUserId: payload.sub, fromUserId: withUser, read: false }, data: { read: true } });
      return NextResponse.json({ messages: msgs });
    }

    // 会话列表：每个对话显示最后一条消息
    const allMsgs = await prisma.message.findMany({
      where: { OR: [{ fromUserId: payload.sub }, { toUserId: payload.sub }] },
      orderBy: { createdAt: 'desc' }, take: 200,
      include: { fromUser: { select: { id: true, username: true, avatarUrl: true } }, toUser: { select: { id: true, username: true, avatarUrl: true } } },
    });

    const convMap = new Map<string, { user: { id: string; username: string; avatarUrl: string | null }; lastMsg: string; time: string; unread: number }>();
    for (const m of allMsgs) {
      const other = m.fromUserId === payload.sub ? m.toUser : m.fromUser;
      if (!convMap.has(other.id)) {
        convMap.set(other.id, { user: other, lastMsg: m.content, time: m.createdAt.toISOString(), unread: 0 });
      }
      if (m.toUserId === payload.sub && !m.read) {
        convMap.get(other.id)!.unread++;
      }
    }
    const totalUnread = [...convMap.values()].reduce((s, c) => s + c.unread, 0);
    return NextResponse.json({ conversations: [...convMap.values()], unreadCount: totalUnread });
  } catch { return NextResponse.json({ error: '服务器错误' }, { status: 500 }); }
}

// POST /api/messages — 发送消息
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);
    const { toUserId, content } = await req.json();
    if (!toUserId || !content) return NextResponse.json({ error: '参数错误' }, { status: 400 });

    const fromUser = await prisma.user.findUnique({ where: { id: payload.sub }, select: { username: true } });
    const msg = await prisma.message.create({
      data: { fromUserId: payload.sub, toUserId, content },
    });
    pushToUser(toUserId, { title: fromUser?.username || '新消息', body: content.slice(0, 100), tag: 'msg', data: { url: `/messages?with=${payload.sub}` } });

    return NextResponse.json({ message: msg }, { status: 201 });
  } catch { return NextResponse.json({ error: '服务器错误' }, { status: 500 }); }
}
