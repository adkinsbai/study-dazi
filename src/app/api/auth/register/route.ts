import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { sendVerificationCode } from '@/lib/email';

const RegisterSchema = z.object({
  username: z
    .string()
    .min(2, '用户名至少 2 个字符')
    .max(30, '用户名最多 30 个字符')
    .regex(/^[a-zA-Z0-9_\u4e00-\u9fff]+$/, '用户名只能包含中英文、数字和下划线'),
  email: z.string().email('请输入有效邮箱'),
  password: z
    .string()
    .min(8, '密码至少 8 位')
    .regex(/[a-z]/, '密码需包含至少一个小写字母')
    .regex(/[A-Z]/, '密码需包含至少一个大写字母')
    .regex(/[0-9]/, '密码需包含至少一个数字'),
});

export async function POST(req: NextRequest) {
  try {
    const body = RegisterSchema.parse(await req.json());

    // 清理过期未验证的旧账号（避免验证码永久残留在 DB）
    const expiredUnverified = await prisma.user.findFirst({
      where: {
        email: body.email,
        emailVerified: false,
        verificationCodeExpiresAt: { lt: new Date() },
      },
    });
    if (expiredUnverified) {
      await prisma.user.delete({ where: { id: expiredUnverified.id } });
    }

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing?.emailVerified) {
      return NextResponse.json({ error: '该邮箱已注册' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // 检查用户名（仅在首次注册时）
    if (body.username) {
      const usernameTaken = await prisma.user.findUnique({ where: { username: body.username } });
      if (usernameTaken && usernameTaken.email !== body.email) {
        return NextResponse.json({ error: '该用户名已被使用' }, { status: 409 });
      }
    }

    // 新建或更新未验证用户，验证码存入 DB
    // 注意：update 时不修改 username，防止劫持
    const updateData: Record<string, unknown> = {
      passwordHash,
      verificationCode: code,
      verificationCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verificationAttempts: 0,
    };

    await prisma.user.upsert({
      where: { email: body.email },
      update: updateData,
      create: {
        email: body.email,
        username: body.username,
        passwordHash,
        emailVerified: false,
        verificationCode: code,
        verificationCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    let emailSent = false;
    try {
      await sendVerificationCode(body.email, code);
      emailSent = true;
    } catch {
      // Resend 失败则降级为页面显示
    }

    return NextResponse.json({
      success: true,
      message: emailSent ? `验证码已发送至 ${body.email}` : `验证码：${code}`,
      code: emailSent ? undefined : code,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: '参数校验失败', details: err.issues }, { status: 422 });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
