/**
 * 统一 AI 调用接口
 * 支持 OpenAI 和 Anthropic 两种 API 格式
 */

import { getProviderConfig } from './ai-providers';

export async function chatCompletion(
  provider: string,
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number; baseUrl?: string }
): Promise<string> {
  const config = getProviderConfig(provider, options?.baseUrl);

  if (!config.baseUrl) {
    throw new Error(`请先在设置中配置 ${config.name} 的接口地址`);
  }

  const format = config.format || 'openai';

  if (format === 'anthropic') {
    return chatAnthropic(config.baseUrl, apiKey, config.model, systemPrompt, userMessage, options);
  }
  return chatOpenAI(config.baseUrl, apiKey, config.model, systemPrompt, userMessage, options);
}

/** OpenAI 兼容格式: POST /chat/completions */
async function chatOpenAI(
  baseUrl: string, apiKey: string, model: string,
  systemPrompt: string, userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
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
    throw new Error(err.error?.message || `API error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

/** Anthropic 格式: POST /v1/messages */
async function chatAnthropic(
  baseUrl: string, apiKey: string, model: string,
  systemPrompt: string, userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage },
      ],
      temperature: options?.temperature ?? 0.1,
      max_tokens: options?.maxTokens ?? 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${res.status}`);
  }

  const data = await res.json();
  return data.content[0].text;
}
