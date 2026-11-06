#!/bin/bash
# ============================================================
# 自动更新（可选）：本项目没有容器内更新的软件，保持空操作
#   更新方式：拉取新镜像 → docker compose up -d
#   compose 里已设 UPDATE_ON_START=0，默认不会执行到这里
# ============================================================
set -euo pipefail

# 日志模块（构建时下载到 /opt/startup/log.sh）
. "$(dirname "${BASH_SOURCE[0]}")/log.sh"

log info "没有配置更新逻辑，跳过"
