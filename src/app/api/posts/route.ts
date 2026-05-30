import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    await verifyAccessToken(auth);
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: '缺少 userId' }, { status: 400 });
    const posts = await prisma.post.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 50,
      include: { user: { select: { username: true, avatarUrl: true } } },
    });
    return NextResponse.json({ posts });
  } catch { return NextResponse.json({ error: '服务器错误' }, { status: 500 }); }
}

const CreateSchema = z.object({
  content: z.string().min(1).max(2000),
  images: z.array(z.string()).max(4).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);
    const body = CreateSchema.parse(await req.json());
    const post = await prisma.post.create({
      data: { userId: payload.sub, content: body.content, images: body.images || [] },
      include: { user: { select: { username: true, avatarUrl: true } } },
    });
    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: '参数错误', details: err.issues }, { status: 422 });
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);
    const postId = req.nextUrl.searchParams.get('id');
    if (!postId) return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.userId !== payload.sub) return NextResponse.json({ error: '无权操作' }, { status: 403 });
    await prisma.post.delete({ where: { id: postId } });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: '服务器错误' }, { status: 500 }); }
}
