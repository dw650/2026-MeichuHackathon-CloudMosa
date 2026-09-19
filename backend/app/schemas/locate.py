from pydantic import BaseModel


class LocateOut(BaseModel):
    """The guessed area, or nulls when there is no guess."""

    country: str | None
    area_id: str | None
