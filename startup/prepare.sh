#!/bin/bash
# ============================================================
# 启动前的准备：每次启动容器都执行（docker restart 也会执行）
# ============================================================
set -euo pipefail

# 日志模块（构建时下载到 /opt/startup/log.sh）
. "$(dirname "${BASH_SOURCE[0]}")/log.sh"

# 缓存目录（主题色 / 图片列表 / 图片编号），指向数据卷，重建容器不丢
cache_dir=${IMAGE_CACHE_DIR:-/data/cache}
mkdir -p "$cache_dir"

# 图库目录由 docker-compose 挂载；缺失时只告警，接口会返回明确错误
for dir in "${IMAGE_DIR_PC:-/home/xct258/images/pc}" "${IMAGE_DIR_PE:-/home/xct258/images/pe}"; do
    [ -d "$dir" ] || log -f warn "图库目录不存在：$dir（检查 docker-compose.yml 的挂载）"
done

log info "完成"
