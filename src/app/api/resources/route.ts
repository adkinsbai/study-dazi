import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    // 返回所有不重复的领域列表
    if (req.nextUrl.searchParams.get('domains') === '1') {
      const raw = await prisma.resource.findMany({ select: { domain: true }, distinct: ['domain'], orderBy: { domain: 'asc' } });
      return NextResponse.json({ domains: raw.map(r => r.domain) });
    }

    // 返回当前用户的资源
    if (req.nextUrl.searchParams.get('mine') === '1') {
      const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
      if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
      const payload = await verifyAccessToken(auth);
      const resources = await prisma.resource.findMany({
        where: { userId: payload.sub }, orderBy: { createdAt: 'desc' },
        include: { user: { select: { username: true } } },
      });
      return NextResponse.json({ resources });
    }

    const domain = req.nextUrl.searchParams.get('domain') || '';
    const where: Record<string, unknown> = {};
    if (domain) where.domain = domain;

    const resources = await prisma.resource.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 50,
      include: { user: { select: { username: true, avatarUrl: true } } },
    });
    return NextResponse.json({ resources });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

const CreateSchema = z.object({
  title: z.string().min(1),
  url: z.string().optional(),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  domain: z.string().min(1),
  description: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);
    const body = CreateSchema.parse(await req.json());
    const data: Record<string, unknown> = { userId: payload.sub, title: body.title, domain: body.domain };
    if (body.url) data.url = body.url;
    if (body.fileUrl) { data.fileUrl = body.fileUrl; data.fileName = body.fileName; }
    if (body.description) data.description = body.description;
    if (body.notes) data.notes = body.notes;

    const resource = await prisma.resource.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data as any,
      include: { user: { select: { username: true } } },
    });
    return NextResponse.json({ resource }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: '参数错误' }, { status: 422 });
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

const PatchSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  url: z.string().optional(),
  domain: z.string().optional(),
  notes: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);
    const body = PatchSchema.parse(await req.json());
    const r = await prisma.resource.findUnique({ where: { id: body.id } });
    if (!r || r.userId !== payload.sub) return NextResponse.json({ error: '无权操作' }, { status: 403 });
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.url !== undefined) data.url = body.url;
    if (body.domain !== undefined) data.domain = body.domain;
    if (body.notes !== undefined) data.notes = body.notes;
    await prisma.resource.update({ where: { id: body.id }, data: data as any });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: '参数错误' }, { status: 422 });
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const payload = await verifyAccessToken(auth);
    const id = req.nextUrl.searchParams.get('id');
    const r = await prisma.resource.findUnique({ where: { id: id || '' } });
    if (!r || r.userId !== payload.sub) return NextResponse.json({ error: '无权操作' }, { status: 403 });
    await prisma.resource.delete({ where: { id: id! } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
