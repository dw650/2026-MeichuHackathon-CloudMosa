"""Demo news (NEWS_SOURCE=demo, docs/06 §1.4): fixed items dated relative to the run, for the
e2e checks and screenshots without network. They carry their own demo summaries."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict, Field

from app.ingest.news.base import RawNews
from app.ingest.news.config import CountryNews

DEMO_PATH = Path(__file__).resolve().parent / "demo.yaml"
DEMO_DOMAIN = "demo.example"


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class DemoItem(_Model):
    hours_ago: int = Field(ge=0)
    title: str
    summary: str | None = None
    crops: list[str] = []


class DemoCountry(_Model):
    source: str
    lang: str
    items: list[DemoItem]


def load_demo(path: Path = DEMO_PATH) -> dict[str, DemoCountry]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return {cc: DemoCountry.model_validate(value) for cc, value in data.items()}


class DemoNewsSource:
    id = "demo"

    def __init__(
        self,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
        path: Path = DEMO_PATH,
    ) -> None:
        self.requests = 0
        self._clock = clock
        self._demo = load_demo(path)

    async def fetch(self, country: str, config: CountryNews, days: int) -> list[RawNews]:
        demo = self._demo.get(country)
        if demo is None:
            return []
        now = self._clock()
        return [
            RawNews(
                guid=f"demo-{country}-{index}",
                title=item.title,
                url=f"https://{DEMO_DOMAIN}/{country.lower()}/{index}",
                published_at=now - timedelta(hours=item.hours_ago),
                source_name=demo.source,
                source_domain=DEMO_DOMAIN,
                lang=demo.lang,
                summary=item.summary,
                summary_lang=config.summary_lang if item.summary else None,
                crop_ids=tuple(item.crops),
            )
            for index, item in enumerate(demo.items, start=1)
            if item.hours_ago <= days * 24
        ]
