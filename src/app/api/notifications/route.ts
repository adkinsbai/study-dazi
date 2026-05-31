import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

// GET /api/notifications
export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);

    const only = req.nextUrl.searchParams.get('only'); // 'friends' | 'messages' | null

    let typeFilter: Record<string, unknown>;
    if (only === 'friends') {
      typeFilter = { in: ['friend_request', 'buddy_invite', 'group_invite'] };
    } else {
      typeFilter = { notIn: ['message', 'friend_request', 'buddy_invite', 'group_invite'] };
    }

    const [notifs, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where: { userId: payload.sub, type: typeFilter }, orderBy: { createdAt: 'desc' }, take: 30 }),
      prisma.notification.count({ where: { userId: payload.sub, read: false, type: typeFilter } }),
    ]);

    return NextResponse.json({ notifications: notifs, unreadCount });
  } catch { return NextResponse.json({ error: '服务器错误' }, { status: 500 }); }
}

// PATCH /api/notifications — 标记已读
export async function PATCH(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);
    const { id } = await req.json();

    if (id) {
      await prisma.notification.update({ where: { id }, data: { read: true } });
    } else {
      await prisma.notification.updateMany({ where: { userId: payload.sub, read: false }, data: { read: true } });
    }
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: '服务器错误' }, { status: 500 }); }
}
