-- 多模型支持：新建 user_api_keys 表
-- 执行位置：Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS user_api_keys (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider   TEXT NOT NULL,  -- deepseek | mimo | openai | openai-relay
  api_key    TEXT NOT NULL,
  base_url   TEXT,           -- 中转站自定义接口地址
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);

-- RLS 关闭（API 层已做 JWT 鉴权）
ALTER TABLE user_api_keys DISABLE ROW LEVEL SECURITY;

-- 如果已执行过旧版迁移，加上 base_url 列
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS base_url TEXT;
