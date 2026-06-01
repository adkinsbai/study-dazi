-- 多模型支持：新建 user_api_keys 表
-- 执行位置：Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS user_api_keys (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider   TEXT NOT NULL,  -- deepseek | mimo | openai
  api_key    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);

-- RLS 关闭（API 层已做 JWT 鉴权）
ALTER TABLE user_api_keys DISABLE ROW LEVEL SECURITY;
