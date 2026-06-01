/**
 * 统一 AI 调用接口
 * 所有 provider 兼容 OpenAI /v1/chat/completions 格式
 */

import { getProviderConfig } from './ai-providers';

export async function chatCompletion(
  provider: string,
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const config = getProviderConfig(provider);

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: options?.temperature ?? 0.1,
      max_tokens: options?.maxTokens ?? 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `${config.name} API error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}
