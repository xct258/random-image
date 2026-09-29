"""书签接口：GET(列表) POST(新建) PUT(更新) DELETE(删除) POST visit(访问计数+1)。

调试速查::

    $ curl localhost:8000/bookmarks
    $ curl -X POST localhost:8000/bookmarks -H 'Content-Type: application/json' \\
        -d '{"title":"OpenWrt","url":"openwrt.org","tags":["路由"]}'
    $ curl -X PUT localhost:8000/bookmarks/1 -H 'Content-Type: application/json' \\
        -d '{"tags":"路由, 内网"}'
    $ curl -X POST localhost:8000/bookmarks/1/visit
    $ curl -X DELETE localhost:8000/bookmarks/1
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlmodel import Session, select

from db import get_bookmark_session
from models import Bookmark

router = APIRouter()


def _ensure_scheme(url: str) -> str:
    """缺协议头自动补 https://（浏览器地址栏同款直觉）。"""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


@router.get("/bookmarks", response_model=List[Bookmark])
def get_bookmarks(
    limit: int = Query(200, ge=1, le=2000),
    session: Session = Depends(get_bookmark_session),
):
    return session.exec(select(Bookmark).order_by(Bookmark.id).limit(limit)).all()


@router.post("/bookmarks", response_model=Bookmark)
def create_bookmark(bm: Bookmark, session: Session = Depends(get_bookmark_session)):
    bm.url = _ensure_scheme(bm.url)

    session.add(bm)
    session.commit()
    session.refresh(bm)
    return bm


@router.put("/bookmarks/{bid}", response_model=Bookmark)
def update_bookmark(
    bid: int = Path(...),
    payload: dict = ...,
    session: Session = Depends(get_bookmark_session),
):
    b = session.get(Bookmark, bid)
    if not b:
        raise HTTPException(404, "Bookmark not found")

    if "title" in payload:
        b.title = payload["title"]
    if "url" in payload:
        b.url = _ensure_scheme(payload["url"])
    if "description" in payload:
        b.description = payload["description"]
    if "tags" in payload:
        tags = payload["tags"]
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",") if t.strip()]
        b.tags = tags

    session.commit()
    session.refresh(b)
    return b


@router.post("/bookmarks/{bid}/visit", response_model=Bookmark)
def visit_bookmark(
    bid: int = Path(...),
    session: Session = Depends(get_bookmark_session),
):
    """书签被点击一次，访问计数 +1（前端点击链接时顺手调，不阻塞跳转）。"""
    b = session.get(Bookmark, bid)
    if not b:
        raise HTTPException(404, "Bookmark not found")

    b.visit_count = (b.visit_count or 0) + 1

    session.commit()
    session.refresh(b)
    return b


@router.delete("/bookmarks/{bid}")
def delete_bookmark(
    bid: int = Path(...),
    session: Session = Depends(get_bookmark_session),
):
    b = session.get(Bookmark, bid)
    if not b:
        raise HTTPException(404, "Bookmark not found")
    session.delete(b)
    session.commit()
    return {"message": "Deleted"}
