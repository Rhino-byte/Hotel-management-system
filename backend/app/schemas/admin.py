from typing import Optional

from pydantic import BaseModel, Field


class PriceUpdatePayload(BaseModel):
    item_id: int
    price_ksh: float = Field(gt=0)


class StockItemPayload(BaseModel):
    name: str = Field(min_length=1)


class FoodDishPayload(BaseModel):
    name: str = Field(min_length=1)
    price_ksh: float = Field(gt=0)


class HotelRoleUpdatePayload(BaseModel):
    hotel_role: Optional[str] = None
