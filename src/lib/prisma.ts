import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function appendSearchParam(url: string, key: string, value: string) {
  if (!url || new RegExp(`[?&]${key}=`).test(url)) return url;
  const [withoutHash, hash] = url.split('#', 2);
  const sep = withoutHash.includes('?') ? '&' : '?';
  return `${withoutHash}${sep}${key}=${encodeURIComponent(value)}${hash ? `#${hash}` : ''}`;
}

function getDbUrl() {
  let base = process.env.DATABASE_URL || '';
  const usesSupabaseTransactionPooler = base.includes('.pooler.supabase.com:6543');

  if (usesSupabaseTransactionPooler || process.env.PRISMA_PGBOUNCER === 'true') {
    base = appendSearchParam(base, 'pgbouncer', 'true');
  }

  // serverless（Vercel / Lambda）每个函数实例只需 1 个连接
  // 传统服务器则保留默认连接池以支持并发
  const isServerless = !!(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.IS_SERVERLESS
  );
  if (!isServerless) return base; // 开发/传统部署用 DATABASE_URL 原样
  return appendSearchParam(
    appendSearchParam(base, 'connection_limit', '1'),
    'pool_timeout',
    '20',
  );
}

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error'],
  datasourceUrl: getDbUrl(),
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
