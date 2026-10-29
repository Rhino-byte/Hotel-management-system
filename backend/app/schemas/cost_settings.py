from typing import Literal, Optional

from pydantic import BaseModel, Field


Category = Literal["snacks", "drinks", "food", "kuku"]
DataSource = Literal["hotel_sold", "store_stock_out", "recipe_milk", "policy_rate"]


class CostSettingPayload(BaseModel):
    name: str = Field(min_length=1)
    category: Category
    data_source: DataSource
    purchase_price: float = 0
    hotel_item_name: Optional[str] = None
    store_item_name: Optional[str] = None
    tea_cups_per_liter: Optional[float] = None
    white_coffee_cups_per_liter: Optional[float] = None
    bags_per_week: Optional[float] = None
    cylinder_cost_per_month: Optional[float] = None
