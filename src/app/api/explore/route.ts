import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logError } from '@/lib/log';

function getPagination(req: NextRequest) {
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || '20')));
  return { page, limit, skip: (page - 1) * limit };
}

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type') || 'posts';
    const { page, limit, skip } = getPagination(req);

    if (type === 'posts') {
      const [posts, total] = await Promise.all([
        prisma.post.findMany({
          orderBy: { createdAt: 'desc' }, skip, take: limit,
          include: { user: { select: { id: true, username: true, avatarUrl: true } } },
        }),
        prisma.post.count(),
      ]);
      return NextResponse.json({ posts, total, page, hasMore: skip + posts.length < total });
    }

    if (type === 'resources') {
      const domain = req.nextUrl.searchParams.get('domain') || '';
      const search = req.nextUrl.searchParams.get('search') || '';
      const where: Record<string, unknown> = {};
      if (domain) where.domain = domain;
      if (search) where.title = { contains: search, mode: 'insensitive' };
      const [resources, total] = await Promise.all([
        prisma.resource.findMany({
          where, orderBy: { createdAt: 'desc' }, skip, take: limit,
          include: { user: { select: { username: true } } },
        }),
        prisma.resource.count({ where }),
      ]);
      return NextResponse.json({ resources, total, page, hasMore: skip + resources.length < total });
    }

    return NextResponse.json({ error: '未知类型' }, { status: 400 });
  } catch (err) {
    logError('GET /api/explore', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
