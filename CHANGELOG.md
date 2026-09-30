# 变更日志

本项目所有重要变更均记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## 备份说明

- **路径**：`/tmp/random-image-backup-NNN.tar.gz`
- **命名**：`random-image-backup-` + 三位递增编号（`001`、`002`、`003` …），永不重用编号
- **打包范围**：项目根目录全部文件，命令示例：
  ```bash
  tar -czf /tmp/random-image-backup-NNN.tar.gz -C /home/xct258/opencode/docker/random-image .
  ```
- **时机**：仅在用户明确指示备份时创建，不再每次变更自动备份
- **变更记录标注**：有对应备份时标注 `（备份：random-image-backup-NNN.tar.gz）`，无备份的变更只记内容
- **保留**：全部备份一律保留、不删除；如需清理或重置，由用户明确指示后统一执行

## [2026-09-30]

### 变更

- 添加 5 条示例书签（用户指示）：`GitHub` / `Bilibili` / `豆包` / `MDN` / `Docker Hub`（经 `POST /bookmarks` 写入，原库为空）。

- 清空全部业务数据（用户指示）：清空 `后端/data/` 四个库的全部表（`todo` / `bookmark` / `serverstatus` / `ledger_items` + `asset` / `liability`），保留表结构与运行中的 uvicorn 服务；清空前已备份 data/ 到 `/tmp/random-image-data-backup-001.tar.gz`。
- 弹窗/遮罩用壁纸主题色（用户指示）：以 `--accent`（壁纸 `X-Theme-Color-Hex`）经 `color-mix` 派生——遮罩 `.iform-wrap` 暗幕染主题色 16%，弹窗 `.iform` 底色 12% + 描边/顶高光/外发光按主题色，输入聚焦边框、`.idate.open`、日期面板 `.ipicker`（底/边）、`.ip-day.today/.sel` 全部改用 `--accent`；深色底与不支持 `color-mix` 时的回退值保留（可读性不受影响）。
- 统一标题栏样式（用户反馈，以主页为准）：`.apptop` 与 `.home-head` 统一为 `padding:14px 14px 12px` + 浅底 `rgba(0,0,0,.12)` + 底部分隔线 + `text-shadow`；`.apptop` 去掉原 `min-height:50px` / `padding:9px 14px`；窄屏两者同步 `10px 10px 9px`。再给两者统一 `min-height:58px`（窄屏 53px）——此前主页头最高是 28px 的「▦ 仪表」chip、其它版块是 32px 的 ☰，导致主页↔仪表切换时标题栏高度差约 4px。
- 去掉顶栏余额/负债键（用户指示）：删除记账动作区的 `#asset-total` / `#liability-total` 两个校准键；`paintTotals` 仅保留取数供仪表「记账」卡（`MONEY`），校准表单 `#iform-asset` 与 `openAssetForm` 暂留但无入口。
- 搜索键移到卡片顶栏（用户指示）：四个版块的搜索框/按钮合并为顶栏一个搜索控件（`#act-search` 🔍 + `#search-input`），放在动作按钮之前（顶栏右簇内），按当前版块过滤（`SEARCH_VIEW`），切版块自动收起并清空过滤；移除各列表的 `.panel-head`。
- 移动端布局优化（用户指示）：窄屏展开的搜索框改为浮在顶栏下方（`position:absolute` 满宽、不占流），不挤动动作区与菜单；图标键触控尺寸 32→34px；新增 `≤480px` 断点（表单 `.irow` 改单列、仪表两列、内边距收紧）。
- 停用右上角 Toast（用户指示）：`js/notify.js` 去掉 DOM/样式实现，`Toast` API 改为空实现（不影响各调用处）；操作反馈改由顶部「加载中…」全局指示与表单标红承担，失败不再弹右上角提示。
- 全局请求加载反馈（用户指示）：只对**写操作**（POST/PUT/DELETE：添加/编辑/删除/完成等）显示——`api()` 出口维护在飞计数（`netStart/netEnd`），写请求在飞时右上角淡入「加载中…」胶囊（延迟 180ms、避免快请求闪烁），结束淡出；GET 列表加载、首屏、壁纸加载都不显示该指示。待办完成/重开另有按钮内 spinner。
- 待办分组 + 未到提醒收起（用户指示）：`paintReminders` 按「无提醒 / 已到提醒 / 未到提醒」分组（`.tgroup` 标题）；无提醒待办直接显示、已到提醒的前台显示，未到提醒默认收起为「未到提醒 · N 项」展开键（`toggleFutureReminders`，搜索时自动展开）；未到提醒组的完成键仍置灰（复用 `todoLocked`），到提醒日才可完成。
- 前端交互卡顿优化（用户反馈）：去掉全屏 `body::after` 的 `backdrop-filter: saturate(112%)`（连同 1.2s 透明度过渡与 `glass-on`），改为在 `#anime-bg` 上直接 `filter: saturate(112%)`——避免每次交互（开菜单/弹窗/切视图）都重采样整屏；`api()` 的 GET 不再带 `Content-Type`，跨域少一次 `OPTIONS` 预检，列表加载更快。
- 待办完成交互优化（用户指示）：完成键统一为「完成」（去掉「打卡」叫法）；未到提醒日时置灰禁用（`todoLocked`：`today < remind_time`），到提醒日才可点；完成后循环任务由后端自动顺延到下一次循环，`doneReminder` 用返回的 `due_time` 提示新日期。
- 主页「仪表」键提醒（用户指示）：有未完成待办或服务异常时，`#act-dash` 加 `.alert`（玫红描边/底色）+ 数量角标 `.badge`（总数，超 99 显示 `99+`），无则恢复普通键样式；由 `paintDash` 统一更新。
- 弹窗下拉框重写（用户指示）：记账「类型」、待办「循环」弃用原生 `<select>`，改自定义下拉（`.isel`：按钮 + `position:fixed` 浮层选项，`toggleISelect/setISelect/syncISelect`，点外部/Esc 先收下拉，放不下自动上翻）；保留 `#fe-type` / `#fr-cycle` 隐藏 input 的 `.value` 与 `change` 事件，原表单逻辑不变；浮层用主题色底/边、选中项高亮、箭头开合旋转。
- 列表搜索框收成图标键（用户指示）：待办/记账/监控/书签四列表搜索框默认隐藏，`.panel-head` 右侧 🔍 键展开/收起（`toggleSearch`，收起清空过滤并重画）；书签版块标题栏不再显示「N 个书签」摘要。
- 主页无书签空状态对齐其它列表（用户指示）：`paintHome` 空态由 `.row` 改 `.empty`（居中图标+文字），`.home-scroll` 改 flex 纵向、`#home-bookmarks` 撑满，空态垂直居中；初始「加载中」同步用 `.empty`。
- 主页改版 + 新增「仪表」版块（用户指示）：主页只显示书签（全量按分类分组），段头左侧「★ 书签」、右侧「▦ 仪表」跳转键（主页不放菜单 ☰）；新增「仪表」（`#view-dash`）用卡片汇总各版块简略消息（待办未完成/逾期、记账余额/负债、监控正常/异常、书签数），点卡片进对应版块。主页不设顶栏（`body.home .apptop` 隐藏，菜单 ☰ 随顶栏只在其他视图出现）。`paintHome` 只画书签、新增 `paintDash`（由各 `paint*` 调用）、`paintTotals` 缓存余额/负债（`MONEY`）供仪表用，移除此前主页提醒条样式与 `paintBalance`。书签段头（`.home-head`：★ 书签 + 仪表 + ☰）移出滚动区、固定在页面顶部，带下边线与浅底色区分。
- 前端去掉高斯模糊：删除 `.stage` 的 `backdrop-filter: blur(18px)`，`--glass` 不透明度 .5→.85→.62（遮罩太暗后调亮），承载层改高不透明深色底（菜单/弹窗沿用实色，全屏调色层的 `saturate` 保留）；省性能，可读性靠不透明度保证。
- 表单与内容遮罩加深：`.iform-wrap` 遮罩 .55→.72；列表行/书签卡/状态磁贴改用深色底 `--card: rgba(0,0,0,.3)`（按钮等交互元素仍用 `--fill`，hover 高亮不变）。

