"""待办接口（原提醒改名，路由 /todos；字段 remind_time 等历史列名保留）。

输入口径：标题(title)/内容(content)/到期日(due_time)/是否提醒(need_remind)/提醒日(remind_time)/循环模式(cycle_mode)。
- ``need_remind`` 显式传入为准；false 时日期置空、循环写 none（免提醒标记）。
- ``remind_time`` 显式传入为准；不传时按 ``due_time - advance_days`` 兜底。
- 循环模式：``once``（或不传）= 一次性；``daily/weekly/monthly/month_start/yearly/days``
  = 循环（``recurring`` 自动置 True，``days`` 模式再配 ``cycle_days``）。

核心概念：
- 一次性任务：``PUT /todos/{rid}/processed`` 后 ``processed=True``，不再出现。
- 循环任务（``recurring=True``）：打卡后按 ``cycle_mode`` 算出下一次 ``due_time``，
  ``processed`` 保持 False。daily 任务直接顺延到明天（不管拖欠几天）。

调试速查::

    $ curl localhost:8000/todos
    $ curl -X POST localhost:8000/todos -H 'Content-Type: application/json' \\
        -d '{"title":"交电费","content":"主卧电表","due_time":"2026-09-15","remind_time":"2026-09-14"}'
    $ curl -X POST localhost:8000/todos -H 'Content-Type: application/json' \\
        -d '{"title":"浇花","content":"阳台","cycle_mode":"daily"}'
    $ curl -X PUT localhost:8000/todos/1/processed
    $ curl -X DELETE localhost:8000/todos/1
"""
from datetime import date, datetime, timedelta
from typing import List
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlmodel import Session, select

from db import get_todo_session
from models import Todo
from utils import calc_next_due, parse_due_date

router = APIRouter()

# 免提醒标记：循环写 none（区别于一次性的空值）；日期直接置空
NO_CYCLE = "none"


def _normalize_cycle(data) -> None:
    """统一循环语义：传了有效 cycle_mode 即循环；once/空即一次性。"""
    mode = data.cycle_mode.strip() if isinstance(data.cycle_mode, str) else data.cycle_mode
    if mode and mode not in ("once", "none"):
        data.recurring = True
        data.cycle_mode = mode
    else:
        data.recurring = False
        data.cycle_mode = None
    if data.recurring and not data.cycle_mode:
        data.cycle_mode = "daily"


def _parse_date_field(raw) -> date:
    """到期/提醒日统一解析：date 直接用，字符串走 parse_due_date。"""
    if isinstance(raw, date):
        return raw
    return parse_due_date(str(raw))


@router.get("/todos", response_model=List[Todo])
def get_todos(
    limit: int = Query(200, ge=1, le=2000),
    session: Session = Depends(get_todo_session),
):
    return session.exec(select(Todo).order_by(Todo.id).limit(limit)).all()


@router.post("/todos", response_model=Todo)
def create_todo(data: Todo, session: Session = Depends(get_todo_session)):
    today = datetime.now(ZoneInfo("Asia/Shanghai")).date()

    data.created_at = today
    data.need_remind = bool(data.need_remind)

    if not (data.title or "").strip() or not (data.content or "").strip():
        raise HTTPException(400, "title and content are required")

    if not data.need_remind:
        # 不提醒：日期置空、循环写 none，只留标题内容
        data.due_time = None
        data.remind_time = None
        data.recurring = False
        data.cycle_mode = NO_CYCLE
    else:
        if not data.due_time:
            data.due_time = today
        else:
            # 字符串写法容错：解析失败则落到今天
            try:
                data.due_time = _parse_date_field(data.due_time)
            except Exception:
                data.due_time = today

        if data.remind_time:
            # 显式传入的提醒日为准
            try:
                data.remind_time = _parse_date_field(data.remind_time)
            except Exception:
                data.remind_time = data.due_time
        else:
            adv = data.advance_days or 0
            data.remind_time = data.due_time - timedelta(days=adv)
        _normalize_cycle(data)

    session.add(data)
    session.commit()
    session.refresh(data)
    return data


@router.put("/todos/{rid}", response_model=Todo)
def update_todo(
    rid: int = Path(...),
    payload: dict = ...,
    session: Session = Depends(get_todo_session),
):
    r = session.get(Todo, rid)
    if not r:
        raise HTTPException(404, "Todo not found")

    today = datetime.now(ZoneInfo("Asia/Shanghai")).date()

    for field in ["title", "content"]:
        if field in payload:
            setattr(r, field, payload[field])

    if "processed" in payload:
        # 允许重新打开（误触完成可撤销；循环行打卡后也可回退）
        r.processed = bool(payload["processed"])

    if "need_remind" in payload:
        r.need_remind = bool(payload["need_remind"])

    if not r.need_remind:
        # 不提醒：日期置空、循环写 none，只留标题内容
        r.due_time = None
        r.remind_time = None
        r.recurring = False
        r.cycle_mode = NO_CYCLE
    else:
        if not r.due_time:
            r.due_time = today
        for field in ["advance_days", "recurring", "cycle_mode", "cycle_days"]:
            if field in payload:
                setattr(r, field, payload[field])

        if "due_time" in payload and payload["due_time"]:
            try:
                r.due_time = _parse_date_field(payload["due_time"])
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid due_time format")

        if "remind_time" in payload and payload["remind_time"]:
            # 显式传入的提醒日为准
            try:
                r.remind_time = _parse_date_field(payload["remind_time"])
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid remind_time format")
        elif r.due_time and ("due_time" in payload or "advance_days" in payload or not r.remind_time):
            # 只在改到期日/提前天数、或提醒日本来缺失时重算；无关编辑不再覆盖显式提醒日
            adv = r.advance_days or 0
            r.remind_time = r.due_time - timedelta(days=adv)

        if "cycle_mode" in payload:
            _normalize_cycle(r)
        elif r.recurring and not r.cycle_mode:
            r.cycle_mode = "daily"

    session.commit()
    session.refresh(r)
    return r


@router.put("/todos/{rid}/processed")
def mark_processed(
    rid: int = Path(...),
    session: Session = Depends(get_todo_session),
):
    r = session.get(Todo, rid)
    if not r:
        raise HTTPException(404, "Todo not found")

    today = datetime.now(ZoneInfo("Asia/Shanghai")).date()
    r.last_completed_date = today

    if r.recurring:
        base_due = r.due_time or today

        if r.cycle_mode == "daily":
            # 每日打卡直觉：不管拖欠几天，一律顺延到明天
            next_due = today + timedelta(days=1)
        else:
            next_due = calc_next_due(r, base_due)

        r.due_time = next_due

        adv = r.advance_days or 0
        r.remind_time = next_due - timedelta(days=adv)

        r.processed = False
    else:
        r.processed = True

    session.commit()
    session.refresh(r)
    return r


@router.delete("/todos/{rid}")
def delete_todo(
    rid: int = Path(...),
    session: Session = Depends(get_todo_session),
):
    r = session.get(Todo, rid)
    if not r:
        raise HTTPException(404, "Todo not found")
    session.delete(r)
    session.commit()
    return {"message": "Deleted"}
