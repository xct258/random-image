"""工具函数：日期解析、循环周期计算、账本资金影响、一次性迁移。

说明：
- 纯函数优先（无 DB 依赖），方便单独调试::

    $ python -c "from utils import calc_next_due; help(calc_next_due)"
"""
import calendar
from datetime import date, datetime, timedelta
from typing import Tuple
from zoneinfo import ZoneInfo

from sqlmodel import Session


def parse_due_date(raw: str) -> date:
    """把前端传来的各种日期写法统一成 date。

    :param raw: 'YYYY-MM-DD' / ISO datetime / 带 Z 的 UTC 时间
    :return: Asia/Shanghai 当天的 date
    :raises ValueError: 空串或解析失败（调用方转 400）

    调试示例::

        $ python -c "from utils import parse_due_date; print(parse_due_date('2026-09-10T10:00'))"
    """
    if not raw:
        raise ValueError("due_time is empty")

    raw = raw.strip()
    if raw.endswith("Z"):
        raw = raw.replace("Z", "+00:00")

    if len(raw) == 10:
        return date.fromisoformat(raw)

    dt = datetime.fromisoformat(raw)
    if dt.tzinfo:
        dt = dt.astimezone(ZoneInfo("Asia/Shanghai"))
    else:
        dt = dt.replace(tzinfo=ZoneInfo("Asia/Shanghai"))

    return dt.date()


def _add_months(d: date, n: int) -> date:
    """加 n 个月（锚定 d.day，月末自动收敛到当月最后一天）。"""
    total = (d.month - 1) + n
    year = d.year + total // 12
    month = total % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(d.day, last_day))


def _add_years(d: date, n: int) -> date:
    """加 n 年（2-29 遇到平年收敛到 2-28）。"""
    try:
        return d.replace(year=d.year + n)
    except ValueError:
        return d.replace(year=d.year + n, month=2, day=28)


def calc_next_due(todo, base_date: date) -> date:
    """按循环规则算下一次到期日（只读不写，调用方负责落库）。

    :param todo: Todo 对象（读 cycle_mode / cycle_days）
    :param base_date: 起算日（一般取当前 due_time）
    :return: 下一次 due_time

    规则：daily +1天；weekly +1周；monthly/month_start 下月同日（月末兜底）；
    yearly 明年同期（2-29 闰年兜底）；days 按 cycle_days。
    """
    mode = todo.cycle_mode

    if mode == "daily":
        return base_date + timedelta(days=1)
    if mode == "weekly":
        return base_date + timedelta(weeks=1)
    if mode in ("monthly", "month_start"):
        return _add_months(base_date, 1)
    if mode == "yearly":
        return _add_years(base_date, 1)
    if mode == "days":
        return base_date + timedelta(days=todo.cycle_days or 1)
    # 未知模式 fallback：与 daily 一致
    return base_date + timedelta(days=1)


def calc_next_due_after(todo, base_date: date, today: date) -> date:
    """下一次到期日，且严格大于 today（跳过已错过的周期，不再“补做”过去）。

    - base_date 通常取当前 due_time；daily 一律顺延到明天（今天之后）。
    - monthly/yearly 以 base_date 的“日”为锚点，避免逐周期累加造成的日期漂移。
    """
    nxt = calc_next_due(todo, base_date)
    if nxt > today:
        return nxt

    mode = todo.cycle_mode
    if mode == "days":
        step = todo.cycle_days or 1
        k = max(1, ((today - base_date).days // step) + 1)
        return base_date + timedelta(days=step * k)
    if mode in ("monthly", "month_start"):
        n = max(1, (today.year - base_date.year) * 12 + (today.month - base_date.month))
        cand = _add_months(base_date, n)
        while cand <= today:
            n += 1
            cand = _add_months(base_date, n)
        return cand
    if mode == "yearly":
        n = max(1, today.year - base_date.year)
        cand = _add_years(base_date, n)
        while cand <= today:
            n += 1
            cand = _add_years(base_date, n)
        return cand
    # daily / weekly / 未知：固定步长推进
    step_days = 7 if mode == "weekly" else 1
    k = max(1, ((today - base_date).days // step_days) + 1)
    return base_date + timedelta(days=step_days * k)


def ledger_effect(record_type: str, amount: float, interest: float = 0.0) -> Tuple[float, float]:
    """一笔流水对资产/负债的影响，返回 (asset_delta, liability_delta)。

    规则（与原逻辑逐行对过，保持一致）：
    - income    收入：资产 += amount
    - expense   支出：资产 -= amount
    - debt_in   借入：资产 += amount，负债 += amount
    - debt_out  还款：资产 -= (amount + interest)，负债 -= amount（本金）

    调试示例::

        $ python -c "from utils import ledger_effect; print(ledger_effect('debt_out', 100, 5))"
        (-105.0, -100.0)
    """
    amount = float(amount or 0.0)
    interest = float(interest or 0.0)
    if record_type == "income":
        return (amount, 0.0)
    elif record_type == "expense":
        return (-amount, 0.0)
    elif record_type == "debt_in":
        return (amount, amount)
    elif record_type == "debt_out":
        return (-(amount + interest), -amount)
    return (0.0, 0.0)


def get_or_create_singleton(session: Session, model, row_id: int = 1):
    """取资产/负债单行（id=1），不存在则建 0 行。返回对象（调用方负责 commit）。"""
    row = session.get(model, row_id)
    if not row:
        row = model(id=row_id, amount=0.0)
        session.add(row)
    return row