## [2026-09-23]

### 重写

- 前端整包重写（用户明确指示，不备份）：推翻玻璃壁纸版 `index.php` + `css/style.css`，保留 `notify.js`、后端接口与全部功能（六视图：主页书签 / 仪表 / 待办 / 记账 / 监控 / 书签）。
  - 布局：左侧玻璃侧栏（品牌 + 六导航 + 换壁纸），窄屏自动换到底部 Dock；顶栏改为左标题+动态摘要、右动作区，去掉主页/仪表的顶栏切换键（侧栏已有）。
  - 层次：`backdrop-filter` 只挂稳定承载层（侧栏/顶栏/面板/仪表磁贴），内容行/书签卡改纯半透底色；入场淡入挂内容自身，视图用 `visibility` 硬切，磨砂首帧生效。
  - 交互：待办圆点完成/重开、余额/负债点击校准、壁纸手动刷新（淡出换图 + 跟主题色）、标题摘要（书签数/未完成数/流水数/监控状态）。
  - 新文件 `js/app.js`（逻辑从 `index.php` 内联迁出）；`index.php` 只剩结构 + PHP 注入 `API_BASE`。

### 修复

- 内联脚本 `API_BASE is not defined`（用户报错）：改注释时误删了 `$apiBase` 赋值行，PHP 警告混入 `<script>` 截断了 JS 字符串；已恢复赋值；另加空 favicon 止 `favicon.ico` 404。
- 添加界面改内联表单、不再弹窗（用户指示）：待办/记账/书签的新建·编辑、余额·负债校准全部改为版块内 `iform` 内联表单（搜索框下方展开，`max-height:46%` 自滚）；原新建待办两步弹窗合一（是否提醒勾选框展开日期区）；删除确认改行内两步（点一次变「确认删？」红字，3 秒内再点执行）；键盘只滚输入框所在的列表/表单滚动区、滚不动垫键盘高度再滚、失焦还原，页面布局不动；`notify.js` 删弹窗实现只留 Toast。附带：编辑回填日期改 `date` 输入（`slice(0,10)` 真能填上，原 `datetime-local` 回填从未生效）。
- 添加弹窗被键盘遮挡（用户反馈，重写 `notify.js` 弹窗，不改变页面布局）：遮罩为单层滚动容器 + 弹窗 `margin:auto` 自然高度（矮时居中、高时顶对齐可滚，不套第二层滚动）；布局视口不动（不用 `interactive-widget=resizes-content`），键盘弹起时先给遮罩垫出键盘高度的底边距（否则弹窗没超出遮罩、遮罩滚不动，输入框必然被盖），再按 `visualViewport` 可视区补偿滚动遮罩，把聚焦项顶到键盘上方，收起即还原；聚焦/视口变化各补一次 320ms 延迟纠偏，兜住键盘动画结束时的最终高度；触屏不再自动聚焦首输入，输入字号 14→16px 防 iOS 自动缩放；安全区 + `overscroll-behavior:contain` 防穿透滚动。
- 切换板块内容闪动（用户反馈）：`.view` 去掉 `opacity + visibility` 交叉过渡、改回 `display:none/flex` 硬切（交叉时新旧两层同时半透明、透出壁纸就是闪一下）；`goView` 同板块重复点击直接返回、先挂新视图再摘旧视图，避免重挂 `.active` 重播过渡；去掉 `.row` / `.bm-card` 的 `content-visibility + contain-intrinsic-size`（尺寸预估在切换/滚动时跳变）；`setSub` 值不变不再碰 DOM，标题摘要空行用占位符占高，卡片头高度不再跳变。
- 开场内容抢跑：`.app` 的隐藏由 `visibility:hidden` 改为 `opacity:0 + pointer-events:none`（`visibility` 会被后代 `.view.active` / `.pane.on` 的 `visible` 穿透覆盖，内容在壁纸之前就显示），恢复「壁纸淡入 → 调色层 → 内容淡入」序列。
- 切板块闪一下：视图/面板的入场淡入只在开场跑一次（JS 短挂 `body.boot` 后摘掉）——原淡入会先把玻璃面板置透明、露出壁纸再淡回来，切换时表现为闪烁。
- 切换改交叉过渡（替代纯硬切）：离场板块 `.leaving` 压上层、整块玻璃 `opacity` 淡出（自身透明度不影响自身磨砂采样），入场板块底层直接就位、内层内容轻移 6px；JS `switchTransition` 加类并 260ms 后摘掉，快速连点先清旧过渡。全程无透明空档，磨砂不掉。（此方案后被舞台玻璃方案替代，见下条）
- 切板块区域变暗：交叉过渡时离场与入场两层玻璃各 50% 暗底叠加，中途暗度升到约 75% 再回落。改为玻璃只挂稳定舞台（`.stage`），`.panel` / `.board` / `.stat` 去模糊改半透底色，视图切换回到 `.view` 自身 opacity 交叉淡入淡出（只动内容层）；删除 `.leaving` / `.entering` 与 `switchTransition` 逻辑，不再叠暗、不掉磨砂、不闪。
- 主页磁贴与内容同卡：舞台玻璃化后 4 个状态磁贴落进同一张卡片。磁贴移到舞台外（`#home-stats`），恢复独立玻璃卡片（共享玻璃配方，属稳定层不参与过渡，切换不掉磨砂）；非主页自动隐藏，窄屏内边距同步压缩。

