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
  customizableUrl?: boolean; // 支持自定义接口地址（中转站）
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
  'openai-relay': {
    name: 'GPT 中转站',
    baseUrl: '', // 用户自定义
    model: 'gpt-4o-mini',
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
  // 中转站使用用户自定义 URL
  if (customBaseUrl) {
    return { ...config, baseUrl: customBaseUrl };
  }
  return config;
}
