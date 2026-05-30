const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';

export async function chatWithDeepSeek(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      // deepseek-chat = deepseek-v4-flash 非推理模式（最快最便宜）
      // deepseek-reasoner = deepseek-v4-flash 推理模式
      // deepseek-v4-pro = 旗舰模型（更强但更贵更慢，需要时切换）
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: options?.temperature ?? 0.1,
      max_tokens: options?.maxTokens ?? 1200,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `DeepSeek API error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}