### 优化

- 按键样式优化（用户指示）：`.btn.primary`（+添加/+记账）加投影、上浮 hover 与按压缩放，`min-height:32px` 保触屏命中；`.link` 改胶囊圆角、编辑/删除给蓝红 tint hover；`.icon-btn/.chip/.nav-item/.stat/.done-btn` 统一按压回缩与 `:active`；书签 `.bm-del/.bm-edit` 改 `opacity` 淡入、增大点击区，触屏常显；`notify.js` 弹窗 `.nz-btn` 同步 hover/active/焦点环；加 `touch-action:manipulation` 与 `prefers-reduced-motion` 降级。
- 添加键去蓝色统一为暗玻璃（用户指示）：`.btn.primary` 去掉蓝渐变/投影，改与全局一致的半透明暗底 + 亮边，仅保留加粗文字区分层级；hover/active 只剩底色加深与按压缩放。
- 添加表单重写（用户指示）：待办/记账/书签/校准四个内联表单统一结构（标题 + ✕ 关闭、取消左保存右），打开自动聚焦首字段并滚入视野；回车保存（文本域除外）、Esc/✕/取消关闭；必填缺失标红 + 聚焦，输入即清；记账「利息」仅还款时显示、日期默认今天、金额框聚焦；待办新建默认到期今天；书签链接没写协议自动补（localhost/内网 IP 用 `http`，其余 `https`）；表单卡片补充 `color-scheme:dark`（日期控件深色）与虚线提醒区样式。
- 表单改回弹窗（用户指示）：四个表单由版块内联改为 body 级弹窗（挂 body 避开舞台玻璃的 fixed 包含块限制，覆盖整页）；遮罩单层滚动 + 表单卡 `margin:auto` 自然高度居中（矮居中/高可滚）；触屏打开不自动聚焦（防键盘直接弹起），桌面聚焦首字段；保留回车保存、Esc/✕/取消/点遮罩关闭、必填标红、条件字段与链接补协议；`openForm` 去掉原内联滚动逻辑。
- 移动端键盘遮挡弹窗（用户反馈）：遮罩改为按 `visualViewport` 实时贴合——键盘弹起时 `top = offsetTop`、`height = vv.height`，弹窗只占键盘上方可视区并重新居中，键盘收起还原；布局视口不动（页面不重排、背景不跳）；聚焦项再经 `revealField` 滚进遮罩可视区；监听 `visualViewport` 的 resize/scroll、窗口 resize 与 orientationchange 纠偏；删除原「垫键盘高度 padding」的兜底逻辑。
- 键盘弹出过程弹窗区闪变（用户反馈）：遮罩与可视区拆开——`.iform-wrap` 恢复铺满整屏并保持稳定（键盘动画期间遮罩边界不再移动），新增 `.iform-box` 作为可视区跟随 `visualViewport`（`--vvt` / `--vvh` 变量 + `.15s` 过渡），只让可视区与卡片平滑移动；`fitViewport` / `hideForm` 改为设置 / 清除变量而不是直接改遮罩的 top/height。
- 日期选择去原生（用户指示）：待办到期日/提醒日、记账日期三个字段去掉 `<input type="date">`，改为自定义日期键 + 日历浮层（周一开头、上/下月切换、今天描边、选中高亮、今天/明天/清空快捷键）；浮层 `position:fixed` 贴在日期键下方（下方放不下自动翻到上方并夹在可视区内，弹窗内滚动/视口变化实时跟随，层级高于弹窗），不占表单布局；字段显示「今天 · 周X」或「YYYY-MM-DD 周X」；`setDate` / `dateVal` 读写替换原 `.value`，Esc 优先收日历再关弹窗。
- 弹窗反复聚焦键盘偶发页面滚动（用户反馈）：`body` 改 `position:fixed` 钉死文档（iOS 顶不动页面）；`openForm` 聚焦改 `focus({ preventScroll: true })`；新增 `resetPageScroll()`（有偏移即 `scrollTo(0,0)`），在开关弹窗、focusin/focusout、`visualViewport` resize/scroll、window resize/scroll 时统一压回；`revealField` 去掉 `scrollIntoView`，改手动上下双向滚 `.iform-box`，避免连带滚动页面/可视视口。
- 日期浮层交互修复（用户反馈）：面板内点击补 `stopPropagation`，切月重绘后不再被 document 的「点外收起」误关（外点判定同时跳过已重绘失效的节点）；点日期键内部文字（`span`）改用 `closest('.idate')` 判断，不会再把刚打开的浮层关掉。
- 壁纸可欣赏化（`前端/css/style.css`）：去掉全屏 `blur(20px)` 重玻璃，`body::after` 改为不模糊调色层（`brightness(.9)` + `saturate(115%)` + 四周暗角渐变），壁纸全程保持清晰；`#anime-bg` 去掉 `scale(1.05)`，少裁 5% 画面。
- 可读性改由局部玻璃承担：顶栏 / 统计卡 / 仪表面板 / 列表项 / 书签卡统一同款单层玻璃 `rgba(2,6,23,.5)` + `blur(14px) saturate(150%)` + 亮边（与顶栏完全一致），悬浮态改深蓝底；`.apptop/.stage` 文字加 1px 浅影。
- 磨砂即时生效：`.view` / `.home-pane` / `.stage` 的祖先透明度过渡全部去掉（祖先 `opacity<1` 会隔离卡片 `backdrop-filter` 采样，导致磨砂等动画结束才突兀出现）；入场淡入改挂卡片自身（自身透明度不影响自身采样，磨砂第一帧即在），视图切入 `glass-in`、面板切换 `glass-in-pane` 两套 keyframes 保证 `visibility` 切换时重放。
- 壁纸不再压暗（重写版调整）：`body::after` 去掉 `brightness(.9)` 与四周暗角 / 上下渐变，只保留 `saturate(112%)` 轻微提饱和，背景图保持原图观感。

