import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/auth';
import { logError } from '@/lib/log';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await authenticate(req);
    if (payload instanceof NextResponse) return payload;
    const { id } = await params;

    const template = await prisma.learningPath.findUnique({ where: { id } });
    if (!template) return NextResponse.json({ error: '模板不存在' }, { status: 404 });

    // 只能 fork 公开路径、模板、或自己的路径
    if (!template.isPublic && !template.isTemplate && template.userId !== payload.sub) {
      return NextResponse.json({ error: '无权 fork 该路径' }, { status: 403 });
    }

    const forked = await prisma.learningPath.create({
      data: {
        userId: payload.sub,
        title: `${template.title} (Fork)`,
        domain: template.domain,
        treeData: template.treeData as object,
        forkedFrom: id,
        isPublic: false,
        isTemplate: false,
      },
    });

    await prisma.learningPath.update({ where: { id }, data: { forkCount: { increment: 1 } } });

    return NextResponse.json({ id: forked.id, title: forked.title }, { status: 201 });
  } catch (err) {
    logError('POST /api/paths/[id]/fork', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
