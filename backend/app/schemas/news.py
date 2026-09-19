"""News responses (the 新聞 page, docs/04 §6)."""

from datetime import date, datetime

from pydantic import BaseModel, Field


class NewsSourceOut(BaseModel):
    name: str = Field(description="Publisher, as Google News names it.")
    domain: str | None = Field(description="Publisher's domain, e.g. `news.pts.org.tw`.")


class NewsItemOut(BaseModel):
    id: int
    title: str
    lang: str = Field(description="Language of the title: `zh-TW`, `en`, `ms`…")
    summary: str | None = Field(
        description="Two sentences written by a model from the article; null when there is"
        " none (then show the title, source and date only)."
    )
    summary_lang: str | None
    source: NewsSourceOut
    url: str = Field(description="Publisher's URL when known. The app does not open it.")
    published_at: datetime = Field(description="In the country's own UTC offset.")
    published_date: date = Field(description="Local date of publication.")
    days_ago: int = Field(description="0 = today, 1 = yesterday… (local dates).")
    crop_ids: list[str] = Field(description="Related crops of the country, most related first.")
    area_ids: list[str] = Field(description="Areas the title or summary mention.")


class NewsOut(BaseModel):
    country: str
    area_id: str
    today: date
    fetched_at: datetime | None = Field(description="End of the latest successful news run.")
    items: list[NewsItemOut] = Field(
        description="At most 9: items mentioning the area first, then the newest first."
    )


class NewsItemDetailOut(NewsItemOut):
    country: str
    today: date
