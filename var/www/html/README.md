# random-image 项目说明

本项目是一个自用小服务集合，跑在同一台机器上：随机壁纸接口（PHP）+ 登录接口（PHP）+ 数据后端（FastAPI）+ 控制台前端（原生 HTML/JS）。

## 目录结构

```text
.
├─ docker-compose.yml   PHP 服务（php:apache，宿主 8181 → 容器 80）
├─ CHANGELOG.md         变更记录（备份约定也在里面）
└─ var/www/html/        网站根目录（挂载进容器）
   ├─ index.php         随机壁纸接口（根路由）
   ├─ auth-api.php      登录接口（check / login / logout）
   ├─ 1.html / 1-test.html  旧导航工作台测试页（需 tailwind CDN）
   ├─ 后端/             FastAPI 数据后端（默认 :8000，见下）
   └─ 前端/             控制台前端（主页/待办/记账/监控/书签）
      ├─ index.php      单页五视图（顶栏导航 + 状态磁贴 + 内容舞台，逻辑入口）
      ├─ css/style.css  壁纸 + 磨砂玻璃样式
      └─ js/
         ├─ app.js      视图/数据/壁纸逻辑（依赖 notify.js 与页内 API_BASE）
         └─ notify.js   Toast + Modal 独立实现（无外部依赖）
```

历史注记：根目录曾经的 `popup.js`（弹窗组件库）、`background-switcher.js`（背景切换器）已删除，`前端/` 不再引用任何外部 JS，只用自带的 `js/notify.js`。

## 1. 随机壁纸接口（PHP `:8181`）

`GET /` 直接返回一张图片二进制，`GET /?type=pc|desktop|pe|mobile` 指定图库，不带参数时按 UA 自动判断。

有用的响应头：`X-Image-Id`（下次请求带 `?exclude=<id>` 可避开上一张）、`X-Theme-Color-Hex` / `X-Text-Color-Hex`（前端主题联动）、`Content-Length`。

同目录的 `.color_cache.json` / `.image_list_cache.json` / `.image_id_map.json` 是接口缓存，删掉会自动重建。

## 2. 登录接口（`auth-api.php`）

```text
GET  auth-api.php?action=check    X-Auth-Token: <token>   → {"authenticated": true|false}
POST auth-api.php?action=login    {"password":"...","remember":true} → {"success":true,"token":"..."}
GET  auth-api.php?action=logout
```

token 存 localStorage（键名 `__ag_token`），服务端状态在 `.auth_users.json` / `.auth_tokens.json`，限流计数在 `.auth_rate_limit.json`。

## 3. 数据后端（FastAPI `:8000`）

代码在 `后端/`：`main.py`（组装/CORS 全开）+ `db.py`（各业务独占 SQLite，`data/` 下）+ `models.py` + `routers/` + `utils.py`。

```bash
cd var/www/html/后端
uvicorn main:app --host 0.0.0.0 --port 8000
# 或 python main.py
```

浏览器打开 `http://主机:8000/docs` 可在线调试（Scalar）。主要接口：

| 模块 | 接口 |
| --- | --- |
| 待办 | `GET/POST /todos`、`PUT /todos/{id}`、`PUT /todos/{id}/processed`（完成后循环任务顺延）、`DELETE /todos/{id}` |
| 书签 | `GET/POST /bookmarks`、`PUT /bookmarks/{id}`、`POST /bookmarks/{id}/visit`（访问计数+1）、`DELETE` |
| 监控 | `POST /server/status`（同 server+service 覆盖，extra 收纳多余字段）、`GET /server/status?server_name=&limit=` |
| 账本 | `GET/POST /ledger`、`PUT/DELETE /ledger/{id}`（PUT 要完整对象，自动回冲/入账）、`GET/POST /asset`、`/liability`（总额覆写对账用） |

改表结构后删掉 `data/` 下对应 `.db` 重启即重建（会丢数据，先备份）。

## 4. 控制台前端（`前端/`）

`前端/index.php`：单张内容卡片（`.stage` 玻璃）= 卡片头（标题/摘要 + 按版块切换的动作区 + 右上角 ☰ 菜单：六项导航与换壁纸，点外部/选导航/Esc 关闭）+ 主页/仪表/待办/记账/监控/书签六视图（display 硬切，无刷新）。主页只显示书签（全量按分类分组，不设顶栏与菜单，书签段头固定在顶部，右侧只放「▦ 仪表」跳转键）；「仪表」版块用卡片汇总各版块简略消息（待办未完成/逾期、记账余额/负债、监控正常/异常、书签数），点卡片进对应版块。卡片顶栏最前为搜索键（🔍 展开本地搜索框，按当前版块过滤，切版块自动收起）；待办按「无提醒 / 已到提醒 / 未到提醒」分组，未到提醒默认收起（可展开），完成键到提醒日才可点、完成循环任务自动顺延；添加/编辑走表单弹窗（挂 body、单层遮罩滚动、点遮罩/Esc/✕/取消关闭、回车保存、触屏不自动聚焦）；删除为行内两步确认（点一次变「确认删？」，3 秒内再点执行）。壁纸轻微提饱和（`filter`），面板为实色半透底，菜单「🎲」可手动换壁纸。

`前端/js/app.js`：视图/数据/壁纸逻辑，数据直调 `http://当前主机名:8000`（`BACKEND` 变量在文件顶部，改一处即可；HTTPS 页面调 HTTP 会被浏览器拦截），壁纸色通过 `X-Theme-Color-Hex` 同步到 `--accent`。

右上角 Toast 已停用（`js/notify.js` 保留 `Toast` API 但为空实现）：操作反馈改用顶部「加载中…」全局指示与表单标红；表单弹窗在 `app.js` 内实现，无外部依赖。

## 5. 部署

```bash
docker compose up -d     # PHP：http://主机:8181（壁纸/鉴权/静态前端）
# 后端 FastAPI 另起：见第 3 节（:8000，CORS 全开，仅放内网）
```

图片目录挂载：宿主 `/mnt/ssd-1/xct258/图片/网页背景图/{pc,pe}` → 容器 `/home/xct258/images/{pc,pe}`，见 `docker-compose.yml`。

## 6. 备份与变更

- 备份包：`/tmp/random-image-backup-NNN.tar.gz`（三位递增编号，永不重用；全部保留，不自动删除）。
- 打包：`tar -czf /tmp/random-image-backup-NNN.tar.gz -C /home/xct258/opencode/docker/random-image .`
- 只在明确指示时备份；变更都记 `CHANGELOG.md`。
