"""The news searches per country (sources.yaml), validated when loaded."""

from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field

DEFAULT_PATH = Path(__file__).resolve().parent / "sources.yaml"


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Feed(_Model):
    """One Google News edition (language and region) and the searches run in it."""

    hl: str = Field(min_length=2)
    gl: str = Field(pattern=r"^[A-Z]{2}$")
    ceid: str = Field(pattern=r"^[A-Z]{2}:[A-Za-z-]+$")
    queries: list[str] = Field(min_length=1)

    @property
    def lang(self) -> str:
        """Language of the headlines, e.g. `zh-TW`, `en`, `ms`."""
        return "zh-TW" if self.hl.startswith("zh") else self.hl.split("-")[0]


class CountryNews(_Model):
    # The language the summaries are written in (docs/06 §1.6), not the reader's.
    summary_lang: Literal["zh-TW", "en", "ms", "hi"]
    feeds: list[Feed] = Field(min_length=1)
    # A headline is kept when it has a keyword, or a crop or topic word and a price word, and
    # no `exclude` word.
    keywords: list[str] = []
    topics: list[str] = []
    price_words: list[str] = []
    exclude: list[str] = []
    # Longer phrases that contain a crop name but mean something else: a crop matched inside
    # one of these does not count (香蕉葡萄 is a grape, kelapa sawit is oil palm).
    confusable: list[str] = []
    crop_aliases: dict[str, list[str]] = {}
    area_aliases: dict[str, list[str]] = {}


class NewsConfig(_Model):
    countries: dict[str, CountryNews]


def load_news_config(path: Path = DEFAULT_PATH) -> NewsConfig:
    return NewsConfig.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))
