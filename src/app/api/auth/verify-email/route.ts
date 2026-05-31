import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { signAccessToken, signRefreshToken, cleanupRefreshTokens } from '@/lib/auth';

const VerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, '验证码为 6 位数字'),
});

export async function POST(req: NextRequest) {
  try {
    const body = VerifySchema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      return NextResponse.json({ error: '请先注册再验证' }, { status: 400 });
    }
    if (user.emailVerified) {
      return NextResponse.json({ error: '该邮箱已验证' }, { status: 400 });
    }

    // 检查验证码过期
    if (!user.verificationCodeExpiresAt || new Date() > user.verificationCodeExpiresAt) {
      return NextResponse.json({ error: '验证码已过期，请重新注册' }, { status: 400 });
    }

    // 检查尝试次数
    if (user.verificationAttempts >= 5) {
      return NextResponse.json({ error: '验证码错误次数过多，请重新注册' }, { status: 400 });
    }

    // 验证码不匹配
    if (user.verificationCode !== body.code) {
      await prisma.user.update({
        where: { email: body.email },
        data: { verificationAttempts: { increment: 1 } },
      });
      return NextResponse.json({ error: '验证码错误' }, { status: 400 });
    }

    // 验证成功
    await prisma.user.update({
      where: { email: body.email },
      data: {
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpiresAt: null,
      },
    });

    const updatedUser = await prisma.user.findUnique({ where: { email: body.email } });
    if (!updatedUser) {
      return NextResponse.json({ error: '用户不存在' }, { status: 500 });
    }

    const accessToken = await signAccessToken({
      sub: updatedUser.id, email: updatedUser.email, emailVerified: true,
    });

    const refreshToken = await signRefreshToken({ sub: updatedUser.id });
    const tokenHash = await bcrypt.hash(refreshToken, 10);

    await prisma.refreshToken.create({
      data: {
        userId: updatedUser.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    cleanupRefreshTokens(updatedUser.id).catch(() => {});

    const response = NextResponse.json({
      token: accessToken,
      user: { id: updatedUser.id, username: updatedUser.username, email: updatedUser.email, emailVerified: true, avatarUrl: updatedUser.avatarUrl },
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
      return NextResponse.json({ error: '参数校验失败', details: err.issues }, { status: 422 });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}


