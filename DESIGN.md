---
name: Study-DaZi
description: 学习搭子 — AI 驱动的自学成长路径规划 + 学习搭子社交平台
colors:
  primary: "#f97066"
  primary-deep: "#e0524a"
  primary-light: "#fde8e6"
  accent: "#6366f1"
  accent-light: "#eef2ff"
  success: "#10b981"
  success-light: "#d1fae5"
  alert: "#ef4444"
  neutral-ink: "#1a1a1a"
  neutral-body: "#404040"
  neutral-muted: "#737373"
  neutral-subtle: "#a3a3a3"
  neutral-border: "#e5e5e5"
  neutral-surface: "#ffffff"
  neutral-bg: "#fafaf9"
  purple-badge: "#8b5cf6"
  purple-badge-light: "#ede9fe"
typography:
  display:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "clamp(1.75rem, 5vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "18px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    padding: "10px 24px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-body}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.neutral-surface}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
  input:
    backgroundColor: "{colors.neutral-surface}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  nav-link:
    textColor: "{colors.neutral-muted}"
    typography: "{typography.label}"
  nav-link-active:
    textColor: "{colors.accent}"
  badge:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary-deep}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
    typography: "{typography.label}"
---

# Design System: Study-DaZi

## 1. Overview

**Creative North Star: "温暖的学习广场"**

Study-DaZi 的设计系统以"社区广场"为核心隐喻：用户打开 app 就像走进一个热闹但不嘈杂的学习社区，卡片是广场上的布告栏，搭子是身边一起学习的朋友，打卡是每日的仪式感。

整体风格参考小红书和即刻的内容卡片化设计：信息流驱动、卡片为主要载体、色彩温暖明快、社交元素视觉权重高。拒绝冷冰冰的 SaaS 工具感，也拒绝过度装饰的毛玻璃/渐变文字等 AI 味设计。

**Key Characteristics:**
- **卡片即内容**：所有信息以圆角卡片呈现，像信息流而非数据表格
- **暖色主导**：coral/peach 为主色调，传递温暖和社交感，indigo 保留为功能性 accent
- **轻量不焦虑**：大量留白、适中信息密度、不催促用户
- **社交优先**：搭子、好友、消息等社交功能在视觉层级上不低于核心功能

## 2. Colors

暖色调为主，coral 系传递温暖和活力，indigo 保留为链接和功能性操作的 accent。

