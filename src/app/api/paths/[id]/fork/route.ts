import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);
    const { id } = await params;

    const template = await prisma.learningPath.findUnique({ where: { id } });
    if (!template) return NextResponse.json({ error: '模板不存在' }, { status: 404 });

    const forked = await prisma.learningPath.create({
      data: {
        userId: payload.sub,
        title: `${template.title} (Fork)`,
        domain: template.domain,
        treeData: template.treeData as object,
        isPublic: false,
        isTemplate: false,
      },
    });

    await prisma.learningPath.update({ where: { id }, data: { forkCount: { increment: 1 } } });

    return NextResponse.json({ id: forked.id, title: forked.title }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
