-- Study-DaZi: 资源库 + 节点关联 迁移脚本
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴执行
-- 执行顺序：先执行此脚本，再部署新代码

-- 1. 创建 resource_index 表
CREATE TABLE IF NOT EXISTS resource_index (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  platform        TEXT NOT NULL,
  external_id     TEXT,
  title           TEXT NOT NULL,
  url             TEXT NOT NULL,
  instructor      TEXT,
  thumbnail       TEXT,
  duration        INTEGER,
  language        TEXT,
  difficulty      TEXT,
  domain          TEXT NOT NULL,
  tags            JSONB DEFAULT '[]'::jsonb,
  rating          DOUBLE PRECISION,
  view_count      INTEGER DEFAULT 0,
  is_free         BOOLEAN DEFAULT true,
  last_checked    TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_resource_index_domain_difficulty ON resource_index(domain, difficulty);
CREATE INDEX IF NOT EXISTS idx_resource_index_platform_domain ON resource_index(platform, domain);
CREATE INDEX IF NOT EXISTS idx_resource_index_domain ON resource_index(domain);
CREATE INDEX IF NOT EXISTS idx_resource_index_tags ON resource_index USING gin(tags);

-- 3. 创建 node_resources 表
CREATE TABLE IF NOT EXISTS node_resources (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  path_id      TEXT NOT NULL,
  node_id      TEXT NOT NULL,
  resource_id  TEXT NOT NULL REFERENCES resource_index(id) ON DELETE CASCADE,
  relevance    DOUBLE PRECISION DEFAULT 0,
  added_by     TEXT DEFAULT 'ai'
);

-- 4. 唯一约束和索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_node_resources_unique ON node_resources(node_id, resource_id);
CREATE INDEX IF NOT EXISTS idx_node_resources_path_node ON node_resources(path_id, node_id);

-- 5. 关闭 RLS（API 层已做 JWT 鉴权）
ALTER TABLE resource_index DISABLE ROW LEVEL SECURITY;
ALTER TABLE node_resources DISABLE ROW LEVEL SECURITY;
