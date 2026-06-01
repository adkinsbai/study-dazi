/**
 * AI Provider 注册表
 * 所有 provider 都兼容 OpenAI /v1/chat/completions 格式
 */

export interface AIProviderConfig {
  name: string;
  baseUrl: string;
  model: string;
  getKeyUrl: string;
  placeholder: string;
}

export const AI_PROVIDERS: Record<string, AIProviderConfig> = {
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    getKeyUrl: 'https://platform.deepseek.com',
    placeholder: 'sk-...',
  },
  mimo: {
    name: '小米 MIMO',
    baseUrl: 'https://api.mimo.xiaomi.com/v1',
    model: 'mimo-v2.5-pro',
    getKeyUrl: 'https://mimo.xiaomi.com',
    placeholder: '...',
  },
  openai: {
    name: 'OpenAI GPT',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    getKeyUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...',
  },
};

export const DEFAULT_PROVIDER = 'deepseek';

export function getProviderConfig(provider: string): AIProviderConfig {
  const config = AI_PROVIDERS[provider];
  if (!config) {
    throw new Error(`不支持的 AI 模型: ${provider}。可选: ${Object.keys(AI_PROVIDERS).join(', ')}`);
  }
  return config;
}
