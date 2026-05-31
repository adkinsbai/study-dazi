import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

// GET /api/buddy-groups/[id] — 小组详情+全员进度
export async function GET(
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
      include: {
        members: {
          include: { user: { select: { id: true, username: true, avatarUrl: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!group) return NextResponse.json({ error: '小组不存在' }, { status: 404 });

    // Check membership
    const isMember = group.members.some(m => m.userId === payload.sub);
    if (!isMember) return NextResponse.json({ error: '无权访问' }, { status: 403 });

    // Load shared path + all members progress
    let pathData = null;
    let progressMap: Record<string, Record<string, { status: string }>> = {};

    if (group.sharedPathId) {
      const path = await prisma.learningPath.findUnique({
        where: { id: group.sharedPathId },
        select: { id: true, title: true, domain: true, treeData: true },
      });

      if (path) {
        pathData = { id: path.id, title: path.title, domain: path.domain, treeData: path.treeData };

        const memberIds = group.members.map(m => m.userId);
        const allProgress = await prisma.userNodeProgress.findMany({
          where: { userId: { in: memberIds }, pathId: group.sharedPathId! },
          select: { userId: true, nodeId: true, status: true, notes: true },
        });

        for (const p of allProgress) {
          if (!progressMap[p.userId]) progressMap[p.userId] = {};
          progressMap[p.userId][p.nodeId] = { status: p.status };
        }
      }
    }

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        domain: group.domain,
        sharedPathId: group.sharedPathId,
        createdBy: group.createdBy,
        createdAt: group.createdAt,
        members: group.members.map(m => ({
          id: m.user.id,
          username: m.user.username,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      },
      path: pathData,
      progress: progressMap,
    });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
