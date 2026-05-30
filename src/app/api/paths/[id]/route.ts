import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const { id } = await params;

    const path = await prisma.learningPath.findUnique({ where: { id } });
    if (!path) return NextResponse.json({ error: '路径不存在' }, { status: 404 });
    // 允许所有者 + 公开/模板路径的访问
    if (path.userId !== payload.sub && !path.isPublic && !path.isTemplate) {
      return NextResponse.json({ error: '无权访问' }, { status: 403 });
    }

    return NextResponse.json({ path });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const { id } = await params;

    const path = await prisma.learningPath.findUnique({ where: { id } });
    if (!path) return NextResponse.json({ error: '路径不存在' }, { status: 404 });
    if (path.userId !== payload.sub) {
      return NextResponse.json({ error: '无权访问' }, { status: 403 });
    }

    await prisma.learningPath.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

const PatchSchema = z.object({
  isPublic: z.boolean().optional(),
  isTemplate: z.boolean().optional(),
  tree_data: z.object({}).passthrough().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);
    const { id } = await params;

    const path = await prisma.learningPath.findUnique({ where: { id } });
    if (!path) return NextResponse.json({ error: '路径不存在' }, { status: 404 });
    if (path.userId !== payload.sub) return NextResponse.json({ error: '无权访问' }, { status: 403 });

    const body = PatchSchema.parse(await req.json());
    const data: Record<string, unknown> = {};
    if (body.isPublic !== undefined) data.isPublic = body.isPublic;
    if (body.isTemplate !== undefined) data.isTemplate = body.isTemplate;
    if (body.tree_data !== undefined) data.treeData = body.tree_data;

    await prisma.learningPath.update({ where: { id }, data });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: '参数错误' }, { status: 422 });
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
