/**
 * 轻量级内存速率限制器。
 * 适用场景：开发 / 单实例部署 / 低流量。
 * 注意：Serverless 多实例环境下不共享状态，需切换到 Redis 方案。
 */

interface Entry {
  count: number;
  resetAt: number; // epoch ms
}

const store = new Map<string, Entry>();

// 每 5 分钟清理一次过期条目
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

/**
 * @param key      唯一标识（如 `${ip}:${action}`）
 * @param max      窗口内最大请求数
 * @param windowMs 窗口大小（毫秒）
 * @returns { allowed: boolean; remaining: number; retryAfterSec: number }
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    // 新窗口
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, retryAfterSec: 0 };
  }

  entry.count++;
  if (entry.count > max) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  return { allowed: true, remaining: max - entry.count, retryAfterSec: 0 };
}
