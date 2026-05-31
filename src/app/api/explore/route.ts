import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type') || 'posts';

    if (type === 'posts') {
      const posts = await prisma.post.findMany({
        orderBy: { createdAt: 'desc' }, take: 30,
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      });
      return NextResponse.json({ posts });
    }

    if (type === 'resources') {
      const domain = req.nextUrl.searchParams.get('domain') || '';
      const search = req.nextUrl.searchParams.get('search') || '';
      const where: Record<string, unknown> = {};
      if (domain) where.domain = domain;
      if (search) where.title = { contains: search, mode: 'insensitive' };
      const resources = await prisma.resource.findMany({
        where, orderBy: { createdAt: 'desc' }, take: 30,
        include: { user: { select: { username: true } } },
      });
      return NextResponse.json({ resources });
    }

    return NextResponse.json({ error: '未知类型' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
