import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get('search') || '';
    const domain = req.nextUrl.searchParams.get('domain') || '';

    const where: Record<string, unknown> = { isTemplate: true, isPublic: true };
    if (search) where.title = { contains: search, mode: 'insensitive' };
    if (domain) where.domain = domain;

    const templates = await prisma.learningPath.findMany({
      where,
      orderBy: { forkCount: 'desc' },
      take: 50,
      select: {
        id: true, title: true, domain: true, forkCount: true, createdAt: true,
        user: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    // Attach comment counts and top comment
    const templatesWithMeta = await Promise.all(templates.map(async (t) => {
      const [commentCount, topComment] = await Promise.all([
        prisma.nodeComment.count({ where: { pathId: 'explore', nodeId: `path-${t.id}` } }),
        prisma.nodeComment.findFirst({
          where: { pathId: 'explore', nodeId: `path-${t.id}` },
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { username: true } } },
        }),
      ]);
      return { ...t, commentCount, topComment };
    }));

    return NextResponse.json({ templates: templatesWithMeta });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
