"""数据模型：各业务域的表结构（字段与原功能保持一致，勿随意改列名）。

说明：
- 每个模型独占一个 SQLite 文件（见 db.py 的映射关系）。
- 时间统一存 Asia/Shanghai。
- 调试：改模型后删掉 data/ 下对应 .db 重启即重建（会丢数据，先备份）。
- 文档：字段的 title/description 会原样进 Swagger Schemas，统一中文。
"""
from datetime import date, datetime
from typing import Dict, List, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


def shanghai_now() -> datetime:
    """上海时区当前时间（展示/记录用，避免服务器时区不一致）。"""
    return datetime.now(ZoneInfo("Asia/Shanghai"))


# 待办事项（原提醒改名），支持一次性与循环两种。
# 输入口径：标题/内容/到期日/是否提醒/提醒日/循环模式；remind_time 由前端显式传入。
# 字段关系：need_remind=false 时日期置空、循环写 none（免提醒标记）；未传 remind_time 时后端按 due_time - advance_days 兜底。
class Todo(SQLModel, table=True):

    id: Optional[int] = Field(default=None, primary_key=True)

    title: str
    content: str

    processed: bool = Field(default=False)
    need_remind: bool = Field(default=False)

    due_time: Optional[date] = Field(default=None)
    remind_time: Optional[date] = Field(default=None)
    advance_days: Optional[int] = Field(default=0)

    recurring: bool = Field(default=False)
    cycle_mode: Optional[str] = Field(
        default=None
    )
    cycle_days: Optional[int] = Field(default=None)

    last_completed_date: Optional[date] = Field(default=None)
    created_at: date = Field(default_factory=date.today)


# 书签。tags 存 JSON 数组；PUT 支持逗号字符串自动转数组。
class Bookmark(SQLModel, table=True):

    id: Optional[int] = Field(default=None, primary_key=True)

    title: str
    url: str
    description: Optional[str] = Field(default=None)
    tags: List[str] = Field(
        default_factory=list, sa_column=Column(JSON)
    )
    visit_count: int = Field(default=0)
    created_at: date = Field(default_factory=date.today)


# 服务状态上报：同一 (server_name, service_name) 只保留一条（UPSERT 语义）。
# extra 兜底收纳所有非标准字段，探针想加什么字段直接塞，不用改表。
class ServerStatus(SQLModel, table=True):

    id: Optional[int] = Field(default=None, primary_key=True)

    server_name: str
    service_name: str
    content: str
    is_success: bool
    time: str

    extra: Dict = Field(default_factory=dict, sa_column=Column(JSON))

    received_at: datetime = Field(default_factory=shanghai_now)


# 账本流水。写操作会自动同步 Asset/Liability，见 utils.ledger_effect。
class Ledger(SQLModel, table=True):

    __tablename__ = "ledger_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    item: str
    amount: float
    interest: float = Field(default=0.0)
    record_type: str = Field(default="expense")
    record_date: date = Field(default_factory=date.today)
    category: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=shanghai_now)


# 资产总额，单行（id=1），由流水自动维护，也可 POST /asset 直接覆写。
class Asset(SQLModel, table=True):

    id: Optional[int] = Field(default=None, primary_key=True)
    amount: float = Field(default=0.0)
    updated_at: datetime = Field(default_factory=shanghai_now)


# 负债总额，单行（id=1），规则同 Asset。
class Liability(SQLModel, table=True):

    id: Optional[int] = Field(default=None, primary_key=True)
    amount: float = Field(default=0.0)
    updated_at: datetime = Field(default_factory=shanghai_now)