### 变更

- 去掉仪表板块（用户指示）：侧栏删「仪表」项，仪表统计磁贴 + 四模块预览（`.dash` / `.tile-grid` / `.sec` 样式，`paintDash` / `dashBalance` / `d-list-*` 容器）全部移除。
- 主页重写：改为「状态磁贴（待办未完成 / 当前余额 / 监控状态 / 书签总数，点击直达对应板块）+ 书签板」单页布局；原仪表汇总并入各 `paint`（`paintBalance` 承接余额 30 秒缓存），删除 `homeTab` / `setHomeTab` / `.pane` 面板切换，`goView` 与交叉过渡相应简化。
- 侧栏简化（用户指示）：删品牌块（STARTHUB / WORKSPACE）与底部「换壁纸」行，侧栏只剩五项导航、宽度 196→170；「换壁纸」移到顶栏右侧图标键（🎲，各版块常显，窄屏同样可用）。
- 删掉侧边栏（用户指示）：五项导航改为顶栏导航胶囊（`.nav` / `.nav-item` 转横排胶囊样式），窄屏自动折成顶栏第二行均分五格；删除 `.side` 全部样式与引用，顶栏加 `flex-wrap`，`app` 主区不再留侧栏位。
- 布局与操作逻辑复审优化（用户要求）：
  - 主页改概览：状态磁贴 + 近期待办（前 5 条，可直接勾完成，逾期标红）+ 最近书签（8 个），段头带「＋ 添加 / 全部 ›」；不再与书签版块重复全量列表。
  - 待办 / 记账 / 监控 / 书签四列表顶部加本地搜索框（`.panel-head` + `.search`），输入即过滤重画、走 30 秒缓存不发请求。
  - 待办 / 记账 / 书签删除统一加确认弹窗（`confirmDelete` → `Modal.show`，红色确认键），防误删。
  - 待办到期日未完成且已过期时标红并注「（逾期）」。
