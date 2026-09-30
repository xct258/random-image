# 随机图片 API 响应头中的图片信息

接口：`GET http://主机:8181/`（`var/www/html/index.php:47-57`，`serveRandomImage()`）

## 图片信息头（6 个）

| 响应头 | 示例 | 说明 |
| --- | --- | --- |
| `X-Image-Id` | `pc-image-10` | 图片稳定编号，前缀 `pc-image-N` / `pe-image-N`，映射存 `.image_id_map.json`；下次请求带 `?exclude=<id>` 可避开上一张 |
| `X-Theme-Color` | `rgb(209, 203, 212)` | 图片主题色（RGB 写法，ImageMagick 取主色） |
| `X-Theme-Color-Hex` | `#d1cbd4` | 同上，Hex 写法（前端 `--accent` 联动用这个） |
| `X-Text-Color` | `rgb(66, 58, 70)` | 按背景算出的可读文字色（RGB 写法，保证对比度） |
| `X-Text-Color-Hex` | `#423a46` | 同上，Hex 写法 |
| `X-Text-Contrast` | `6.86` | 文字/背景对比度，目标 ≥ 4.5 |

## 配套头（非图片内容，但调用时有用）

- `Content-Type: image/jpeg` — 按扩展名判定（jpg/png/gif/webp）
- `Content-Length: 247679` — 文件字节数
- `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` — 禁用缓存，保证每次随机
- `Access-Control-Allow-Origin: *` + `Access-Control-Expose-Headers: X-Theme-Color, X-Theme-Color-Hex, X-Text-Color, X-Text-Color-Hex, X-Text-Contrast, X-Image-Id, Content-Length` — 允许前端 JS 读取上述自定义头
- `Set-Cookie: last_image_path_<sha256>=<指纹>` — 服务端防连出同图（30 天有效；跨域 Cookie 不可用时用 `?exclude=` 代替）

## 实测示例

```http
HTTP/1.1 200 OK
Content-Length: 247679
Content-Type: image/jpeg
X-Theme-Color: rgb(209, 203, 212)
X-Theme-Color-Hex: #d1cbd4
X-Text-Color: rgb(66, 58, 70)
X-Text-Color-Hex: #423a46
X-Text-Contrast: 6.86
X-Image-Id: pc-image-10
```

复现命令：`curl -sD - -o /dev/null "http://127.0.0.1:8181/?type=pc"`
