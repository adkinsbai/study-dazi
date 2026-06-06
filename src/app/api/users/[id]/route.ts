import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    await verifyAccessToken(auth);
    const { id } = await params;

    const [user, posts, paths, resources] = await Promise.all([
      prisma.user.findUnique({ where: { id }, select: { id: true, username: true, avatarUrl: true, bio: true } }),
      prisma.post.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 20,
        include: { user: { select: { username: true, avatarUrl: true } } } }),
      prisma.learningPath.findMany({ where: { userId: id, isPublic: true }, orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, domain: true, createdAt: true } }),
      prisma.resource.findMany({ where: { userId: id, visibility: 'public' }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);

    if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

    return NextResponse.json({ user, posts, paths, resources });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
