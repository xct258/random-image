# 个人工作台 (Personal Dashboard) 布局与视觉设计规范

本文档为集成「待办、笔记、书签、服务器监控」的二次元毛玻璃质感（Glassmorphism）个人主页提供完整的布局规范、CSS/Tailwind 样式参数及 AI 出图提示词。

---

## 1. 核心设计原则

1. **背景透视与可读性平衡**：
   * 背景为暖色/日系二次元插画（人物居中偏上或在留白处）。
   * UI 面板采用高斯模糊（`backdrop-blur-md` ~ `backdrop-blur-xl`）与半透明深色叠层（`rgba(15, 23, 42, 0.55)` ~ `0.75`），保证背景美观的同时避免文字背景杂乱。
2. **色彩层级映射**：
   * **背景**：暖光室内/书房二次元插画（暖黄、琥珀、淡粉紫暗部）。
   * **面板容器**：半透明黑曜石蓝/暗灰（`#0d1117` / `#161b22`，透明度 60%~75%）。
   * **边框与高光**：`rgba(255, 255, 255, 0.08)` 到 `0.15` 的微弱描边，模拟物理玻璃边缘。
   * **状态强调色**：
     * 正常/运行中：Neon Mint (`#10b981`)
     * 告警/负载：Amber Light (`#f59e0b`)
     * 严重/宕机：Rose Red (`#f43f5e`)
     * 品牌/功能色：Cyber Cyan (`#06b6d4`) 与 Royal Violet (`#8b5cf6`)

---

## 2. 页面布局骨架 (Desktop & Mobile)

### 2.1 桌面端网格 (1440px+)

```
+----+-----------------------------------------------------------------------+
| 导 | 顶部工具栏: [搜索框 (Cmd+K)]        [系统监控状态 Badge]   [+ 快速记] |
| 航 +-----------------------------------------------------------------------+
| 栏 | 主内容 12 列 Bento Grid:                                              |
|    | [ 服务器监控 (4 cols) ]   [ 今日待办 (4 cols) ]   [ 警报与日志 (4 cols) ] |
| (60| (CPU/RAM/Ping 折线)       (任务勾选/优先级)       (Docker/服务状态事件)   |
| px)+-----------------------------------------------------------------------+
|    | [ 最近笔记预览 (6 cols) ]          [ 快捷书签与文件夹网格 (6 cols) ]    |
|    | (卡片式 Markdown 摘要/字数)        (5x2 图标网格 / 分组 Dock)          |
+----+-----------------------------------------------------------------------+
```

### 2.2 移动端流式布局 (< 768px)

* **顶部**：紧凑状态条（时间 + 极简红绿灯指示器）+ 搜索栏。
* **主体**：垂直单列流（按优先级：`今日待办` -> `服务器状态卡` -> `高频书签` -> `笔记摘要`）。
* **底部**：固定毛玻璃底部导航条（Bottom Tab Bar：5 个核心入口）。

---

## 3. 详细组件样式提示词与参数规范

### 3.1 全局容器与背景 (App Shell)

* **CSS / Tailwind 规范**：
  ```css
  /* 背景层容器 */
  .dashboard-background {
    background-image: url('/path/to/anime-artwork.jpg');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    background-attachment: fixed;
    min-height: 100vh;
  }

  /* 基础磨砂玻璃卡片 */
  .glass-card {
    background: rgba(18, 22, 34, 0.65);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
    border-radius: 14px;
  }
  ```

---

### 3.2 侧边微型导航栏 (Slim Sidebar)

* **尺寸**：固定宽度 `68px`，`100vh` 粘性定位。
* **样式**：
  * 背景：`rgba(13, 17, 23, 0.85)`，磨砂模糊 `20px`。
  * 右边框：`1px solid rgba(255, 255, 255, 0.08)`。
* **元素布局**：
  * 顶部：`40x40px` 圆形头像，带微弱发光阴影。
  * 中部（Flex 垂直分布）：
    * 图标按钮：`44x44px` 圆角，白描线性图标（Dashboard、Todo、Notes、Bookmarks、Monitoring）。
    * 悬停/激活态：背景高亮 `rgba(255, 255, 255, 0.12)`，图标纯白，右侧显示小光标或圆点指示器。
  * 底部：系统设置与退出图标。

---

### 3.3 顶部控制栏 (Top Bar)

