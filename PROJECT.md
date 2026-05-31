# Study-DaZi 项目文档

## 部署信息

| 项目 | 值 |
|------|-----|
| **GitHub** | https://github.com/tjusaltedfish/study-dazi |
| **域名** | studydazi.top |
| **部署方式** | 推送 master 分支 → Vercel 自动部署 |
| **项目根目录** | study-dazi/ |
| **启动命令** | `npm run dev` |

## 数据库

| 项目 | 值 |
|------|-----|
| **类型** | PostgreSQL (Supabase) |
| **项目 ID** | zwyhqfwnnennosjooudl |
| **Pooler 地址** | aws-1-ap-southeast-1.pooler.supabase.com:6543 |
| **ORM** | Prisma 5 |
| **Schema** | prisma/schema.prisma |

### 修改 Schema 后的流程

1. 改 `prisma/schema.prisma` 后**不能直接部署**
2. 先提供 SQL → 去 Supabase Dashboard → SQL Editor 执行
3. 所有新表必须执行 `ALTER TABLE xxx DISABLE ROW LEVEL SECURITY;`（API 层已做 JWT 鉴权）
4. Prisma Client 在 Vercel 构建时通过 `postinstall` 钩子自动生成

## 环境变量（Vercel Dashboard 需配置）

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
| `NEXT_PUBLIC_VAPID_KEY` | 前端 Push 订阅用（必须 `NEXT_PUBLIC_` 前缀） |

## 技术栈

| 层 | 选型 |
|----|------|
| 前端框架 | Next.js 16 (App Router) |
| UI 库 | React 19 |
| 样式 | Tailwind CSS 4 |
| 状态管理 | Zustand 5 |
| ORM | Prisma 5 |
| 认证 | JWT（jose 库）+ bcrypt |
| 邮件 | Resend |
| AI | DeepSeek API |
| 推送 | web-push |
| 测试 | Vitest |
| 验证 | Zod 4 |

## 完整目录结构

