-- ============================================
-- Supabase RLS 安全修复
-- 解决: rls_disabled_in_public 和 sensitive_columns_exposed
-- ============================================

-- 1. 为所有表启用 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_node_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_buddies ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddy_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddy_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- 2. 用户表策略（保护敏感字段：password_hash, email, verification_code 等）
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id);

-- 3. API Key 表策略（保护 api_key 字段）
CREATE POLICY "Users can manage own api keys" ON user_api_keys
  FOR ALL USING (auth.uid()::text = user_id);

-- 4. 刷新令牌策略（保护 token_hash 字段）
CREATE POLICY "Users can manage own tokens" ON refresh_tokens
  FOR ALL USING (auth.uid()::text = user_id);

-- 5. 密码重置令牌策略（保护 token_hash 字段）
CREATE POLICY "Users can manage own reset tokens" ON password_reset_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()::text
      AND users.email = password_reset_tokens.email
    )
  );

-- 6. 学习路径策略
CREATE POLICY "Users can manage own paths" ON learning_paths
  FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Public paths are viewable" ON learning_paths
  FOR SELECT USING (is_public = true OR is_template = true);

-- 7. 节点进度策略
CREATE POLICY "Users can manage own progress" ON user_node_progress
  FOR ALL USING (auth.uid()::text = user_id);

-- 8. 打卡记录策略
CREATE POLICY "Users can manage own checkins" ON check_ins
  FOR ALL USING (auth.uid()::text = user_id);

-- 9. 动态策略
CREATE POLICY "Users can manage own posts" ON posts
  FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Public posts are viewable" ON posts
  FOR SELECT USING (visibility = 'public');

-- 10. 好友关系策略
CREATE POLICY "Users can view own friendships" ON friendships
  FOR SELECT USING (auth.uid()::text = from_user_id OR auth.uid()::text = to_user_id);

CREATE POLICY "Users can create friendships" ON friendships
  FOR INSERT WITH CHECK (auth.uid()::text = from_user_id);

CREATE POLICY "Users can update friendships" ON friendships
  FOR UPDATE USING (auth.uid()::text = from_user_id OR auth.uid()::text = to_user_id);

-- 11. 资源策略
CREATE POLICY "Users can manage own resources" ON resources
  FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Public resources are viewable" ON resources
  FOR SELECT USING (visibility = 'public');

-- 12. 点赞策略
CREATE POLICY "Users can manage own likes" ON likes
  FOR ALL USING (auth.uid()::text = user_id);

-- 13. 学习伙伴策略
CREATE POLICY "Users can view own study buddies" ON study_buddies
  FOR SELECT USING (auth.uid()::text = from_user_id OR auth.uid()::text = to_user_id);

CREATE POLICY "Users can create study buddies" ON study_buddies
  FOR INSERT WITH CHECK (auth.uid()::text = from_user_id);

CREATE POLICY "Users can update study buddies" ON study_buddies
  FOR UPDATE USING (auth.uid()::text = from_user_id OR auth.uid()::text = to_user_id);

-- 14. 学习小组策略
CREATE POLICY "Creators can manage groups" ON buddy_groups
  FOR ALL USING (auth.uid()::text = created_by);

CREATE POLICY "Members can view groups" ON buddy_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM buddy_group_members
      WHERE group_id = id AND user_id = auth.uid()::text
    )
  );

-- 15. 小组成员策略
CREATE POLICY "Group members are viewable" ON buddy_group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM buddy_group_members bgm
      WHERE bgm.group_id = group_id AND bgm.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Creators can manage members" ON buddy_group_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM buddy_groups
      WHERE id = group_id AND created_by = auth.uid()::text
    )
  );

-- 16. 消息策略
CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (auth.uid()::text = from_user_id OR auth.uid()::text = to_user_id);

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid()::text = from_user_id);

CREATE POLICY "Users can update own messages" ON messages
  FOR UPDATE USING (auth.uid()::text = to_user_id);

-- 17. 通知策略
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid()::text = user_id);

-- 18. 评论策略
CREATE POLICY "Users can manage own comments" ON node_comments
  FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Comments are viewable" ON node_comments
  FOR SELECT USING (true);

-- 19. 推送订阅策略
CREATE POLICY "Users can manage own push subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid()::text = user_id);
