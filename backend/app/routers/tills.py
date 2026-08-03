from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.deps import CurrentUser, require_admin
from db import tills as tills_db

router = APIRouter(tags=["tills"])


@router.get("/tills/report")
def get_tills_report(
    _admin: Annotated[CurrentUser, Depends(require_admin)],
    date_from: date = Query(...),
    date_to: date = Query(...),
):
    if date_from > date_to:
        raise HTTPException(
            status_code=400,
            detail="date_from must be on or before date_to.",
        )
    try:
        return tills_db.tills_report(date_from, date_to)
    except tills_db.TillsConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