```
study-dazi/
├── .env                              # 本地环境变量
├── .gitignore
├── AGENTS.md
├── CLAUDE.md
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.js
├── next.config.ts
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── README.md
├── tsconfig.json
├── vercel.json
├── vitest.config.ts
│
├── prisma/
│   ├── dev.db                        # SQLite 开发数据库
│   └── schema.prisma                 # 数据库模型定义
│
├── public/
│   ├── file.svg
│   ├── globe.svg
│   ├── icon-192.png                  # PWA 图标
│   ├── icon-512.png                  # PWA 图标
│   ├── manifest.json                 # PWA 清单
│   ├── next.svg
│   ├── sw.js                         # Service Worker
│   ├── vercel.svg
│   └── window.svg
│
├── scripts/
│   ├── generate-icons.cjs
│   ├── migrate-md.sql
│   ├── migrate.sql
│   └── run-migrate.js
│
├── src/
│   ├── app/
│   │   ├── favicon.ico
│   │   ├── globals.css               # 全局样式
│   │   ├── layout.tsx                # 根布局（字体、PWA meta、AuthProvider）
│   │   ├── page.tsx                  # 首页/仪表盘
│   │   │
│   │   ├── (auth)/                   # 认证页面组
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   ├── reset-password/
│   │   │   │   └── page.tsx
│   │   │   └── verify/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (dashboard)/              # 登录后页面组
│   │   │   ├── layout.tsx            # 共享导航栏
│   │   │   ├── buddies/
│   │   │   │   └── page.tsx          # 搭子看板
│   │   │   ├── explore/
│   │   │   │   └── page.tsx          # 广场（动态/资源/路径）
│   │   │   ├── friends/
│   │   │   │   └── page.tsx          # 好友管理
│   │   │   ├── leaderboard/          # 排行榜（空目录，未实现）
│   │   │   ├── messages/
│   │   │   │   └── page.tsx          # 私信
│   │   │   ├── notifications/
│   │   │   │   └── page.tsx          # 通知
│   │   │   ├── paths/
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx      # 路径详情（技能树）
│   │   │   │   └── new/
│   │   │   │       └── page.tsx      # AI 生成路径
│   │   │   ├── profile/
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx      # 他人主页
│   │   │   │   └── page.tsx          # 我的主页
│   │   │   └── settings/
│   │   │       └── page.tsx          # 设置
│   │   │
│   │   └── api/                      # API 路由
│   │       ├── auth/
│   │       │   ├── forgot-password/route.ts
│   │       │   ├── login/route.ts
│   │       │   ├── logout/route.ts
│   │       │   ├── me/route.ts
│   │       │   ├── refresh/route.ts
│   │       │   ├── register/route.ts
│   │       │   ├── resend-code/route.ts
│   │       │   ├── reset-password/route.ts
│   │       │   └── verify-email/route.ts
│   │       ├── buddies/
│   │       │   ├── board/route.ts
│   │       │   ├── nudge/route.ts
│   │       │   └── route.ts
│   │       ├── buddy-groups/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── nudge/route.ts
│   │       │       └── route.ts
│   │       ├── checkins/route.ts
│   │       ├── comments/route.ts
│   │       ├── explore/route.ts
│   │       ├── friends/
│   │       │   ├── route.ts
│   │       │   └── [id]/route.ts
│   │       ├── leaderboard/          # 排行榜 API（空目录）
│   │       ├── likes/route.ts
│   │       ├── messages/route.ts
│   │       ├── notifications/route.ts
│   │       ├── paths/
│   │       │   ├── route.ts
│   │       │   ├── templates/route.ts
│   │       │   ├── generate/
│   │       │   │   ├── framework/route.ts
│   │       │   │   └── nodes/route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       ├── fork/route.ts
│   │       │       ├── progress/route.ts
│   │       │       └── nodes/[nodeId]/progress/route.ts
│   │       ├── posts/route.ts
│   │       ├── push/route.ts
│   │       ├── resources/route.ts
│   │       ├── upload/route.ts
│   │       └── users/
│   │           ├── [id]/route.ts
│   │           ├── me/route.ts
│   │           └── search/route.ts
│   │
│   ├── components/
│   │   ├── auth-provider.tsx         # 认证 Provider（页面加载时恢复登录态）
│   │   ├── pwa-register.tsx          # PWA 安装提示 + Push 订阅
│   │   ├── checkin/
│   │   │   └── checkin-widget.tsx    # 打卡组件
│   │   ├── path/
│   │   │   ├── tree-renderer.tsx     # 技能树递归渲染（节点锁定逻辑）
│   │   │   └── node-drawer.tsx       # 节点详情侧边抽屉
│   │   └── ui/
│   │       └── progress-bar.tsx      # 通用进度条
│   │
│   ├── lib/
│   │   ├── auth.ts                   # JWT 签名/验证 + authenticate() + Token 清理
│   │   ├── deepseek.ts               # DeepSeek API 调用封装
│   │   ├── email.ts                  # Resend 邮件发送
│   │   ├── extract-json.ts           # AI 返回 JSON 提取（括号计数）
│   │   ├── log.ts                    # 条件日志（开发输出，生产静默）
│   │   ├── path-prompts.ts           # AI 路径生成 Prompt 模板
│   │   ├── prisma.ts                 # Prisma 单例（Serverless 连接池适配）
│   │   ├── push.ts                   # Web Push 发送工具
│   │   ├── rate-limit.ts             # 内存速率限制器
│   │   └── verify-code-store.ts      # 验证码存储
│   │
│   └── stores/
│       └── auth.ts                   # Zustand 认证状态（login/register/refresh/logout）
│
└── tests/
    ├── setup.ts
    ├── integration/
    │   └── path-generation.test.ts
    └── unit/
        ├── auth.test.ts
        ├── deepseek.test.ts
        └── verify-code-store.test.ts
```

## 路由表

