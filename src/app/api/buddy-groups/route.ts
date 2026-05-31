import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

// GET /api/buddy-groups — 我的小组列表
export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);

    const groups = await prisma.buddyGroup.findMany({
      where: {
        members: { some: { userId: payload.sub } },
      },
      include: {
        members: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } },
        creator: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Collect all user IDs that are already in any of my groups
    const groupedUserIds = new Set<string>();
    for (const g of groups) {
      for (const m of g.members) {
        groupedUserIds.add(m.userId);
      }
    }

    // Also get buddy-only relationships (1-on-1 without a group)
    const soloBuddies = await prisma.studyBuddy.findMany({
      where: {
        OR: [{ fromUserId: payload.sub }, { toUserId: payload.sub }],
        status: 'active',
      },
      include: {
        fromUser: { select: { id: true, username: true, avatarUrl: true } },
        toUser: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    // Filter out buddies already in groups
    const filteredSolo = soloBuddies.filter(b => {
      const buddyId = b.fromUserId === payload.sub ? b.toUserId : b.fromUserId;
      return !groupedUserIds.has(buddyId);
    });

    const result = groups.map(g => ({
      id: g.id,
      name: g.name,
      domain: g.domain,
      sharedPathId: g.sharedPathId,
      createdBy: g.createdBy,
      createdAt: g.createdAt,
      members: g.members.map(m => ({
        id: m.user.id,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    }));

    return NextResponse.json({
      groups: result,
      soloBuddies: filteredSolo.map(b => ({
        buddyId: b.id,
        domain: b.domain,
        sharedPathId: b.sharedPathId,
        buddy: b.fromUserId === payload.sub ? b.toUser : b.fromUser,
      })),
    });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// POST /api/buddy-groups — 创建小组
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);
    const { name, domain, sharedPathId, memberIds } = await req.json();

    if (!name || !domain) return NextResponse.json({ error: '请填写组名和领域' }, { status: 400 });
    if (!memberIds || memberIds.length === 0) return NextResponse.json({ error: '请至少邀请一个搭子' }, { status: 400 });

    // Verify all members are active buddies
    const buddies = await prisma.studyBuddy.findMany({
      where: {
        status: 'active',
        OR: memberIds.map((uid: string) => ({
          OR: [
            { fromUserId: payload.sub, toUserId: uid },
            { fromUserId: uid, toUserId: payload.sub },
          ],
        })),
      },
    });

    const validIds = new Set(buddies.map(b => b.fromUserId === payload.sub ? b.toUserId : b.fromUserId));
    const validMembers = memberIds.filter((uid: string) => validIds.has(uid));
    if (validMembers.length === 0) return NextResponse.json({ error: '所选用户不是你的搭子' }, { status: 400 });

    const group = await prisma.buddyGroup.create({
      data: {
        name,
        domain,
        sharedPathId: sharedPathId || null,
        createdBy: payload.sub,
        members: {
          create: [
            { userId: payload.sub, role: 'owner' },
            ...validMembers.map((uid: string) => ({ userId: uid, role: 'member' })),
          ],
        },
      },
      include: { members: { include: { user: { select: { id: true, username: true } } } } },
    });

    // Notify all invited members
    const fromUser = await prisma.user.findUnique({ where: { id: payload.sub }, select: { username: true } });
    for (const uid of validMembers) {
      await prisma.notification.create({
        data: {
          userId: uid,
          type: 'group_invite',
          content: `${fromUser?.username} 邀请你加入学习小组「${name}」(${domain})`,
          referenceId: group.id,
        },
      });
    }

    return NextResponse.json({ group }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
