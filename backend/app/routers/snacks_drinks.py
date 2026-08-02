from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.deps import CurrentUser, require_module
from app.schemas.daily import DailySnacksPayload
from core.roles import MODULE_SNACKS_DRINKS, ROLE_SNACKS_CLERK
from db import daily as daily_db

router = APIRouter(tags=["snacks-drinks"])


@router.get("/snacks-drinks")
def get_snacks_drinks(
    user: Annotated[CurrentUser, Depends(require_module(MODULE_SNACKS_DRINKS))],
    entry_date: date = Query(..., alias="date"),
):
    rows = daily_db.get_snacks_drinks_daily(entry_date)
    total_sold_units = sum(
        float(r["sold_units"]) for r in rows if r.get("sold_units") is not None
    )
    total_revenue = sum(
        float(r["revenue"]) for r in rows if r.get("revenue") is not None
    )
    return {
        "date": str(entry_date),
        "entries": rows,
        "total_sold_units": total_sold_units,
        "total_revenue": total_revenue,
        "locked": daily_db.is_snacks_drinks_day_locked(entry_date),
    }


@router.post("/snacks-drinks")
def save_snacks_drinks(
    payload: DailySnacksPayload,
    user: Annotated[CurrentUser, Depends(require_module(MODULE_SNACKS_DRINKS))],
):
    if not payload.entries and not payload.finalize:
        raise HTTPException(status_code=400, detail="No entries to save")
    entries = [e.model_dump() for e in payload.entries]
    try:
        result = daily_db.save_snacks_drinks_daily(
            payload.date,
            entries,
            user.user_id,
            finalize=payload.finalize,
            block_if_locked=user.role == ROLE_SNACKS_CLERK,
        )
    except daily_db.DayLockedError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        msg = str(exc)
        if msg.startswith("closing_exceeds_total:"):
            raise HTTPException(
                status_code=400,
                detail="Closing cannot exceed Total for one or more items. Fix highlighted rows.",
            ) from exc
        raise HTTPException(status_code=400, detail=msg) from exc
    return {"date": str(payload.date), **result}