### Primary
- **Warm Coral** (#f97066): 主色调，用于 CTA 按钮、打卡按钮、重要操作。传递活力和社交温度。
- **Deep Coral** (#e0524a): hover/active 态，比 primary 深一档。
- **Coral Wash** (#fde8e6): 极淡的 coral 底色，用于 badge 背景、选中态底色。

### Secondary
- **Electric Indigo** (#6366f1): 功能性 accent，用于文字链接、导航 active 态、focus ring。不做大面积使用。
- **Indigo Wash** (#eef2ff): indigo 极淡底色。

### Tertiary
- **Emerald** (#10b981): 成功态，打卡完成、匹配成功。
- **Emerald Wash** (#d1fae5): 成功态底色。
- **Soft Violet** (#8b5cf6): 搭子领域标签，区分社交身份。

### Neutral
- **Ink** (#1a1a1a): 标题、强调文字。
- **Body** (#404040): 正文。
- **Muted** (#737373): 次要信息、描述文字。
- **Subtle** (#a3a3a3): 占位符、最弱信息。
- **Border** (#e5e5e5): 边框、分割线。
- **Surface** (#ffffff): 卡片背景。
- **Background** (#fafaf9): 页面底色，带极微暖调。

### Named Rules

**The Warmth-From-Accent Rule.** 页面的"温暖感"来自 primary coral 和社交元素，不来自底色。底色保持中性（#fafaf9），不要用 cream/sand/beige 等暖调底色，那是 AI 默认。

**The Indigo-Is-Functional Rule.** Indigo 只用于可交互元素（链接、按钮 focus、导航 active），不用于装饰。大面积 indigo 是工具感的来源。

**The Coral-Rarity Rule.** Primary coral 在任何单屏上不超过 15% 面积。它的存在感来自"关键位置的点睛"，不是"到处都是"。

## 3. Typography

**Display Font:** Geist (with system-ui fallback)
**Body Font:** Geist (with system-ui fallback)
**Mono Font:** Geist Mono (with ui-monospace fallback)

**Character:** Geist 是一款几何感 sans-serif，清晰现代但不冰冷。单一字族通过 weight 对比建立层级（700 标题 vs 400 正文），避免多字族的混乱感。中文走系统字体栈（PingFang SC, Microsoft YaHei），保持与 Geist 的 x-height 协调。

### Hierarchy
- **Display** (700, clamp 1.75rem–2.5rem, 1.2): 页面主标题、欢迎语。用于首屏大标题，不滥用。
- **Headline** (600, 1.25rem, 1.3): 卡片标题、区域标题。
- **Body** (400, 0.875rem, 1.6): 正文、描述。最大行宽 65ch。
- **Label** (500, 0.75rem, 1.4): 标签、导航、按钮文字、时间戳。
- **Mono** (400, 0.875rem): 代码、API key 等技术内容。

### Named Rules

**The Weight-Contrast Rule.** 层级通过 font-weight 差异建立，不通过字号大幅跳变。标题 700 vs 正文 400 的对比已经足够；不要出现 400 标题 + 400 正文的"平级"排列。

**The No-All-Caps Rule.** 正文和标签都不用大写。中文没有大写概念，英文大写在 body size 下不可读。唯一例外：极短的英文 badge 文字（≤4 词）。

## 4. Elevation

轻量层级系统，以阴影和背景色差异区分层级。不使用深色阴影营造"浮起感"，而是用极淡的阴影暗示"卡片在底色之上"。

### Shadow Vocabulary
- **shadow-sm** (`0 1px 2px rgba(0,0,0,0.05)`): 卡片默认态，极淡阴影暗示层级。
- **shadow-md** (`0 4px 6px rgba(0,0,0,0.07)`): 卡片 hover 态，轻微浮起反馈。
- **shadow-lg** (`0 10px 15px rgba(0,0,0,0.1)`): Modal、抽屉等临时层级。

### Named Rules

**The Flat-By-Default Rule.** 页面背景（#fafaf9）无阴影，卡片（#ffffff + shadow-sm）在其上。层级差异来自背景色差 + 极淡阴影，不是深色投影。如果阴影看起来像 2014 年的 app，说明太重了。

## 5. Components

### Buttons
- **Shape:** 全圆角 (border-radius: 9999px)，像药丸形状，亲和力强。
- **Primary:** coral 背景 (#f97066) + 白色文字，padding 10px 24px，font-weight 500。
- **Hover:** 深一档 coral (#e0524a)，transition 200ms。
- **Ghost:** 透明背景 + neutral-body 文字，hover 时出现极淡底色。
- **Focus:** 2px indigo ring，offset 2px。

### Cards
- **Corner Style:** 大圆角 (18px)，营造温暖亲和感。
- **Background:** 纯白 (#ffffff)。
- **Shadow:** shadow-sm 默认，hover 时 shadow-md。
- **Border:** 无边框，用阴影区隔层级。
- **Internal Padding:** 24px (lg)。
- **Hover:** 轻微 shadow 提升 + 可选的 border-color 变化。

### Inputs / Fields
- **Style:** 白色背景 + 1px border (#e5e5e5)，圆角 10px。
- **Focus:** indigo border + 1px ring，transition 150ms。
- **Placeholder:** neutral-subtle (#a3a3a3)，确保 4.5:1 对比度。

### Navigation
- **Style:** 水平导航栏，sticky top，白底 + 底部 1px border。
- **Default:** neutral-muted 文字。
- **Hover:** indigo 文字。
- **Active:** indigo 文字 + font-weight 600。
- **Badge:** 红色小圆点 (8px) 显示未读数。

### Chips / Tags
- **Style:** 全圆角，小字号 (0.75rem)，padding 2px 10px。
- **Domain tag:** purple-badge 背景 + purple-badge 文字。
- **Status tag:** emerald-light 背景 + emerald 文字（成功态）。

### Check-in Widget (Signature Component)
- **打卡按钮:** coral 全圆角按钮，完成后变为 emerald 底色 + "✅ 已打卡"。
- **热力图:** 小方格 (16px)，未打卡 gray-100，已打卡 emerald-500，今日 indigo ring。
- **连续天数:** 大号数字 (2xl bold) + 小号灰色标签。

## 6. Do's and Don'ts

### Do:
- **Do** 使用 coral 作为主色调，传递温暖和社交感。
- **Do** 保持卡片大圆角 (18px)，营造亲和力。
- **Do** 用阴影（而非边框）区分层级，shadow-sm 为默认。
- **Do** 确保所有文字对比度 ≥ 4.5:1（特别是 gray-500 在白底上）。
- **Do** 用 emerald 表示成功态（打卡、匹配），保持一致性。
- **Do** 社交功能（搭子、好友、消息）在导航中与核心功能同等权重。
- **Do** 使用 `text-wrap: balance` 在标题上，保持行宽均匀。

### Don't:
- **Don't** 使用 cream/sand/beige 等暖调底色。PRODUCT.md 明确拒绝"AI 默认的暖调底色"。温暖感来自 coral accent，不来自底色。
- **Don't** 使用渐变文字 (`background-clip: text`)。Impeccable 的绝对禁令。
- **Don't** 使用侧边条纹边框 (>1px colored border-left)。Impeccable 的绝对禁令。
- **Don't** 使用毛玻璃 (glassmorphism) 作为默认设计。Impeccable 的绝对禁令。
- **Don't** 在每个 section 上方加 tiny uppercase eyebrow (小红书风格的 "ABOUT" "PRICING")。Impeccable 的绝对禁令。
- **Don't** 做千篇一律的卡片网格（相同尺寸 icon + heading + text 重复）。PRODUCT.md 拒绝"SaaS 仪表盘感"。
- **Don't** 大面积使用 indigo。PRODUCT.md 拒绝"冷冰冰的工具感"，indigo 只做功能性 accent。
- **Don't** 使用 Notion/Linear 那样过于克制的灰白色调。PRODUCT.md 明确拒绝。
- **Don't** 正文使用 ALL CAPS。中文无此概念，英文不可读。
- **Don't** 使用超过 3 种 font-family。
