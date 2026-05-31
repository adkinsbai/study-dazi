import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function getDbUrl() {
  const base = process.env.DATABASE_URL || '';
  // serverless（Vercel / Lambda）每个函数实例只需 1 个连接
  // 传统服务器则保留默认连接池以支持并发
  const isServerless = !!(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.IS_SERVERLESS
  );
  if (!isServerless) return base; // 开发/传统部署用 DATABASE_URL 原样
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}connection_limit=1&pool_timeout=20`;
}

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error'],
  datasourceUrl: getDbUrl(),
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
