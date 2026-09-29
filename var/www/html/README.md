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
| 待办 | `GET/POST /todos`、`PUT /todos/{id}`、`PUT /todos/{id}/processed`（循环任务打卡顺延）、`DELETE /todos/{id}` |
| 书签 | `GET/POST /bookmarks`、`PUT /bookmarks/{id}`、`POST /bookmarks/{id}/visit`（访问计数+1）、`DELETE` |
| 监控 | `POST /server/status`（同 server+service 覆盖，extra 收纳多余字段）、`GET /server/status?server_name=&limit=` |
| 账本 | `GET/POST /ledger`、`PUT/DELETE /ledger/{id}`（PUT 要完整对象，自动回冲/入账）、`GET/POST /asset`、`/liability`（总额覆写对账用） |

改表结构后删掉 `data/` 下对应 `.db` 重启即重建（会丢数据，先备份）。

## 4. 控制台前端（`前端/`）

`前端/index.php`：单张内容卡片（`.stage` 玻璃）= 卡片头（标题/摘要 + 按版块切换的动作区 + 右上角 ☰ 菜单：五项导航与换壁纸，点外部/选导航/Esc 关闭）+ 主页状态磁贴（仅主页）+ 主页/待办/记账/监控/书签五视图（display 硬切，无刷新）。主页为「状态磁贴（待办未完成 / 当前余额 / 监控状态 / 书签总数，点击直达）+ 近期待办（可直接勾完成，逾期标红）+ 最近书签」概览。待办/记账/监控/书签四列表顶部带本地搜索框；添加/编辑走表单弹窗（挂 body、单层遮罩滚动、点遮罩/Esc/✕/取消关闭、回车保存、触屏不自动聚焦）；删除为行内两步确认（点一次变「确认删？」，3 秒内再点执行）。壁纸带调色层与磨砂面板，菜单「🎲」可手动换壁纸。

`前端/js/app.js`：视图/数据/壁纸逻辑，数据直调 `http://当前主机名:8000`（`BACKEND` 变量在文件顶部，改一处即可；HTTPS 页面调 HTTP 会被浏览器拦截），壁纸色通过 `X-Theme-Color-Hex` 同步到 `--accent`。

轻提示走自带的 `js/notify.js`（仅 Toast：`success / error / warning / info`，右上角 3 秒自动消失）；表单弹窗在 `app.js` 内实现，无外部依赖。

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
