# 变更日志

本项目所有重要变更均记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

项目使用 git 管理版本，不再保留额外的备份约定。

## [2026-11-07]

### 删除

- 项目精简为「仅随机壁纸接口」（用户指示，其它内容均为废案）：
  - 删除登录接口 `auth-api.php` 及其服务端状态文件（`.auth_users.json` / `.auth_tokens.json` / `.auth_rate_limit.json`）。
  - 删除 FastAPI 数据后端 `var/www/html/后端/`（待办/书签/监控/账本/笔记/思维导图及本地虚拟环境）。
  - 删除控制台前端 `var/www/html/前端/`（主页/仪表/待办/笔记/记账/监控/书签/思维导图）。
  - 删除旧导航工作台测试页 `1.html` / `1-test.html`。
  - 删除仪表盘设计规范 `code_artifact.md`。
  - 保留 `var/www/html/index.php`（随机壁纸接口）、`docker-compose.yml`、壁纸相关缓存与 `random-image-api-headers.md`；`README.md` 按现状重写。

### 变更

- `.gitignore` 移除已不存在的 Python / 鉴权状态条目，只保留壁纸接口缓存与杂项。
