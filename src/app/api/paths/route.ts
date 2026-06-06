import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { verifyAccessToken } from '@/lib/auth';

const CreateSchema = z.object({
  title: z.string().min(1, '请输入路径名称'),
  domain: z.string().min(1),
  tree_data: z.object({}).passthrough(),
  userProfile: z.string().optional(),
  isPublic: z.boolean().optional(),
  isTemplate: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);

    const paths = await prisma.learningPath.findMany({
      where: { userId: payload.sub },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        domain: true,
        isPublic: true,
        isTemplate: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ paths });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const body = CreateSchema.parse(await req.json());

    const path = await prisma.learningPath.create({
      data: {
        userId: payload.sub,
        title: body.title,
        domain: body.domain,
        treeData: body.tree_data as Prisma.InputJsonValue,
        userProfile: body.userProfile,
        isPublic: body.isPublic ?? false,
        isTemplate: body.isTemplate ?? false,
      },
    });

    return NextResponse.json({ id: path.id, title: path.title, createdAt: path.createdAt }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: '参数错误', details: err.issues }, { status: 422 });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
