"""账本接口：流水增删改查 + 资产/负债总额读写。

资金规则（集中在 utils.ledger_effect，一处改全局生效）：
- income    收入：资产 += amount
- expense   支出：资产 -= amount
- debt_in   借入：资产 += amount，负债 += amount
- debt_out  还款：资产 -= (amount + interest)，负债 -= amount（本金）

新增/修改/删除流水时，Asset(id=1) / Liability(id=1) 自动同步。
也可 POST /asset、POST /liability 直接覆写总额（对账用）。

调试速查::

    $ curl localhost:8000/ledger | head -c 300
    $ curl -X POST localhost:8000/ledger -H 'Content-Type: application/json' \\
        -d '{"item":"午餐","amount":22,"record_type":"expense","record_date":"2026-09-10"}'
    $ curl localhost:8000/asset
    $ curl -X POST localhost:8000/asset -H 'Content-Type: application/json' -d '{"amount":1000}'
"""
from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlmodel import Session, select

from db import get_ledger_session
from models import Asset, Ledger, Liability, shanghai_now
from utils import get_or_create_singleton, ledger_effect

router = APIRouter()


def _touch_assets(session: Session):
    """资产/负债行取出来（不存在则建 0 行）并刷新时间戳。返回 (asset, liability)。"""
    asset = get_or_create_singleton(session, Asset)
    liability = get_or_create_singleton(session, Liability)
    asset.updated_at = shanghai_now()
    liability.updated_at = shanghai_now()
    session.add(asset)
    session.add(liability)
    return asset, liability


@router.get("/ledger", response_model=List[Ledger])
def get_ledger(
    limit: int = Query(200, ge=1, le=2000),
    session: Session = Depends(get_ledger_session),
):
    return (
        session.exec(
            select(Ledger)
            .order_by(Ledger.record_date.desc(), Ledger.id.desc())
            .limit(limit)
        ).all()
    )


@router.post("/ledger", response_model=Ledger)
def create_ledger(ledger: Ledger, session: Session = Depends(get_ledger_session)):
    if isinstance(ledger.record_date, str):
        ledger.record_date = date.fromisoformat(ledger.record_date)

    session.add(ledger)

    asset, liability = _touch_assets(session)
    da, dl = ledger_effect(ledger.record_type, ledger.amount, ledger.interest)
    asset.amount += da
    liability.amount += dl

    session.commit()
    session.refresh(ledger)
    return ledger


@router.put("/ledger/{ledger_id}", response_model=Ledger)
def update_ledger(
    ledger_id: int = Path(...),
    updated: Ledger = ...,
    session: Session = Depends(get_ledger_session),
):
    item = session.get(Ledger, ledger_id)
    if not item:
        raise HTTPException(404, "Ledger item not found")

    asset, liability = _touch_assets(session)

    # 1. 冲销旧影响
    old_da, old_dl = ledger_effect(item.record_type, item.amount, item.interest)
    asset.amount -= old_da
    liability.amount -= old_dl

    # 2. 落新值
    if isinstance(updated.record_date, str):
        updated.record_date = date.fromisoformat(updated.record_date)

    item.item = updated.item
    item.amount = updated.amount
    item.interest = updated.interest
    item.record_type = updated.record_type
    item.record_date = updated.record_date
    item.category = updated.category
    item.notes = updated.notes

    # 3. 入账新影响
    new_da, new_dl = ledger_effect(item.record_type, item.amount, item.interest)
    asset.amount += new_da
    liability.amount += new_dl

    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.delete("/ledger/{ledger_id}")
def delete_ledger(
    ledger_id: int = Path(...),
    session: Session = Depends(get_ledger_session),
):
    ledger = session.get(Ledger, ledger_id)
    if not ledger:
        raise HTTPException(404, "Ledger item not found")

    asset, liability = _touch_assets(session)
    da, dl = ledger_effect(ledger.record_type, ledger.amount, ledger.interest)
    asset.amount -= da
    liability.amount -= dl

    session.delete(ledger)
    session.commit()
    return {"message": "Deleted"}


@router.get("/asset", response_model=Asset)
def get_asset(session: Session = Depends(get_ledger_session)):
    asset = session.get(Asset, 1)
    if not asset:
        asset = Asset(id=1, amount=0.0)
        session.add(asset)
        session.commit()
        session.refresh(asset)
    return asset


@router.post("/asset", response_model=Asset)
def update_asset(payload: dict, session: Session = Depends(get_ledger_session)):
    amount = payload.get("amount")
    if amount is None:
        raise HTTPException(400, "amount is required")

    asset = session.get(Asset, 1)
    if not asset:
        asset = Asset(id=1, amount=0.0)

    asset.amount = float(amount)
    asset.updated_at = shanghai_now()
    session.add(asset)
    session.commit()
    session.refresh(asset)
    return asset


@router.get("/liability", response_model=Liability)
def get_liability(session: Session = Depends(get_ledger_session)):
    liability = session.get(Liability, 1)
    if not liability:
        liability = Liability(id=1, amount=0.0)
        session.add(liability)
        session.commit()
        session.refresh(liability)
    return liability


@router.post("/liability", response_model=Liability)
def update_liability(payload: dict, session: Session = Depends(get_ledger_session)):
    amount = payload.get("amount")
    if amount is None:
        raise HTTPException(400, "amount is required")

    liability = session.get(Liability, 1)
    if not liability:
        liability = Liability(id=1, amount=0.0)

    liability.amount = float(amount)
    liability.updated_at = shanghai_now()
    session.add(liability)
    session.commit()
    session.refresh(liability)
    return liability
