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

    const fromUser = await prisma.user.findUnique({ where: { id: payload.sub }, select: { username: true } });

    // Send notification to content owner for explore comments
    if (pathId === 'explore') {
      // nodeId format: "post-xxx", "resource-xxx", "path-xxx"
      const [type, ...rest] = nodeId.split('-');
      const refId = rest.join('-');
      let ownerId: string | null = null;
      let refType = type;
      if (type === 'post') {
        const post = await prisma.post.findUnique({ where: { id: refId }, select: { userId: true } });
        ownerId = post?.userId ?? null;
      } else if (type === 'resource') {
        const res = await prisma.resource.findUnique({ where: { id: refId }, select: { userId: true } });
        ownerId = res?.userId ?? null;
      } else if (type === 'path') {
        const p = await prisma.learningPath.findUnique({ where: { id: refId }, select: { userId: true } });
        ownerId = p?.userId ?? null;
      }
      if (ownerId && ownerId !== payload.sub) {
        const typeLabel = type === 'post' ? '动态' : type === 'resource' ? '资源' : '路径';
        await prisma.notification.create({
          data: { userId: ownerId, type: 'comment', content: `${fromUser?.username} 评论了你的${typeLabel}`, referenceId: `explore:${nodeId}` },
        });
      }
    } else {
      // Regular path comment notification
      const path = await prisma.learningPath.findUnique({ where: { id: pathId }, select: { userId: true } });
      if (path && path.userId !== payload.sub) {
        await prisma.notification.create({ data: { userId: path.userId, type: 'comment', content: `${fromUser?.username} 评论了你的学习路径`, referenceId: pathId } });
      }
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch { return NextResponse.json({ error: '服务器错误' }, { status: 500 }); }
}
