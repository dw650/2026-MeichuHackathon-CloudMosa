"""News endpoints: the 新聞 list and one item (docs/04 §6)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from app.deps import NowDep, SessionDep, public_cache
from app.schemas.common import error_responses
from app.schemas.news import NewsItemDetailOut, NewsOut
from app.services import news as service

router = APIRouter(tags=["news"], dependencies=[Depends(public_cache)])

Country = Annotated[str, Query(description="Country code", examples=["TW"])]
AreaId = Annotated[str, Query(description="The user's area, listed first", examples=["taichung"])]
NewsId = Annotated[int, Path(description="News item id", examples=[12])]

ITEM_EXAMPLE = {
    "id": 12,
    "title": "連續降雨全台農損逾2.3億 西螺果菜市場菜價漲3成",
    "lang": "zh-TW",
    "summary": "西螺果菜市場蔬菜到貨量減至約720公噸，平均每公斤約50元，比半個月前漲約3成。"
    "市場預估還要約10天，復耕的葉菜上市後價格才會回穩。",
    "summary_lang": "zh-TW",
    "source": {"name": "公視新聞網PNN", "domain": "news.pts.org.tw"},
    "url": "https://news.pts.org.tw/article/825149",
    "published_at": "2026-09-14T15:00:00+08:00",
    "published_date": "2026-09-14",
    "days_ago": 6,
    "crop_ids": ["bokchoy", "cabbage"],
    "area_ids": ["yunlin"],
}


def _example(value: object) -> dict[int | str, dict[str, object]]:
    return {200: {"content": {"application/json": {"example": value}}}}


@router.get(
    "/news",
    summary="Farm price news of a country",
    description=(
        "Up to 9 news items of the last 7 days: those mentioning the area (any of its names)"
        " first, then the newest first. `summary` is null when no summary could be made"
        " from the article; never invented. Updated once a day at 00:00 local time."
    ),
    response_model=NewsOut,
    responses=_example(
        {
            "country": "TW",
            "area_id": "yunlin",
            "today": "2026-09-20",
            "fetched_at": "2026-09-20T00:03:12+08:00",
            "items": [ITEM_EXAMPLE],
        }
    )
    | error_responses(
        (404, "area_not_found", "Area 'xyz' not found in TW"),
        (400, "invalid_param", "country: Field required"),
    ),
)
async def news(session: SessionDep, now: NowDep, country: Country, area: AreaId) -> NewsOut:
    return NewsOut.model_validate(await service.list_news(session, country, area, now))


@router.get(
    "/news/{news_id}",
    summary="One news item",
    description="The item with its country and local today; 404 once it is older than 7 days.",
    response_model=NewsItemDetailOut,
    responses=_example(ITEM_EXAMPLE | {"country": "TW", "today": "2026-09-20"})
    | error_responses((404, "news_not_found", "News item 12 not found")),
)
async def news_item(session: SessionDep, now: NowDep, news_id: NewsId) -> NewsItemDetailOut:
    return NewsItemDetailOut.model_validate(await service.news_item(session, news_id, now))