* **高度**：`64px`，宽度占满内容区。
* **搜索框**：
  * 居中或左靠，宽 `420px`，高 `40px`，圆角 `8px`。
  * 背景 `rgba(0, 0, 0, 0.35)`，占位符 `"Search everything... (Cmd+K)"`。
  * 右侧附带 `⌘K` 键盘徽标。
* **状态指示器**：
  * 等宽字体（Monospace）排版：`CPU: 24% | RAM: 62%`。
  * 动态呼吸灯：在线绿点（`#10b981`，带外发光 `box-shadow: 0 0 8px #10b981`）。
* **操作按钮**：
  * `Quick Post [+]` 快捷按钮，边框与微渐变。

---

### 3.4 模块 A：服务器监控 (Server Monitoring)

* **展示要素**：
  * 2x2 极简折线图或进度条（CPU Load、Memory Usage、Disk I/O、Ping Latency）。
  * 折线样式：亮青色（`#06b6d4`）与暖黄色（`#fbbf24`），折线下方带微透明面积渐变。
  * 右上角提供状态标签（例如：`Main VPS: Online`）。

---

### 3.5 模块 B：今日待办 (Today's To-Do)

* **展示要素**：
  * 纵向列表，单行高度 `36px`。
  * 复选框：自定义圆角方框，选中后呈现蓝青色填充加小勾，文字添加横线中划与 50% 不透明度。
  * 优先级标记：高危红色圆点、普通黄色圆点、项目标签（Tag）。
  * 底部常驻 `+ 快速添加待办` 极简输入框。

---

### 3.6 模块 C：系统日志与报警 (Alerts / Logs)

* **展示要素**：
  * 事件气泡流：
    * ⚠️ `Main VPS CPU spike` (红褐背景 `rgba(239, 68, 68, 0.18)` + 红色警告图标)
    * 🔄 `Docker container 'api' restarted` (黄褐背景 `rgba(245, 158, 11, 0.18)`)
    * 🟢 `Database backup completed` (深绿背景 `rgba(16, 185, 129, 0.18)`)
  * 时间戳右对齐，极细文字显示（如 `12m ago`）。

---

### 3.7 模块 D：最近笔记 (Recent Notes)

* **展示要素**：
  * 双列或列表卡片排版。
  * 每张笔记卡片包含：
    * 标题（加粗白色，15px）。
    * 摘要正文（2 行截断，淡灰色 `#94a3b8`，13px）。
    * 底部元信息：更新时间（`Just now` / `Yesterday`）+ 分类 Tag。

---

### 3.8 模块 E：书签网格 (Quick Bookmarks)

* **展示要素**：
  * 5x2 紧凑自适应网格。
  * 卡片尺寸：约 `64x64px` 到 `72x72px` 居中圆角小方块。
  * 高保真品牌矢量图标（GitHub、Google、AWS、Figma、Reddit、YouTube 等）。
  * 下方单行微型文字标签（11px，居中对齐）。
  * 支持文件夹展开预览（带浅蓝色文件夹样式）。

---

## 4. 完整的 Midjourney / Stable Diffusion 出图提示词 (Prompt Template)

如果你需要再次使用 AI 生成或调试类似效果图，可直接复用以下 Prompt：

```text
A modern personal productivity dashboard UI mockup, anime aesthetic, glowing glassmorphism interface floating seamlessly over a cozy anime girl illustration background. The background features a cute anime girl sitting in a warm sunlit library room with plants, softly visible through semi-transparent blurred UI panels. 

Dark theme UI, deep charcoal and navy glass cards with subtle white borders, backdrop-blur effect. 

The dashboard layout includes:
- Left slim dark icon navigation sidebar
- Top translucent header with search bar (Cmd+K) and real-time server health metrics (CPU, RAM)
- Grid layout containing:
  1. Server monitoring panel with minimal glowing teal line graphs and status badges
  2. To-do checklist with task checkboxes and progress
  3. System event alerts with colored status tags (red, amber, green)
  4. Recent markdown notes preview list
  5. Compact colorful bookmark app icons grid (GitHub, AWS, YouTube, etc.)

Sleek typography, high contrast, clean hierarchy, 8k resolution, UI/UX concept design, Dribbble trending, Figma presentation, photorealistic monitor frame, cinematic lighting --ar 16:9 --v 6.0
```