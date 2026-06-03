/**
 * 统一 AI 调用接口
 * 支持 OpenAI 和 Anthropic 两种 API 格式
 */

import { getProviderConfig, type AIProviderConfig } from './ai-providers';

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
    const text = await res.text().catch(() => '');
    let msg = `API error: ${res.status}`;
    try {
      const err = JSON.parse(text);
      msg = err.error?.message || err.message || msg;
    } catch {
      if (text) msg = `${msg} — ${text.slice(0, 200)}`;
    }
    throw new Error(msg);
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

// ── 流式调用 ──────────────────────────────────────────────────────────

/** 流式调用 AI，返回逐 token 的 ReadableStream */
export async function chatCompletionStream(
  provider: string,
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number; baseUrl?: string; stop?: string[] }
): Promise<ReadableStream<string>> {
  const config = getProviderConfig(provider, options?.baseUrl);

  if (!config.baseUrl) {
    throw new Error(`请先在设置中配置 ${config.name} 的接口地址`);
  }

  const format = config.format || 'openai';

  if (format === 'anthropic') {
    return chatAnthropicStream(config, apiKey, systemPrompt, userMessage, options);
  }
  return chatOpenAIStream(config, apiKey, systemPrompt, userMessage, options);
}

/** OpenAI 兼容格式流式 */
async function chatOpenAIStream(
  config: AIProviderConfig, apiKey: string,
  systemPrompt: string, userMessage: string,
  options?: { temperature?: number; maxTokens?: number; stop?: string[] }
): Promise<ReadableStream<string>> {
  const reqBody: Record<string, unknown> = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: options?.temperature ?? 0.1,
    max_tokens: options?.maxTokens ?? 2048,
    stream: true,
  };
  if (options?.stop) reqBody.stop = options.stop;

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(reqBody),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = `API error: ${res.status}`;
    try {
      const err = JSON.parse(text);
      msg = err.error?.message || err.message || msg;
    } catch {
      if (text) msg = `${msg} — ${text.slice(0, 200)}`;
    }
    throw new Error(msg);
  }

  const body = res.body;
  if (!body) throw new Error('No response body');

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return new ReadableStream<string>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const payload = trimmed.slice(6);
          if (payload === '[DONE]') {
            controller.close();
            return;
          }
          try {
            const json = JSON.parse(payload);
            const content = json.choices?.[0]?.delta?.content;
            if (content) controller.enqueue(content);
          } catch {
            // skip malformed lines
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

/** Anthropic 格式流式 */
async function chatAnthropicStream(
  config: AIProviderConfig, apiKey: string,
  systemPrompt: string, userMessage: string,
  options?: { temperature?: number; maxTokens?: number; stop?: string[] }
): Promise<ReadableStream<string>> {
  const reqBody: Record<string, unknown> = {
    model: config.model,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    temperature: options?.temperature ?? 0.1,
    max_tokens: options?.maxTokens ?? 2048,
    stream: true,
  };
  if (options?.stop) reqBody.stop_sequences = options.stop;

  const res = await fetch(`${config.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(reqBody),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${res.status}`);
  }

  const body = res.body;
  if (!body) throw new Error('No response body');

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return new ReadableStream<string>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(trimmed.slice(6));
            if (json.type === 'content_block_delta' && json.delta?.text) {
              controller.enqueue(json.delta.text);
            }
            if (json.type === 'message_stop') {
              controller.close();
              return;
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}
