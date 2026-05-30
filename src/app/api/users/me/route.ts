import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, email: true, deepseekApiKey: true },
    });

    return NextResponse.json({
      id: user?.id,
      username: user?.username,
      email: user?.email,
      deepseekApiKey: !!user?.deepseekApiKey,
    });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

const PatchSchema = z.object({
  deepseekApiKey: z.string().optional(),
  username: z.string().min(2).max(30).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const body = PatchSchema.parse(await req.json());

    const data: Record<string, string> = {};
    if (body.deepseekApiKey !== undefined) data.deepseekApiKey = body.deepseekApiKey;
    if (body.username) data.username = body.username;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    }

    await prisma.user.update({ where: { id: payload.sub }, data });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: '参数错误', details: err.issues }, { status: 422 });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
