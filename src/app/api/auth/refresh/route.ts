import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { verifyRefreshToken, signAccessToken, signRefreshToken, cleanupRefreshTokens } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const cookie = req.cookies.get('refresh_token');
    if (!cookie?.value) {
      return NextResponse.json({ error: '未提供 refresh token' }, { status: 401 });
    }

    let payload: { sub: string };
    try {
      payload = await verifyRefreshToken(cookie.value);
    } catch {
      return NextResponse.json({ error: 'refresh token 无效或已过期' }, { status: 401 });
    }

    // 查找有效的 refresh token 记录
    const tokens = await prisma.refreshToken.findMany({
      where: { userId: payload.sub, revoked: false },
      orderBy: { createdAt: 'desc' },
    });

    let matchedToken: typeof tokens[0] | undefined;
    for (const t of tokens) {
      if (await bcrypt.compare(cookie.value, t.tokenHash)) {
        matchedToken = t;
        break;
      }
    }

    if (!matchedToken) {
      return NextResponse.json({ error: 'refresh token 已失效' }, { status: 401 });
    }
    if (new Date() > matchedToken.expiresAt) {
      return NextResponse.json({ error: 'refresh token 已过期' }, { status: 401 });
    }

    // 作废旧 token
    await prisma.refreshToken.update({
      where: { id: matchedToken.id },
      data: { revoked: true },
    });

    // 获取用户信息
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 401 });
    }

    // 签发新 token
    const accessToken = await signAccessToken({
      sub: user.id, email: user.email, emailVerified: user.emailVerified,
    });

    const newRefreshToken = await signRefreshToken({ sub: user.id });
    const tokenHash = await bcrypt.hash(newRefreshToken, 10);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    // 清理过期/废弃 token，防止 DB 膨胀
    cleanupRefreshTokens(user.id).catch(() => {});

    const response = NextResponse.json({ token: accessToken });

    response.cookies.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