- 导航与换壁纸收进菜单（用户指示）：顶栏只留标题/摘要、动作区和右上角 ☰ 菜单键；下拉菜单含五项导航（当前项高亮）与「换壁纸」，点外部 / 选导航 / Esc 关闭；菜单用高不透明暗底（位于顶栏 backdrop-root 内，采样不到整页背景，故不挂 `backdrop-filter`），窄屏不再需要第二行导航。
- 顶栏并入内容卡片（用户澄清）：去掉 `.main` 包装与独立顶栏卡片，卡片结构改为 `.stage`（玻璃）内含 `.apptop`（卡片头，底部细分隔线）+ `#home-stats`（仅主页，卡内状态条，磁贴改填充样式 + 分隔线）+ `.views`（五视图叠放）；顶栏控件恢复卡片内的常规底色，菜单仍挂卡片头右上角。
- 去掉近期待办（用户指示）：主页删除「近期待办」整段（`#home-reminders` 容器 + `homeReminderHtml` / `paintHome` 待办渲染），主页只剩状态磁贴 + 最近书签；待办磁贴计数与待办版块功能不变。

## [2026-09-21]

### 备份

- 文档改完后整包备份（用户明确指示）。（备份：`random-image-backup-026.tar.gz`）

### 文档

- 重写 `var/www/html/README.md`：删掉已不存在的 `popup.js` / `background-switcher.js` / `example.html` 旧文档，按现状重写（壁纸接口/auth-api/后端 FastAPI/前端控制台/部署/备份约定）。

