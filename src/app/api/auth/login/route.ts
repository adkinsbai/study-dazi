import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { signAccessToken, signRefreshToken, cleanupRefreshTokens } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, '请输入密码'),
});

export async function POST(req: NextRequest) {
  try {
    const body = LoginSchema.parse(await req.json());

    // 速率限制：同一邮箱 15 分钟最多 10 次尝试
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateKey = `login:${ip}:${body.email}`;
    const { allowed, retryAfterSec } = checkRateLimit(rateKey, 10, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: `登录尝试过于频繁，请 ${retryAfterSec} 秒后再试` },
        { status: 429 },
      );
    }

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
    }
    if (!user.emailVerified) {
      return NextResponse.json({ error: '请先验证邮箱' }, { status: 403 });
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
    }

    const accessToken = await signAccessToken({
      sub: user.id, email: user.email, emailVerified: true,
    });

    const refreshToken = await signRefreshToken({ sub: user.id });
    const tokenHash = await bcrypt.hash(refreshToken, 10);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    // 清理过期/废弃 token，防止 DB 膨胀
    cleanupRefreshTokens(user.id).catch(() => {});

    const response = NextResponse.json({
      token: accessToken,
      user: { id: user.id, username: user.username, email: user.email, emailVerified: true, avatarUrl: user.avatarUrl },
    });

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: '参数错误', details: err.issues }, { status: 422 });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
