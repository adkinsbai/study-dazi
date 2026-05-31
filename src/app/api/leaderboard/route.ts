import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

// GET /api/leaderboard?scope=week|total|friends
export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);
    const scope = req.nextUrl.searchParams.get('scope') || 'week';

    // Date range for weekly
    let dateFilter: Date | undefined;
    if (scope === 'week') {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      monday.setHours(0, 0, 0, 0);
      dateFilter = monday;
    }

    // If friends scope, get friend IDs
    let friendIds: string[] | undefined;
    if (scope === 'friends') {
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [{ fromUserId: payload.sub }, { toUserId: payload.sub }],
          status: 'accepted',
        },
      });
      friendIds = friendships.map(f => f.fromUserId === payload.sub ? f.toUserId : f.fromUserId);
      friendIds.push(payload.sub); // include self
    }

    // Build check-in aggregation
    const whereCheckIn: any = {};
    if (dateFilter) whereCheckIn.checkInDate = { gte: dateFilter };
    if (friendIds) whereCheckIn.userId = { in: friendIds };

    const checkInAgg = await prisma.checkIn.groupBy({
      by: ['userId'],
      where: whereCheckIn,
      _count: { id: true },
      _sum: { durationMin: true },
    });

    // Build completed nodes aggregation
    const whereNodes: any = { status: 'completed' };
    if (friendIds) whereNodes.userId = { in: friendIds };

    const nodeAgg = await prisma.userNodeProgress.groupBy({
      by: ['userId'],
      where: whereNodes,
      _count: { id: true },
    });

    // Merge results
    const userIds = new Set<string>();
    for (const c of checkInAgg) userIds.add(c.userId);
    for (const n of nodeAgg) userIds.add(n.userId);

    const users = await prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, username: true, avatarUrl: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    const nodeMap = new Map(nodeAgg.map(n => [n.userId, n._count.id]));
    const rankings = checkInAgg.map(c => {
      const user = userMap.get(c.userId);
      return {
        userId: c.userId,
        username: user?.username || '未知用户',
        avatarUrl: user?.avatarUrl || null,
        checkInDays: c._count.id,
        totalMinutes: c._sum.durationMin || 0,
        completedNodes: nodeMap.get(c.userId) || 0,
        // Score = checkInDays * 100 + completedNodes (for ranking)
        score: c._count.id * 100 + (nodeMap.get(c.userId) || 0),
      };
    });

    // Also include users who only have completed nodes but no check-ins
    for (const n of nodeAgg) {
      if (!checkInAgg.find(c => c.userId === n.userId)) {
        const user = userMap.get(n.userId);
        rankings.push({
          userId: n.userId,
          username: user?.username || '未知用户',
          avatarUrl: user?.avatarUrl || null,
          checkInDays: 0,
          totalMinutes: 0,
          completedNodes: n._count.id,
          score: n._count.id,
        });
      }
    }

    // Sort by score descending
    rankings.sort((a, b) => b.score - a.score);

    // Add rank
    const result = rankings.slice(0, 50).map((r, i) => ({
      ...r,
      rank: i + 1,
    }));

    // Find current user's rank
    const myRank = result.find(r => r.userId === payload.sub);

    return NextResponse.json({ rankings: result, myRank: myRank || null });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
