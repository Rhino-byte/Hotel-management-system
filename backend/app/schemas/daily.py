from datetime import date
from typing import List

from pydantic import BaseModel


class StockEntry(BaseModel):
    item_id: int
    closing_stock: float = 0
    added_stock: float = 0


class QuantityEntry(BaseModel):
    item_id: int
    quantity: float = 0


class DailyStockPayload(BaseModel):
    date: date
    entries: List[StockEntry]


class DailyQuantityPayload(BaseModel):
    date: date
    entries: List[QuantityEntry]


class BarStockEntry(BaseModel):
    item_id: int
    added_stock: float = 0
    closing_stock: float = 0


class DailyBarPayload(BaseModel):
    date: date
    entries: List[BarStockEntry]