### 修复

- 去 popup.js 引用：`前端/index.php` 不再加载根目录 `popup.js`，弹窗/消息改用自有 `前端/js/notify.js`（Toast + Modal.form/show/prompt 独立实现，无外部依赖，调用口径与原库一致）；旧 `var/www/html/popup.js`（44KB）已按指示删除，根目录已无 js 文件。
- 主页书签卡片压空白：图标 32→28px、卡片内边距 10→8px、网格间距 8→6px、分组标题边距收窄，无备注单行卡片高度 52→44px 左右。
- 滚动条贴页面最右：`.stage` 右 padding 去掉（12→0），`.fullview` 卡片右缘拉通（右圆角归零、右 padding 归零），`.quad-body`/`.dashpage` 右 padding 收到 2px，所有页滚动条都贴 viewport 右缘；内容卡片用右外边距保持缩进并左右对称（首页 22/22，专版 38/38）。
- 手机端点击蓝框：`前端/css/style.css` 全局 `tap-highlight: transparent`，按钮/链接非键盘焦点去 `outline`，键盘 `:focus-visible` 保留 2px 描边。

### 恢复

- 恢复 025（仅前端范围，同 024 口径）：`前端/` 还原到 `random-image-backup-025.tar.gz`（`index.php` 766 行与 024 相同，`css/style.css` 含滚动条通条到底 3 行差异）；后端代码/DB 数据未动。
- 恢复 024（用户明确指示，仅前端范围）：删除当前重写版 `前端/`，从 `random-image-backup-024.tar.gz` 还原 `var/www/html/前端/`（`index.php` + `css/style.css` 旧壁纸版）；后端代码/DB 数据/其它文件未动。

### 备份

- 重写前端前预备份（用户明确指示先备份，实用为主重写尚未开始）。（备份：`random-image-backup-025.tar.gz`）

### 重写前端（实用极简三件套）

- `前端/index.php`：766 行混合旧版 → 158 行语义 HTML，去壁纸/玻璃/动画，原生 `<dialog>` 表单，后端不动。
- `前端/css/style.css`：330 行特效版 → 163 行实用版，浅色卡片 + 深色自适应，无外部依赖。
- `前端/js/app.js`：新建 360 行原生 JS，直调 `http://主机:8000` 全量接口，不再依赖 `popup.js`。
- 保留接口口径：todos/ledger(+asset/liability)/server/status/bookmarks(+visit)，字段与后端 models 一致。

