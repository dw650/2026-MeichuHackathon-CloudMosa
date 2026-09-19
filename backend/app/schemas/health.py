from datetime import datetime

from pydantic import BaseModel


class SourceStatusOut(BaseModel):
    source: str
    last_success_at: datetime
    rows_ok: int


class HealthOut(BaseModel):
    status: str
    database: str
    sources: list[SourceStatusOut]
