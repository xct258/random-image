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

    elif mode == "weekly":
        return base_date + timedelta(weeks=1)

    elif mode == "monthly" or mode == "month_start":
        year = base_date.year + (1 if base_date.month == 12 else 0)
        month = 1 if base_date.month == 12 else base_date.month + 1
        try:
            return date(year, month, base_date.day)
        except ValueError:
            # 1月31日 -> 2月取末日，避免非法日期
            last_day = calendar.monthrange(year, month)[1]
            return date(year, month, last_day)

    elif mode == "yearly":
        try:
            return date(base_date.year + 1, base_date.month, base_date.day)
        except ValueError:
            # 闰年 2-29 -> 平年 2-28
            return date(base_date.year + 1, 2, 28)

    elif mode == "days":
        days = todo.cycle_days or 1
        return base_date + timedelta(days=days)

    # 未知模式 fallback：与 daily 一致
    return base_date + timedelta(days=1)


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