### 主页

- 新增默认主页：4 张统计卡（待办未完成 / 余额·负债 / 监控 / 书签总数）+ 四模块最新 3 条预览，点击卡片或“进入”直跳对应版块。

### 推倒重设（分页面 + 行内编辑 + 卡片风，旧 Tab/弹窗逻辑废弃）

- 入口 `前端/index.php`：纯主页，四张大入口卡片（统计数只读），点卡进独立页。
- 独立整页：`todos.php` / `ledger.php` / `servers.php`（只读） / `bookmarks.php`，顶栏 `‹ 主页` 返回。
- 交互：删光 `<dialog>`/Tab 切换/旧 `app.js`，新建走顶部内联展开表单，编辑走行内展开保存/取消，删除用原生 confirm。
- 视觉：`css/style.css` 重写卡片风，44px+ 触屏目标，单列/双列自适应；`js/common.js` 共享请求层，各页一个 JS。

### 主页改书签为主

- `前端/index.php`：书签分组大卡片为主（含搜索/新建/行内编辑/删除/访问计数），顶部一条瘦条显示其它消息（待办未完成 / 余额·负债 / 监控状态，点进独立页）。
- `前端/bookmarks.php`：书签已并入主页，旧地址保留 302 跳转到 `index.php`；`js/bookmarks.js` 删除，逻辑并入 `js/home.js`。

### 删除前端

- `var/www/html/前端`：整个目录已删除（含 `index.php` / `todos.php` / `ledger.php` / `servers.php` / `bookmarks.php` / `css/style.css` / `js/common.js|home.js|todos.js|ledger.js|servers.js`），后端不受影响。

### 重写前端（读后端后重建，主页+独立页）

- 先读后端：`main.py`（CORS 全开 :8000）/`models.py`（Todo/Bookmark/ServerStatus/Ledger/Asset/Liability）/`routers/todos|bookmarks|server|ledger.py`，接口口径按后端原样对接。
- `前端/index.php`：书签为主（搜索/新建/行内编辑/删除/访问计数，按首标签分组）+ 顶部瘦条（待办未完成 / 余额·负债 / 监控概要，点进独立页）。
- `前端/todos.php`：顶部内联新建（标题/内容/需提醒/到期日/提前天数/循环模式），行内编辑保存/取消，完成/打卡调 `PUT /processed`，删除 confirm。
- `前端/ledger.php`：资产/负债总额显示 + 覆写校准（POST /asset、/liability），流水新建/行内编辑/删除（PUT 需完整对象，已按后端补齐）。
- `前端/servers.php`：只读，`GET /server/status` + server_name 过滤，显示 extra。
- `前端/bookmarks.php`：302 跳到 `index.php` 兼容旧地址。
- `js/common.js`：`API_BASE=http://当前主机名:8000`，共享 fetch/esc/状态栏；各页 `home|todos|ledger|servers.js` 独立逻辑。
- `css/style.css`：实用极简，浅色卡片 + 深色自适应，44px 触屏目标，无外部依赖。

### 书签卡片紧凑化

- `js/home.js`：单条从 5 行压到 2 行（标题+访问数+改/删同行，网址/备注/标签合并一行省略号），删底部大按钮组。
- `css/style.css`：新增 `.bm-group/.bm-item` 紧凑样式（小 padding、小按钮 32px），分组 720px 两列、1100px 三列。

## [2026-09-13]

### 变更

- 重置：经用户明确指示，清空此前所有变更记录，从本条重新开始（历史备份文件保留不动）。（备份：`random-image-backup-024.tar.gz`）
- 清除历史备份：`random-image-backup-001.tar.gz` ~ `023.tar.gz` 全部删除，仅保留 `024.tar.gz`（清空后新基线）。
- 滚动条通条到底：去掉滚动容器顶部 `margin-top:4px` 缺口、轨道透明。
- 撤销箭头三连：滚动条按钮 6 变体 + 全站前缀 + 数字框微调箭头全部撤回（只留轨道透明）。
