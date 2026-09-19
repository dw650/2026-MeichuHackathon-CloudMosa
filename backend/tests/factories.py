"""Minimal catalog rows for database tests."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Area, Country, Crop, Market

EN_ZH = {"en": "x", "zh-TW": "x"}


async def add_minimal_catalog(session: AsyncSession) -> None:
    session.add(
        Country(
            code="IN",
            sort=1,
            name={"en": "India", "zh-TW": "印度"},
            coverage=EN_ZH,
            currency="INR",
            locale="en-IN",
            utc_offset_min=330,
            up_is_pos=True,
            closed_weekdays=[7],
            default_area_id="a1",
            default_recent_area_ids=["a1"],
            area_suffix=EN_ZH,
            rep_price_label=EN_ZH,
            units={},
        )
    )
    await session.flush()
    session.add(
        Area(
            id="a1",
            country="IN",
            name=EN_ZH,
            region=EN_ZH,
            lat=20.0,
            lon=73.8,
            has_retail=True,
            sort=1,
        )
    )
    session.add(
        Crop(
            country="IN",
            id="onion",
            name=EN_ZH,
            category="veg",
            variety=EN_ZH,
            sort=1,
            default_watch=True,
            has_retail=True,
        )
    )
    await session.flush()
    session.add(Market(id="m1", area_id="a1", name=EN_ZH, km_from_center=0, sort=1))
    await session.commit()
