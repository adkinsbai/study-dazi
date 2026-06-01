# Study-DaZi 开发进度报告

> 最后更新：2026-05-31
> 本文件记录项目当前状态、已完成功能、待办事项。每次功能开发/bug修复后由 Claude 自动维护。

---

## 部署信息

| 项目 | 值 |
|------|-----|
| **GitHub** | https://github.com/tjusaltedfish/study-dazi |
| **域名** | studydazi.top |
| **部署方式** | 推送 master 分支 → Vercel 自动部署 |
| **Vercel Dashboard** | https://vercel.com/tjusaltedfishs-projects/study-dazi |
| **数据库** | PostgreSQL (Supabase, 项目 ID: zwyhqfwnnennosjooudl) |
| **Pooler 地址** | aws-1-ap-southeast-1.pooler.supabase.com:6543 |
| **ORM** | Prisma 5, Schema: prisma/schema.prisma |

### 环境变量 (Vercel Dashboard)

| Name | 用途 |
|------|------|
| `DATABASE_URL` | Supabase 连接串 |
| `JWT_SECRET` | Access Token 签名密钥 |
| `JWT_REFRESH_SECRET` | Refresh Token 签名密钥 |
| `DEEPSEEK_API_KEY` | AI 路径生成 |
| `RESEND_API_KEY` | 邮件发送（验证码） |
| `EMAIL_FROM` | 发件人地址 |
| `VAPID_PUBLIC_KEY` | Web Push VAPID 公钥 |
| `VAPID_PRIVATE_KEY` | Web Push VAPID 私钥 |
| `NEXT_PUBLIC_VAPID_KEY` | 前端 Push 订阅用 |

### 修改 Schema 后的流程

1. 改 `prisma/schema.prisma` 后**不能直接部署**
2. 先提供 SQL → 去 Supabase Dashboard → SQL Editor 执行
3. 所有新表必须执行 `ALTER TABLE xxx DISABLE ROW LEVEL SECURITY;`
4. Prisma Client 在 Vercel 构建时通过 `postinstall` 钩子自动生成

---

## 项目概况

| 项目 | 值 |
|------|-----|
| **技术栈** | Next.js 16 + React 19 + Tailwind 4 + Prisma 5 + Zustand 5 |
| **源文件数** | 74 个 (.tsx/.ts) |
| **API 路由** | 38 个 |
| **最新 commit** | `dc0f68d` fix: show password requirements on register page (2026-05-31) |

---

## 已完成功能

### 🔐 认证系统
- [x] 邮箱注册 + 验证码激活 (Resend 邮件)
- [x] 注册页密码格式提示
- [x] 邮箱登录 / 退出
- [x] 忘记密码 + 重置密码
- [x] JWT Access + Refresh Token 双 Token 机制
- [x] Zustand 前端状态管理
- [x] 页面加载时自动恢复登录态 (AuthProvider)

### 📚 学习路径
- [x] AI 生成学习路径框架 (DeepSeek API)
- [x] AI 展开子节点
- [x] 技能树递归渲染 (tree-renderer.tsx)
- [x] 节点详情侧边抽屉 (node-drawer.tsx)
- [x] 节点进度更新 / 自动父节点状态
- [x] 路径 CRUD + 模板广场 + Fork
- [x] 进度条组件

### 👥 社交系统
- [x] 好友系统 (发送请求/接受/删除)
- [x] 搭子匹配 (邀请/接受/领域标签/群组)
- [x] 搭子看板 + 催更
- [x] 共享路径
- [x] 私信系统
- [x] 通知系统 (未读计数)
- [x] 用户搜索

### 🌍 广场 (Explore)
- [x] 动态发布 / 资源分享 / 评论 / 点赞
- [x] 广场聚合 API

### ✅ 打卡系统
- [x] 每日打卡 + 连续天数 + 热力图

### 🎨 UI / 设计
- [x] Coral 暖色主色调 (#f97066) 替换 indigo
- [x] DESIGN.md 设计规范 + PRODUCT.md 产品战略
- [x] Logo 重设计 (渐变 DaZi)
- [x] 流动渐变条纹背景 (Stripe 风格)
- [x] 路径详情页动画 (card lift, stagger, heart pop)
- [x] 无障碍优化 (aria-label, role, emoji aria-hidden)
- [x] 响应式布局

### ⚡ PWA
- [x] manifest.json + Service Worker
- [x] PWA 安装提示 + Web Push 订阅

### 🔧 工程化
- [x] Prisma schema + 迁移
- [x] Serverless 连接池适配
- [x] 内存速率限制器 / 条件日志 / Zod 验证
- [x] Vitest 测试 (auth, deepseek, verify-code-store, path-generation)

---

## 近期改动 (2026-05-31)

按时间倒序，只列最终状态：

1. **fix: show password requirements on register page** — 注册页显示密码格式要求
2. **fix: buddy groups, progress calc, notification badges** — 搭子群组、进度计算、通知徽章修复
3. **fix: tooltip layout, explore comments/likes, notifications** — 工具提示、广场评论点赞、通知修复
4. **fix: template detail click, avatar display, nav tooltips, logo redesign** — 模板点击、头像显示、导航提示、Logo 重设计
5. **feat: flowing gradient stripe background** — Stripe 风格渐变条纹背景
6. **feat: polish path detail + buddies pages** — 路径详情和搭子页面打磨
7. **feat: add purposeful animations** — 卡片浮起、列表错位、心形弹出、按钮按压动画
8. **feat: coral UI redesign** — indigo → coral 主色调，stat 卡片重设计，无障碍优化

---

## 已知问题 / 待办

### P3 (优化项)
- [ ] 其他页面 (login, register, explore, friends, messages, notifications, settings) 统一 coral 色系
- [ ] 全局字体 Arial fallback 应改为 system-ui
- [ ] 导航栏 9 个 items 过多，考虑分组
- [ ] layout.tsx 的渐变文字 Logo (bg-clip-text) 违反 Impeccable 绝对禁令，需改为纯色

---

## 下一步计划

1. 推广 coral 色系到全站子页面
2. `/impeccable polish` 全站统一间距对齐
3. `/impeccable animate` 关键交互加动效 (配合 GSAP skills)

---

## 设计规范速查

| Token | 值 | 用途 |
|-------|-----|------|
| Primary | #f97066 | CTA、打卡、重要操作 |
| Primary Deep | #e0524a | hover/active |
| Accent | #6366f1 | 链接、focus ring |
| Success | #10b981 | 打卡完成 |
| Neutral Bg | #fafaf9 | 页面底色 |
| Card Radius | 18px (rounded-2xl) | 卡片圆角 |
| Button Radius | 9999px (rounded-full) | 按钮圆角 |
