# random-image 随机壁纸 API

基于 [xct258/docker-image-template](https://github.com/xct258/docker-image-template) 的随机壁纸服务：`GET /` 从指定图库随机返回一张图片，并附带主题色、可读文字色等响应头。

通过 GitHub Actions 构建多架构镜像推到 Docker Hub，服务器上 `docker compose up -d` 即可运行。

## 目录结构

```text
.
├── app/
│   └── index.php            # 随机壁纸接口（全部业务逻辑，构建时 COPY 进镜像 /app）
├── install/
│   ├── app.conf             # 镜像名/架构/apt 依赖（php-cli、imagemagick）
│   ├── install.sh           # 构建期依赖安装（模板固定）
│   └── custom-install.sh    # 自定义安装（本项目未启用）
├── startup/
│   ├── prepare.sh           # 每次启动：建缓存目录、检查图库挂载
│   ├── once.sh              # 只执行一次（空实现）
│   ├── update.sh            # 自动更新（空实现，镜像更新靠重新拉取）
│   ├── services.sh          # 项目服务：php -S 托管 /app
│   └── main.sh              # 固定薄壳（模板）
├── template/                # 模板固定文件（Dockerfile 额外 COPY app/）
├── check.sh                 # 本地自查（push 前跑，CI 也用）
├── docker-compose.yml       # 部署配置（host 网络，端口 8181）
├── random-image-api-headers.md
└── CHANGELOG.md
```

## 接口

```text
GET /                         按 UA 自动选择 PC / 移动图库
GET /?type=pc|desktop         指定 PC 图库
GET /?type=pe|mobile          指定移动图库
GET /?exclude=pc-image-10     避开指定编号（跨域 Cookie 不可用时使用）
```

返回图片二进制，关键响应头：

| 响应头 | 说明 |
| --- | --- |
| `X-Image-Id` | 图片稳定编号（`pc-image-N` / `pe-image-N`），配合 `?exclude=` 避免连续返回同一张 |
| `X-Theme-Color-Hex` | 图片主题色（Hex） |
| `X-Theme-Color` | 图片主题色（RGB） |
| `X-Text-Color-Hex` | 保证对比度 ≥ 4.5 的可读文字色（Hex） |
| `X-Text-Color` | 可读文字色（RGB） |
| `X-Text-Contrast` | 文字/背景对比度 |
| `Content-Type` / `Content-Length` | 按扩展名判定的 MIME 与实际字节数 |

详细说明见 `random-image-api-headers.md`。

## 图库

默认路径（可用环境变量覆盖）：

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `IMAGE_DIR_PC` | `/home/xct258/images/pc/` | PC 图库 |
| `IMAGE_DIR_PE` | `/home/xct258/images/pe/` | 移动图库 |
| `IMAGE_CACHE_DIR` | 代码同级目录 | 缓存目录；容器里设为 `/data/cache` |
| `PORT` | `8181` | 监听端口 |

`docker-compose.yml` 把宿主机图库以只读方式挂载进容器：

```yaml
- /mnt/ssd-1/xct258/图片/网页背景图/pc:/home/xct258/images/pc:ro
- /mnt/ssd-1/xct258/图片/网页背景图/pe:/home/xct258/images/pe:ro
```

支持 `jpg` / `jpeg` / `png` / `gif` / `webp`，会递归扫描子目录。主题色由镜像内的 ImageMagick `convert` 提取。

## 构建

只通过 GitHub Actions 构建：push 后到 Actions 页面手动触发 **Build and Push Docker Image**。

- 配置来源：`install/app.conf`（`IMAGE_REPO=xct258/random-image`、`IMAGE_TAG=latest`）
- 需要 Secrets：`DOCKERACC` / `DOCKERPWD`
- 产物：`xct258/random-image:latest`（amd64 + arm64）

## 部署

```bash
docker compose pull
docker compose up -d
# 访问 http://主机:8181/
```

`network_mode: host` 直接占用宿主机 8181 端口；日志与缓存落在 `./data`。

查看日志：

```bash
docker logs random-image
tail -f data/logs/service/web.log
```

## 缓存

`/data/cache` 下三个文件都是运行时缓存，删掉会自动重建：

- `.color_cache.json` — 图片路径 → 主题色
- `.image_list_cache.json` — 图库文件列表
- `.image_id_map.json` — 图片路径 → 稳定编号

## 版本管理

项目使用 git 管理：变更提交到仓库，重要变更同步记入 `CHANGELOG.md`。push 前先跑 `bash check.sh` 自查。
