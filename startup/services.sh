#!/bin/bash
# ============================================================
# 项目专属：启动随机壁纸接口
#
# PHP 内置服务器直接托管 /app（index.php），端口由 PORT 控制。
# 服务日志：/data/logs/service/web.log
# ============================================================
set -euo pipefail

SERVICE_NAMES=(web)
SERVICE_STOP_TIMEOUT=([web]=10)
SERVICE_PORT=${PORT:-8181}

start_web() {
    run_service web php \
        -d display_errors=0 \
        -d log_errors=1 \
        -S "0.0.0.0:${PORT:-8181}" \
        -t /app
}

# 默认由 supervisor 发 TERM，无需专用停止命令
# stop_web() { :; }
