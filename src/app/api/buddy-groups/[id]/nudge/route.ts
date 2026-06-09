import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

// POST /api/buddy-groups/[id]/nudge — 催更全组
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);
    const { id } = await params;

    const group = await prisma.buddyGroup.findUnique({
      where: { id },
      include: { members: { select: { userId: true } } },
    });
    if (!group) return NextResponse.json({ error: '小组不存在' }, { status: 404 });

    // 检查当前用户是否是小组成员
    const isMember = group.members.some(m => m.userId === payload.sub);
    if (!isMember) {
      return NextResponse.json({ error: '你不是该小组成员' }, { status: 403 });
    }

    const fromUser = await prisma.user.findUnique({ where: { id: payload.sub }, select: { username: true } });

    // Notify all members except sender
    const targets = group.members.filter(m => m.userId !== payload.sub);
    for (const m of targets) {
      await prisma.notification.create({
        data: {
          userId: m.userId,
          type: 'nudge',
          content: `${fromUser?.username} 在「${group.name}」小组催你学习啦！⏰`,
          referenceId: id,
        },
      });
    }

    return NextResponse.json({ success: true, nudged: targets.length });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
