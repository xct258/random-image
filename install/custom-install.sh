#!/bin/bash
# ============================================================
# 自定义安装脚本（构建时执行一次）
#   从同一仓库下载随机壁纸接口到 /app
#   REPO_URL 由 Dockerfile 的 ARG 传入（CI 固定到当前提交 SHA），
#   在 install.sh 调用本脚本时作为环境变量可见。
#   不修改固定模板 Dockerfile，也不额外增加镜像层。
# ============================================================
set -euo pipefail

echo "[custom] 目标架构: ${TARGETARCH:-unknown}"

if [ -z "${REPO_URL:-}" ]; then
    echo "[custom] 错误：REPO_URL 为空，无法下载 app/index.php（构建时传 --build-arg REPO_URL=...）" >&2
    exit 1
fi

# 拉取业务代码（重试次数与模板一致：3 次、间隔 5s、单次 30s）
fetch() {
    wget -nv --tries=3 --waitretry=5 --timeout=30 -O "$2" "$1" || {
        echo "[custom] 下载失败（exit $?）：$1" >&2
        exit 1
    }
}

mkdir -p /app
fetch "${REPO_URL}/app/index.php" /app/index.php
chmod 644 /app/index.php

# 装完顺手做一次语法检查，构建期就能发现 PHP 错误
php -l /app/index.php

echo "[custom] 随机壁纸接口安装完成"
