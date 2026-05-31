import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, email: true, emailVerified: true, avatarUrl: true },
    });

    if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
