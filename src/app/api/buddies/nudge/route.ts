import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

// POST /api/buddies/nudge — 催更搭子
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);
    const { buddyId, toUserId } = await req.json();

    // Verify they are actually buddies
    const buddy = await prisma.studyBuddy.findFirst({
      where: {
        id: buddyId,
        status: 'active',
        OR: [{ fromUserId: payload.sub, toUserId }, { fromUserId: toUserId, toUserId: payload.sub }],
      },
    });
    if (!buddy) return NextResponse.json({ error: '搭子关系不存在' }, { status: 403 });

    const fromUser = await prisma.user.findUnique({ where: { id: payload.sub }, select: { username: true } });

    await prisma.notification.create({
      data: {
        userId: toUserId,
        type: 'nudge',
        content: `${fromUser?.username || '搭子'} 催你学习啦！⏰`,
        referenceId: payload.sub,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
