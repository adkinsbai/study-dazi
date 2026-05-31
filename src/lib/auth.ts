import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * 清理用户的废弃/过期 refresh token，防止 DB 无限膨胀。
 * - 删除所有已过期的 token
 * - 已撤销的 token 只保留最近 5 条（多余的删掉）
 */
export async function cleanupRefreshTokens(userId: string): Promise<void> {
  const now = new Date();
  // 删除所有过期 token
  await prisma.refreshToken.deleteMany({
    where: { userId, expiresAt: { lt: now } },
  });
  // 已撤销的只保留最近 5 条
  const revoked = await prisma.refreshToken.findMany({
    where: { userId, revoked: true },
    orderBy: { createdAt: 'desc' },
    skip: 5,
    select: { id: true },
  });
  if (revoked.length > 0) {
    await prisma.refreshToken.deleteMany({
      where: { id: { in: revoked.map((r) => r.id) } },
    });
  }
}

const jwtSecret = process.env.JWT_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET;

if (!jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET is required in production');
}
if (!refreshSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_REFRESH_SECRET is required in production');
}

const SECRET = new TextEncoder().encode(
  jwtSecret || 'dev-secret-change-in-production-32bytes-minimum!!'
);
const REFRESH_SECRET = new TextEncoder().encode(
  refreshSecret || 'dev-refresh-secret-change-in-production-32bytes-minimum!!'
);

export interface AccessTokenPayload {
  sub: string;
  email: string;
  emailVerified: boolean;
}

const AccessTokenPayloadSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
});

export interface RefreshTokenPayload {
  sub: string;
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15min')
    .sign(SECRET);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, SECRET);
  return AccessTokenPayloadSchema.parse(payload);
}

export async function signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(REFRESH_SECRET);
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, REFRESH_SECRET);
  return payload as unknown as RefreshTokenPayload;
}

/**
 * 从请求头中提取 Bearer token 并验证，返回 payload。
 * 失败时返回 NextResponse（可直接在 route handler 中 return）。
 * 用法：
 *   const auth = await authenticate(req);
 *   if (auth instanceof NextResponse) return auth;
 *   // auth.sub 即为 userId
 */
export async function authenticate(
  req: NextRequest,
): Promise<AccessTokenPayload | NextResponse> {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }
  try {
    return await verifyAccessToken(header.slice(7));
  } catch {
    return NextResponse.json({ error: 'token 无效或已过期' }, { status: 401 });
  }
}
