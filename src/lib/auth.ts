import { SignJWT, jwtVerify } from 'jose';

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
  return payload as unknown as AccessTokenPayload;
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
