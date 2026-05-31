/**
 * 条件打印：仅开发环境输出，生产环境静默。
 * 避免 catch { /* ignore */ } 完全掩盖 bug。
 */

const isDev = process.env.NODE_ENV !== 'production';

/** 开发环境 console.error，生产环境 noop */
export const logError = isDev
  ? (...args: unknown[]) => console.error('[API Error]', ...args)
  : () => {};

/** 开发环境 console.warn，生产环境 noop */
export const logWarn = isDev
  ? (...args: unknown[]) => console.warn('[API Warn]', ...args)
  : () => {};
