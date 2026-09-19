"""The news searches per country (app/ingest/news/sources.yaml)."""

from pathlib import Path

import pytest
from pydantic import ValidationError

from app.ingest.news.config import load_news_config
from app.seed.loader import load_seed_files

CONFIG = load_news_config()


def test_every_seeded_country_has_searches_and_malaysia_is_ready() -> None:
    seeded = {s.country.code for s in load_seed_files()}
    assert seeded <= set(CONFIG.countries)
    assert {"TW", "IN", "MY"} <= set(CONFIG.countries)


def test_feed_editions_and_languages() -> None:
    tw = CONFIG.countries["TW"]
    assert tw.feeds[0].ceid == "TW:zh-Hant"
    assert tw.feeds[0].lang == "zh-TW"
    assert CONFIG.countries["IN"].feeds[0].lang == "en"
    my_langs = [f.lang for f in CONFIG.countries["MY"].feeds]
    assert my_langs == ["en", "ms"]


def test_every_country_is_summarised_in_its_own_language() -> None:
    """The summary language is the country's own, not the headlines' and not the reader's
    (user decision 2026-09-20, docs/06 §1.6)."""
    langs = {cc: c.summary_lang for cc, c in CONFIG.countries.items()}
    assert langs == {"TW": "zh-TW", "IN": "hi", "MY": "ms"}


def test_aliases_point_at_crops_and_areas_of_the_seed() -> None:
    for seed in load_seed_files():
        news = CONFIG.countries[seed.country.code]
        assert set(news.crop_aliases) <= {c.id for c in seed.crops}
        assert set(news.area_aliases) <= {a.id for a in seed.areas}


def test_a_broken_file_fails_on_load(tmp_path: Path) -> None:
    path = tmp_path / "sources.yaml"
    path.write_text("countries:\n  TW:\n    summary_lang: fr\n    feeds: []\n", encoding="utf-8")
    with pytest.raises(ValidationError):
        load_news_config(path)
