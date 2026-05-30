import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

// GET /api/comments?pathId=&nodeId=
export async function GET(req: NextRequest) {
  try {
    const pathId = req.nextUrl.searchParams.get('pathId');
    const nodeId = req.nextUrl.searchParams.get('nodeId');
    if (!pathId || !nodeId) return NextResponse.json({ error: '参数错误' }, { status: 400 });

    const comments = await prisma.nodeComment.findMany({
      where: { pathId, nodeId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    });
    return NextResponse.json({ comments });
  } catch { return NextResponse.json({ error: '服务器错误' }, { status: 500 }); }
}

// POST /api/comments
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);
    const { pathId, nodeId, content } = await req.json();
    if (!pathId || !nodeId || !content) return NextResponse.json({ error: '参数错误' }, { status: 400 });

    const comment = await prisma.nodeComment.create({
      data: { userId: payload.sub, pathId, nodeId, content },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    });
    return NextResponse.json({ comment }, { status: 201 });
  } catch { return NextResponse.json({ error: '服务器错误' }, { status: 500 }); }
}
