"""The 新聞 page (docs/02 §5.9): the country's recent news with the user's area first."""

from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import NEWS_KEEP_DAYS, NewsItem
from app.errors import ApiError
from app.repositories import catalog as catalog_repo
from app.repositories import news as repo
from app.services.catalog import require_country
from app.timeutil import country_tz, local_today

MAX_ITEMS = 9  # one per digit key


def item_out(item: NewsItem, tz: timezone, today: date) -> dict[str, Any]:
    published = item.published_at.astimezone(tz)
    return {
        "id": item.id,
        "title": item.title,
        "lang": item.lang,
        "summary": item.summary,
        "summary_lang": item.summary_lang if item.summary else None,
        "source": {"name": item.source_name, "domain": item.source_domain},
        "url": item.url,
        "published_at": published,
        "published_date": published.date(),
        "days_ago": max(0, (today - published.date()).days),
        "crop_ids": list(item.crop_ids),
        "area_ids": list(item.area_ids),
    }


async def list_news(
    session: AsyncSession, country_code: str, area_id: str, now: datetime
) -> dict[str, Any]:
    country = await require_country(session, country_code)
    area = await catalog_repo.get_area(session, area_id)
    if area is None or area.country != country.code:
        raise ApiError(404, "area_not_found", f"Area {area_id!r} not found in {country.code}")
    tz = country_tz(country.utc_offset_min)
    today = local_today(country.utc_offset_min, now)
    since = now - timedelta(days=NEWS_KEEP_DAYS)
    items = await repo.list_items(session, country.code, area.id, since, MAX_ITEMS)
    fetched = await repo.last_fetch(session, country.code)
    return {
        "country": country.code,
        "area_id": area.id,
        "today": today,
        "fetched_at": fetched.astimezone(tz) if fetched else None,
        "items": [item_out(i, tz, today) for i in items],
    }


async def news_item(session: AsyncSession, news_id: int, now: datetime) -> dict[str, Any]:
    item = await repo.get_item(session, news_id)
    since = now - timedelta(days=NEWS_KEEP_DAYS)
    country = await catalog_repo.get_country(session, item.country) if item else None
    if item is None or country is None or item.published_at < since:
        raise ApiError(404, "news_not_found", f"News item {news_id} not found")
    tz = country_tz(country.utc_offset_min)
    today = local_today(country.utc_offset_min, now)
    return item_out(item, tz, today) | {"country": country.code, "today": today}
