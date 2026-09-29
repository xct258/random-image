"""服务状态上报与查询（给各机器探针用）。

语义：同一 (server_name, service_name) 只保留一条记录，后报覆盖先报（UPSERT）。
`extra` 兜底收纳所有非标准字段，探针加字段不用改表。

调试速查::

    $ curl -X POST localhost:8000/server/status -H 'Content-Type: application/json' \\
        -d '{"server_name":"openwrt","service_name":"wan","content":"光纤在线","is_success":true}'
    $ curl "localhost:8000/server/status?server_name=openwrt&limit=10"
"""
from datetime import datetime
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from db import get_server_status_session
from models import ServerStatus, shanghai_now

router = APIRouter()

# 必填字段：缺一即 400，顺手告诉调用方缺了谁
REQUIRED_FIELDS = ["server_name", "service_name", "content", "is_success"]


def _parse_is_success(raw) -> bool:
    """is_success 兼容布尔与大小写字符串，其余一律 400。"""
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, str) and raw.lower() in ("true", "false"):
        return raw.lower() == "true"
    raise HTTPException(status_code=400, detail="is_success must be true or false (case-insensitive)")


@router.post("/server/status", response_model=ServerStatus)
def receive_server_status(payload: dict, session: Session = Depends(get_server_status_session)):
    for field in REQUIRED_FIELDS:
        if field not in payload:
            raise HTTPException(status_code=400, detail=f"Missing field: {field}")

    server_name = payload.pop("server_name")
    service_name = payload.pop("service_name")
    content = payload.pop("content")
    is_success = _parse_is_success(payload.pop("is_success"))
    time_val = payload.pop("time", datetime.now(ZoneInfo("Asia/Shanghai")).isoformat())
    extra_info = payload  # 剩下的全是 extra

    stmt = select(ServerStatus).where(
        ServerStatus.server_name == server_name,
        ServerStatus.service_name == service_name,
    )
    existing = session.exec(stmt).first()

    if existing:
        # 已有记录：原地覆盖并刷新收到时间
        existing.content = content
        existing.is_success = is_success
        existing.time = time_val
        existing.extra = extra_info
        existing.received_at = shanghai_now()
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing

    status = ServerStatus(
        server_name=server_name,
        service_name=service_name,
        content=content,
        is_success=is_success,
        time=time_val,
        extra=extra_info,
    )

    session.add(status)
    session.commit()
    session.refresh(status)
    return status


@router.get("/server/status", response_model=List[ServerStatus])
def list_server_status(
    server_name: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=2000),
    session: Session = Depends(get_server_status_session),
):
    stmt = select(ServerStatus)

    if server_name:
        stmt = stmt.where(ServerStatus.server_name == server_name)

    stmt = stmt.order_by(ServerStatus.received_at.desc()).limit(limit)
    return session.exec(stmt).all()
