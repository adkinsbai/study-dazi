/**
 * 向后兼容的 DeepSeek 调用
 * 内部委托给统一的 chatCompletion 接口
 */

import { chatCompletion } from './ai';

export async function chatWithDeepSeek(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  return chatCompletion('deepseek', apiKey, systemPrompt, userMessage, options);
}
