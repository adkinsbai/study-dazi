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
      select: { id: true, username: true, email: true, avatarUrl: true, bio: true, deepseekApiKey: true },
    });

    // 获取用户已配置的 provider 列表
    const apiKeys = await prisma.userApiKey.findMany({
      where: { userId: payload.sub },
      select: { provider: true, createdAt: true },
    });

    return NextResponse.json({
      id: user?.id, username: user?.username, email: user?.email,
      avatarUrl: user?.avatarUrl, bio: user?.bio,
      // 兼容旧字段：如果 UserApiKey 表有 deepseek 就返回 true，否则检查旧字段
      deepseekApiKey: apiKeys.some(k => k.provider === 'deepseek') || !!user?.deepseekApiKey,
      apiKeys: apiKeys.map(k => ({ provider: k.provider, configured: true })),
    });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

const PatchSchema = z.object({
  // 新格式：多 provider
  provider: z.string().optional(),
  apiKey: z.string().optional(),
  // 旧格式兼容
  deepseekApiKey: z.string().optional(),
  // 其他字段
  username: z.string().min(2).max(30).optional(),
  avatarUrl: z.string().optional(),
  bio: z.string().max(200).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const body = PatchSchema.parse(await req.json());

    // 新格式：保存到 UserApiKey 表
    if (body.provider && body.apiKey !== undefined) {
      if (body.apiKey === '') {
        // 删除该 provider 的 key
        await prisma.userApiKey.deleteMany({
          where: { userId: payload.sub, provider: body.provider },
        });
      } else {
        // upsert
        await prisma.userApiKey.upsert({
          where: {
            userId_provider: { userId: payload.sub, provider: body.provider },
          },
          update: { apiKey: body.apiKey },
          create: { userId: payload.sub, provider: body.provider, apiKey: body.apiKey },
        });
      }
      return NextResponse.json({ success: true });
    }

    // 旧格式兼容：保存到 User 表
    const data: Record<string, string | null> = {};
    if (body.deepseekApiKey !== undefined) {
      // 同时写入 UserApiKey 表
      if (body.deepseekApiKey === '') {
        await prisma.userApiKey.deleteMany({
          where: { userId: payload.sub, provider: 'deepseek' },
        });
      } else {
        await prisma.userApiKey.upsert({
          where: {
            userId_provider: { userId: payload.sub, provider: 'deepseek' },
          },
          update: { apiKey: body.deepseekApiKey },
          create: { userId: payload.sub, provider: 'deepseek', apiKey: body.deepseekApiKey },
        });
      }
      data.deepseekApiKey = body.deepseekApiKey;
    }
    if (body.username) data.username = body.username;
    if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl || null;
    if (body.bio !== undefined) data.bio = body.bio || null;

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
