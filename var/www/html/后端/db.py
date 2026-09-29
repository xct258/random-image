"""数据库层：引擎、会话工厂、建表。

说明：
- 每个业务域独占一个 SQLite 文件，都放在 ``data/`` 下（目录不存在自动创建）。
- 为兼容旧逻辑，会话获取失败（表不存在）时自动建表后重试一次。
- 调试：库文件可直接用 ``sqlite3 data/todos.db ".tables"`` 查看。

    $ sqlite3 data/ledger.db "select id,item,amount from ledger_items limit 5;"
"""
from pathlib import Path

from sqlalchemy.exc import OperationalError
from sqlmodel import Session, SQLModel, create_engine

from models import Asset, Bookmark, Ledger, Liability, Todo, ServerStatus

# ---------------------------------------------------------------------------
# 路径：以本文件所在目录为基准，data/ 与代码同级
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# 各域数据库 URL（新增业务域时在这里加一行，并在 ENGINES 里注册）
# ---------------------------------------------------------------------------
DATABASE_URLS = {
    "todo": f"sqlite:///{DATA_DIR / 'todos.db'}",
    "bookmark": f"sqlite:///{DATA_DIR / 'bookmarks.db'}",
    "server_status": f"sqlite:///{DATA_DIR / 'server_status_v2.db'}",
    "ledger": f"sqlite:///{DATA_DIR / 'ledger.db'}",
}

# 每个文件一个引擎；SQLite 单线程校验关掉以支持多线程 serve
# 调试：连接串打错时这里会直接抛，服务起不来，先检查 data/ 是否可写
ENGINES = {
    name: create_engine(url, connect_args={"check_same_thread": False})
    for name, url in DATABASE_URLS.items()
}

todo_engine = ENGINES["todo"]
bookmark_engine = ENGINES["bookmark"]
server_status_engine = ENGINES["server_status"]
ledger_engine = ENGINES["ledger"]


def make_session_getter(engine, *tables, name="session"):
    """生成 FastAPI 依赖用的会话工厂。

    :param engine: 该域的 sqlalchemy 引擎
    :param tables: 该域的表对象；首次访问表不存在（OperationalError）时建表后重试
    :param name: 调试用名，会出现在报错堆栈里
    :return: 可直接用于 ``Depends()`` 的生成器函数

    用法示例::

        get_todo_session = make_session_getter(todo_engine, Todo.__table__, name="todo")
    """

    def _getter():
        try:
            with Session(engine) as session:
                yield session
        except OperationalError:
            # 表还没建（首次启动/库文件被删），建表后重试一次
            SQLModel.metadata.create_all(engine, tables=list(tables))
            with Session(engine) as session:
                yield session

    _getter.__name__ = f"get_{name}_session"
    return _getter


def init_db() -> None:
    """建全库表（启动时调一次即可，表已存在时是空操作）。"""
    SQLModel.metadata.create_all(todo_engine, tables=[Todo.__table__])
    SQLModel.metadata.create_all(bookmark_engine, tables=[Bookmark.__table__])
    SQLModel.metadata.create_all(
        server_status_engine, tables=[ServerStatus.__table__]
    )
    SQLModel.metadata.create_all(
        ledger_engine,
        tables=[Ledger.__table__, Asset.__table__, Liability.__table__],
    )


# ---------------------------------------------------------------------------
# 各域会话依赖（routers 里直接 Depends(get_todo_session) 即可）
# ---------------------------------------------------------------------------
get_todo_session = make_session_getter(
    todo_engine, Todo.__table__, name="todo"
)
get_bookmark_session = make_session_getter(
    bookmark_engine, Bookmark.__table__, name="bookmark"
)
get_server_status_session = make_session_getter(
    server_status_engine, ServerStatus.__table__, name="server_status"
)
get_ledger_session = make_session_getter(
    ledger_engine, Ledger.__table__, Asset.__table__, Liability.__table__,
    name="ledger",
)
