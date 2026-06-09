import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { sendVerificationCode } from '@/lib/email';

const ResendSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
});

export async function POST(req: NextRequest) {
  try {
    const { email } = ResendSchema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal whether email exists
      return NextResponse.json({ success: true, message: '如果该邮箱已注册，验证码已发送' });
    }

    if (user.emailVerified) {
      return NextResponse.json({ success: true, message: '该邮箱已验证' });
    }

    // Rate limit: check last attempt time
    if (user.verificationCodeExpiresAt) {
      const minResendTime = new Date(user.verificationCodeExpiresAt.getTime() - 9 * 60 * 1000);
      if (new Date() < minResendTime) {
        const waitSec = Math.ceil((minResendTime.getTime() - Date.now()) / 1000);
        return NextResponse.json({ error: `请等待 ${waitSec} 秒后再试` }, { status: 429 });
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));

    await prisma.user.update({
      where: { email },
      data: {
        verificationCode: code,
        verificationCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        verificationAttempts: 0,
      },
    });

    let emailSent = false;
    try {
      await sendVerificationCode(email, code);
      emailSent = true;
    } catch {
      // Resend failed
    }

    if (!emailSent) {
      return NextResponse.json({
        success: false,
        message: '验证码发送失败，请稍后重试',
      }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: `验证码已重新发送至 ${email}`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: '参数校验失败' }, { status: 422 });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
