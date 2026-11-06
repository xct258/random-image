# 变更日志

本项目所有重要变更均记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

项目使用 git 管理版本，不再保留额外的备份约定。

## [2026-11-07]

### 新增

- 按 [xct258/docker-image-template](https://github.com/xct258/docker-image-template) 重组项目（用户指示）：引入 `install/`（`app.conf` / `install.sh`）、`startup/`（`prepare.sh` / `once.sh` / `update.sh` / `services.sh` / `main.sh`）、`template/`（`Dockerfile` / `start.sh` / `supervisor.sh`）、`check.sh`、`.github/workflows/build-image.yml`。
- 镜像构建：`IMAGE_REPO=xct258/random-image`、`latest`、`linux/amd64,linux/arm64`；apt 依赖新增 `php-cli`、`imagemagick`。
- 业务代码不修改固定模板 Dockerfile、不使用 `COPY`（避免新增镜像层）：`INSTALL_CUSTOM=true`，由 `install/custom-install.sh` 在构建时用 `REPO_URL` 下载 `app/index.php` 到 `/app`，并执行 `php -l` 语法检查。
- 运行方式：`startup/services.sh` 用 `php -S 0.0.0.0:${PORT}` 托管 `/app`，端口 8181，`PHP_CLI_SERVER_WORKERS=4`。

### 变更

- 随机壁纸接口从 `var/www/html/index.php` 移到 `app/index.php`，逻辑不变。
- 缓存目录支持 `IMAGE_CACHE_DIR`（容器里指向 `/data/cache`，随数据卷保留），图库路径支持 `IMAGE_DIR_PC` / `IMAGE_DIR_PE` 环境变量覆盖。
- `docker-compose.yml` 改为模板风格：改用预构建镜像 `xct258/random-image:latest`、host 网络直占 8181、`./data:/data` 持久化日志与缓存，图库挂载改为只读。
- 根目录 `README.md` 按模板结构重写；`random-image-api-headers.md` 更新代码路径与缓存位置。
- `.gitignore` 改为忽略 `data/` 与本地缓存；新增 `.dockerignore`。

### 删除

- 删除 `var/www/html/` 目录（`index.php` 已移到 `app/`，README 已移到根目录，旧缓存删除）。
- 删除旧的 `php:apache` + 端口映射部署方式。

### 删除（项目精简）

- 项目精简为「仅随机壁纸接口」（用户指示，其它内容均为废案）：
  - 删除登录接口 `auth-api.php` 及其服务端状态文件（`.auth_users.json` / `.auth_tokens.json` / `.auth_rate_limit.json`）。
  - 删除 FastAPI 数据后端 `var/www/html/后端/`（待办/书签/监控/账本/笔记/思维导图及本地虚拟环境）。
  - 删除控制台前端 `var/www/html/前端/`（主页/仪表/待办/笔记/记账/监控/书签/思维导图）。
  - 删除旧导航工作台测试页 `1.html` / `1-test.html`。
  - 删除仪表盘设计规范 `code_artifact.md`。
