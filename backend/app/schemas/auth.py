from pydantic import BaseModel, Field


class LoginPayload(BaseModel):
    first_name: str = Field(min_length=1)
    pin: int = Field(ge=0)
