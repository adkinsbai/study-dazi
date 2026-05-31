import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { pushToUser } from '@/lib/push';

// GET /api/buddies — 我的搭子列表
export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);

    const [active, pending] = await Promise.all([
      prisma.studyBuddy.findMany({
        where: { OR: [{ fromUserId: payload.sub }, { toUserId: payload.sub }], status: 'active' },
        include: { fromUser: { select: { id: true, username: true, avatarUrl: true } }, toUser: { select: { id: true, username: true, avatarUrl: true } } },
      }),
      prisma.studyBuddy.findMany({
        where: { toUserId: payload.sub, status: 'pending' },
        include: { fromUser: { select: { id: true, username: true } } },
      }),
    ]);

    // Load shared path titles
    const pathIds = [...new Set(active.map(b => b.sharedPathId).filter(Boolean))];
    const paths = pathIds.length > 0
      ? await prisma.learningPath.findMany({ where: { id: { in: pathIds as string[] } }, select: { id: true, title: true } })
      : [];
    const pathMap = new Map(paths.map(p => [p.id, p.title]));

    const buddies = active.map(b => ({
      id: b.id, domain: b.domain, sharedPathId: b.sharedPathId,
      sharedPathTitle: b.sharedPathId ? (pathMap.get(b.sharedPathId) || null) : null,
      buddy: b.fromUserId === payload.sub ? b.toUser : b.fromUser,
    }));

    return NextResponse.json({ buddies, requests: pending });
  } catch { return NextResponse.json({ error: '服务器错误' }, { status: 500 }); }
}

// POST /api/buddies — 发送搭子邀请
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);
    const { toUserId, domain, sharedPathId } = await req.json();
    if (!toUserId || !domain) return NextResponse.json({ error: '参数错误' }, { status: 400 });

    // 验证双方必须是好友
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { fromUserId: payload.sub, toUserId },
          { fromUserId: toUserId, toUserId: payload.sub },
        ],
      },
    });
    if (!friendship) {
      return NextResponse.json({ error: '你们还不是好友，无法成为搭子' }, { status: 400 });
    }

    const exist = await prisma.studyBuddy.findUnique({
      where: { fromUserId_toUserId_domain: { fromUserId: payload.sub, toUserId, domain } },
    });
    if (exist) return NextResponse.json({ error: '已发送过邀请' }, { status: 400 });

    const fromUser = await prisma.user.findUnique({ where: { id: payload.sub }, select: { username: true } });
    const createData: Record<string, unknown> = { fromUserId: payload.sub, toUserId, domain };
    if (sharedPathId) createData.sharedPathId = sharedPathId;
    await prisma.studyBuddy.create({ data: createData as any });
    const pathHint = sharedPathId ? '，已附带共享路径' : '';
    await prisma.notification.create({
      data: { userId: toUserId, type: 'buddy_invite', content: `${fromUser?.username || '用户'} 邀请你成为「${domain}」搭子${pathHint}。请前往好友页面 → 搭子区域接受`, referenceId: payload.sub },
    });
    pushToUser(toUserId, { title: '新的搭子邀请', body: `${fromUser?.username || '用户'} 邀请你成为「${domain}」搭子`, data: { url: '/friends' } });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch { return NextResponse.json({ error: '服务器错误' }, { status: 500 }); }
}

// PATCH /api/buddies — 接受/拒绝
export async function PATCH(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);
    const { id, action } = await req.json();
    const buddy = await prisma.studyBuddy.findUnique({ where: { id } });
    if (!buddy || buddy.toUserId !== payload.sub) return NextResponse.json({ error: '无权操作' }, { status: 403 });

    if (action === 'accept') {
      await prisma.studyBuddy.update({ where: { id }, data: { status: 'active', activeAt: new Date() } });
    } else {
      await prisma.studyBuddy.delete({ where: { id } });
    }
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: '服务器错误' }, { status: 500 }); }
}
