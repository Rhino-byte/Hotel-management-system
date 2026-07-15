from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class StockEntry(BaseModel):
    item_id: int
    closing_stock: float = 0
    added_stock: float = 0


class SnacksStockEntry(BaseModel):
    item_id: int
    closing_stock: Optional[float] = None
    added_stock: float = 0


class QuantityEntry(BaseModel):
    item_id: int
    quantity: float = 0


class DailyStockPayload(BaseModel):
    date: date
    entries: List[StockEntry]


class DailySnacksPayload(BaseModel):
    date: date
    entries: List[SnacksStockEntry]


class DailyQuantityPayload(BaseModel):
    date: date
    entries: List[QuantityEntry]
    finalize: bool = False


class BarStockEntry(BaseModel):
    item_id: int
    added_stock: float = 0
    closing_stock: float = 0


class DailyBarPayload(BaseModel):
    date: date
    entries: List[BarStockEntry]
