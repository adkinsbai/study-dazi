import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

// GET /api/buddies/board — 搭子看板数据
export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);

    // Get active buddies with shared paths
    const buddies = await prisma.studyBuddy.findMany({
      where: {
        OR: [{ fromUserId: payload.sub }, { toUserId: payload.sub }],
        status: 'active',
        sharedPathId: { not: null },
      },
      include: {
        fromUser: { select: { id: true, username: true, avatarUrl: true } },
        toUser: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    if (buddies.length === 0) {
      return NextResponse.json({ boards: [] });
    }

    // Load shared paths
    const pathIds = [...new Set(buddies.map(b => b.sharedPathId!).filter(Boolean))];
    const paths = await prisma.learningPath.findMany({
      where: { id: { in: pathIds } },
      select: { id: true, title: true, domain: true, treeData: true },
    });
    const pathMap = new Map(paths.map(p => [p.id, p]));

    // Collect all (userId, pathId) pairs for progress loading
    const progressPairs: { userId: string; pathId: string }[] = [];
    for (const b of buddies) {
      if (!b.sharedPathId) continue;
      const buddyUser = b.fromUserId === payload.sub ? b.toUser : b.fromUser;
      progressPairs.push({ userId: payload.sub, pathId: b.sharedPathId });
      progressPairs.push({ userId: buddyUser.id, pathId: b.sharedPathId });
    }

    // Load all progress in one query
    const allProgress = await prisma.userNodeProgress.findMany({
      where: {
        OR: progressPairs.map(p => ({ userId: p.userId, pathId: p.pathId })),
      },
      select: { userId: true, pathId: true, nodeId: true, status: true },
    });

    // Group progress by userId+pathId
    const progressIndex = new Map<string, { total: number; completed: number }>();
    for (const p of allProgress) {
      const key = `${p.userId}:${p.pathId}`;
      if (!progressIndex.has(key)) progressIndex.set(key, { total: 0, completed: 0 });
      const entry = progressIndex.get(key)!;
      entry.total++;
      if (p.status === 'completed') entry.completed++;
    }

    // Count total nodes per path from treeData
    function countNodes(phases: any[]): number {
      let count = 0;
      for (const phase of phases) {
        count++;
        if (phase.children) count += countNodes(phase.children);
      }
      return count;
    }

    // Build board data
    const boards = buddies
      .filter(b => b.sharedPathId)
      .map(b => {
        const buddyUser = b.fromUserId === payload.sub ? b.toUser : b.fromUser;
        const path = pathMap.get(b.sharedPathId!);
        const totalNodes = path ? countNodes((path.treeData as any)?.phases || []) : 0;

        const myKey = `${payload.sub}:${b.sharedPathId}`;
        const buddyKey = `${buddyUser.id}:${b.sharedPathId}`;
        const myProgress = progressIndex.get(myKey);
        const buddyProgress = progressIndex.get(buddyKey);

        return {
          buddyId: b.id,
          sharedPathId: b.sharedPathId,
          domain: b.domain,
          buddy: {
            id: buddyUser.id,
            username: buddyUser.username,
            avatarUrl: buddyUser.avatarUrl,
          },
          path: {
            id: path?.id,
            title: path?.title || '未知路径',
          },
          totalNodes,
          myCompleted: myProgress?.completed || 0,
          myTotal: myProgress?.total || 0,
          buddyCompleted: buddyProgress?.completed || 0,
          buddyTotal: buddyProgress?.total || 0,
        };
      });

    return NextResponse.json({ boards });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
