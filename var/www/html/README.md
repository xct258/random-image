# random-image 随机壁纸接口

一个自用的随机图片服务：`GET /` 直接从指定图库随机返回一张图片，并附带图片主题色、可读文字色等响应头。

## 目录结构

```text
.
├─ docker-compose.yml           PHP 服务（php:apache，宿主 8181 → 容器 80）
├─ CHANGELOG.md                 变更记录
├─ random-image-api-headers.md  响应头说明
└─ var/www/html/                网站根目录（挂载进容器）
   ├─ index.php                随机壁纸接口（全部逻辑）
   ├─ README.md                本文件
   └─ .color_cache.json        图片主题色缓存（自动重建）
      .image_list_cache.json   图片列表缓存（自动重建）
      .image_id_map.json       图片编号映射（自动重建）
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

图片信息头详见 `random-image-api-headers.md`。

## 图库配置

图库路径写在 `var/www/html/index.php` 顶部的 `$config['folders']`：

```php
'desktop' => ['path' => '/home/xct258/images/pc/', 'id_prefix' => 'pc-image'],
'mobile'  => ['path' => '/home/xct258/images/pe/', 'id_prefix' => 'pe-image'],
```

容器内路径由 `docker-compose.yml` 的挂载决定：

```yaml
- /mnt/ssd-1/xct258/图片/网页背景图/pc:/home/xct258/images/pc
- /mnt/ssd-1/xct258/图片/网页背景图/pe:/home/xct258/images/pe
```

支持 `jpg` / `jpeg` / `png` / `gif` / `webp`，会递归扫描子目录。

## 运行

```bash
docker compose up -d
# 访问 http://主机:8181/
```

主题色提取依赖 ImageMagick 的 `convert` 命令。当前 `php:apache` 官方镜像默认**不包含** ImageMagick：缺少时接口仍能返回图片，但主题色会回退为固定值 `#34495e`。如需真实取色，需自行构建镜像安装 ImageMagick。

## 缓存

`.color_cache.json`（图片路径 → 主题色）、`.image_list_cache.json`（图库文件列表）、`.image_id_map.json`（图片路径 → 稳定编号）都是运行时缓存，删掉后会自动重建。

## 版本管理

项目使用 git 管理：变更提交到仓库，重要变更同步记入 `CHANGELOG.md`。
