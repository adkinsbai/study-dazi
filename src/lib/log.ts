/**
 * 条件打印：仅开发环境输出，生产环境静默。
 * 避免 catch 块完全静默掩盖 bug。
 */

/** API 错误需要进入生产日志，便于定位 Vercel/serverless 500。 */
export const logError = (...args: unknown[]) => console.error('[API Error]', ...args);

/** 开发环境 console.warn，生产环境 noop */
export const logWarn = process.env.NODE_ENV !== 'production'
  ? (...args: unknown[]) => console.warn('[API Warn]', ...args)
  : () => {};