### 前端页面

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | page.tsx | 首页/仪表盘（未登录→营销页，已登录→面板） |
| `/login` | (auth)/login/page.tsx | 邮箱登录 |
| `/register` | (auth)/register/page.tsx | 邮箱注册 |
| `/verify` | (auth)/verify/page.tsx | 验证码激活 |
| `/forgot-password` | (auth)/forgot-password/page.tsx | 忘记密码 |
| `/reset-password` | (auth)/reset-password/page.tsx | 重置密码 |
| `/paths/new` | (dashboard)/paths/new/page.tsx | AI 生成路径 |
| `/paths/[id]` | (dashboard)/paths/[id]/page.tsx | 技能树详情 |
| `/explore` | (dashboard)/explore/page.tsx | 广场（动态/资源/路径模板） |
| `/friends` | (dashboard)/friends/page.tsx | 好友管理 |
| `/buddies` | (dashboard)/buddies/page.tsx | 搭子看板 |
| `/messages` | (dashboard)/messages/page.tsx | 私信 |
| `/notifications` | (dashboard)/notifications/page.tsx | 通知列表 |
| `/profile` | (dashboard)/profile/page.tsx | 我的主页 |
| `/profile/[id]` | (dashboard)/profile/[id]/page.tsx | 他人主页 |
| `/settings` | (dashboard)/settings/page.tsx | 设置 |
| `/leaderboard` | (dashboard)/leaderboard/ | 未实现 |

### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 邮箱注册（发送验证码） |
| POST | `/api/auth/verify-email` | 验证邮箱 |
| POST | `/api/auth/login` | 邮箱登录 |
| POST | `/api/auth/refresh` | 刷新 Token |
| POST | `/api/auth/logout` | 退出登录 |
| GET | `/api/auth/me` | 当前用户信息 |
| POST | `/api/auth/resend-code` | 重发验证码 |
| POST | `/api/auth/forgot-password` | 发送重置密码邮件 |
| POST | `/api/auth/reset-password` | 重置密码 |
| GET/POST | `/api/paths` | 路径列表 / 创建 |
| GET/PATCH/DELETE | `/api/paths/[id]` | 路径 CRUD |
| POST | `/api/paths/[id]/fork` | Fork 路径 |
| GET | `/api/paths/templates` | 模板广场 |
| POST | `/api/paths/generate/framework` | AI 生成框架 |
| POST | `/api/paths/generate/nodes` | AI 展开子节点 |
| PUT | `/api/paths/[id]/nodes/[nodeId]/progress` | 更新节点进度 |
| GET | `/api/paths/[id]/progress` | 获取所有节点进度 |
| POST/GET | `/api/checkins` | 打卡 / 打卡历史 |
| GET/POST | `/api/friends` | 好友列表 / 发送申请 |
| POST/DELETE | `/api/friends/[id]` | 接受 / 删除好友 |
| GET/POST/PATCH | `/api/buddies` | 搭子列表 / 邀请 / 接受 |
| GET | `/api/buddies/board` | 搭子看板 |
| POST | `/api/buddies/nudge` | 催更 |
| GET/POST | `/api/buddy-groups` | 搭子群组 |
| GET | `/api/buddy-groups/[id]` | 群组详情 |
| POST | `/api/buddy-groups/[id]/nudge` | 群组催更 |
| GET/POST | `/api/messages` | 消息列表 / 发送 |
| GET/PATCH | `/api/notifications` | 通知列表 / 标记已读 |
| GET/POST/PATCH/DELETE | `/api/posts` | 动态 CRUD |
| GET/POST/PATCH/DELETE | `/api/resources` | 资源 CRUD |
| GET | `/api/explore` | 广场聚合（动态 + 资源） |
| GET/POST/DELETE | `/api/likes` | 点赞/取消 |
| POST/GET | `/api/comments` | 评论 |
| POST | `/api/upload` | 文件上传 |
| POST/DELETE | `/api/push` | Push 订阅/取消 |
| GET/PATCH | `/api/users/me` | 个人信息 |
| GET | `/api/users/[id]` | 他人信息 |
| GET | `/api/users/search` | 搜索用户 |
