/**
 * AI Provider 注册表
 */

export type APIFormat = 'openai' | 'anthropic';

export interface AIProviderConfig {
  name: string;
  baseUrl: string;
  model: string;
  getKeyUrl: string;
  placeholder: string;
  customizableUrl?: boolean;
  format?: APIFormat; // 默认 'openai'
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
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    model: 'mimo-v2.5-pro',
    getKeyUrl: 'https://mimo.xiaomi.com',
    placeholder: 'tp-...',
    customizableUrl: true,
  },
  openai: {
    name: 'OpenAI GPT',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    getKeyUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...',
  },
  'openai-relay': {
    name: 'GPT 中转站',
    baseUrl: '',
    model: 'gpt-5.5',
    getKeyUrl: '',
    placeholder: 'sk-...',
    customizableUrl: true,
  },
};

export const DEFAULT_PROVIDER = 'deepseek';

export function getProviderConfig(provider: string, customBaseUrl?: string): AIProviderConfig {
  const config = AI_PROVIDERS[provider];
  if (!config) {
    throw new Error(`不支持的 AI 模型: ${provider}。可选: ${Object.keys(AI_PROVIDERS).join(', ')}`);
  }
  if (customBaseUrl) {
    return { ...config, baseUrl: customBaseUrl };
  }
  return config;
}
