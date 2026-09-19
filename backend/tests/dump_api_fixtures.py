"""Saves real API responses as frontend msw fixtures (docs/plan/baseline.md T22).

Uses the test database with the mock data of the fixed test moment (tests/conftest.NOW), so
the output is the same on every run:

    cd backend && uv run python -m tests.dump_api_fixtures ../frontend/src/test/fixtures
"""

import asyncio
import json
import sys
from pathlib import Path
from urllib.parse import urlencode

import httpx

from app.config import Settings
from app.main import create_app
from tests.conftest import (
    NOW,
    TEST_DATABASE_URL,
    _ensure_database,
    _ensure_intl_data,
    _ensure_mock_data,
)
from tests.conftest import alembic_config as _alembic_config

AREAS = {
    "IN": ["nashik", "pune", "kolar", "kurnool"],
    "TW": ["taipei", "newtaipei", "yilan", "hualien"],
    "MY": ["kualalumpur", "timurlaut"],
}
QUOTES = [
    ("IN", "onion", "nashik", "wholesale"),
    ("IN", "onion", "nashik", "retail"),
    ("IN", "chilli", "nashik", "retail"),
    ("IN", "onion", "ahmednagar", "retail"),
    ("IN", "onion", "kolar", "wholesale"),
    ("IN", "onion", "kurnool", "wholesale"),
    ("IN", "onion", "delhi", "wholesale"),  # the highest of its nearby areas
    ("IN", "onion", "bengaluru", "wholesale"),  # no nearby area with today's price
    ("TW", "cabbage", "taipei", "wholesale"),
    ("TW", "cabbage", "taipei", "retail"),
    ("TW", "cauliflower", "taipei", "retail"),
    ("MY", "tomato", "kualalumpur", "wholesale"),
    ("MY", "tomato", "kualalumpur", "retail"),
    ("MY", "tomato", "timurlaut", "wholesale"),
]
SHOWCASES = {("nashik", "wholesale"), ("taipei", "wholesale"), ("kualalumpur", "wholesale")}
INTL_SERIES = ["rice", "wheat", "maize", "soybeans", "sugar", "palm_oil"]


def _name(path: str, params: dict[str, str]) -> str:
    """`/crops/onion/quote` + {country: IN, …} → `crops_onion_quote__country-IN_….json`."""
    base = path.strip("/").replace("/", "_")
    query = "_".join(f"{k}-{v}" for k, v in sorted(params.items()))
    return f"{base}__{query}.json" if query else f"{base}.json"


async def collect() -> dict[str, object]:
    """File name → JSON body of every fixture request."""
    from alembic import command

    _ensure_database(TEST_DATABASE_URL)
    command.upgrade(_alembic_config(TEST_DATABASE_URL), "head")
    settings = Settings(
        database_url=TEST_DATABASE_URL, db_null_pool=True, demo_mode=True, app_version="dev"
    )  # fixed values so reruns give identical fixtures
    await _ensure_mock_data(settings)
    await _ensure_intl_data(settings)
    app = create_app(settings, clock=lambda: NOW)
    requests: list[tuple[str, dict[str, str], dict[str, str]]] = [
        ("/health", {}, {}),
        ("/countries", {}, {}),
    ]
    for cc, areas in AREAS.items():
        requests += [(f"/countries/{cc}/areas", {}, {}), (f"/countries/{cc}/crops", {}, {})]
        for area in areas:
            for price_type in ("wholesale", "retail"):
                # Every crop; the msw handler filters by the `crops` parameter.
                requests.append(("/prices", {"country": cc, "area": area, "type": price_type}, {}))
    for cc, crop, area, price_type in QUOTES:
        params = {"country": cc, "area": area, "type": price_type}
        requests.append((f"/crops/{crop}/quote", params | {"days": "30"}, {}))
        if (area, price_type) in SHOWCASES:
            requests.append((f"/crops/{crop}/quote", params | {"days": "7"}, {}))
            requests.append((f"/crops/{crop}/compare", params, {}))
            requests.append((f"/crops/{crop}/markets", {"country": cc, "area": area}, {}))
    requests += [
        ("/crops/onion/markets/lasalgaon", {"country": "IN"}, {}),
        ("/crops/cabbage/markets/tp1", {"country": "TW"}, {}),
        ("/crops/tomato/markets/klborong", {"country": "MY"}, {}),
        ("/locate", {}, {"X-Demo-Locate": "IN:nashik"}),
    ]
    for cc in AREAS:
        requests.append(("/intl", {"country": cc}, {}))
        requests += [(f"/intl/{series}", {"country": cc}, {}) for series in INTL_SERIES]
    bodies: dict[str, object] = {}
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
        for path, params, headers in requests:
            url = path + ("?" + urlencode(params) if params else "")
            res = await client.get(url, headers=headers)
            res.raise_for_status()
            bodies[_name(path, params)] = res.json()
    await app.state.engine.dispose()
    return bodies


def main(out_dir: Path) -> None:
    bodies = asyncio.run(collect())
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, body in bodies.items():
        text = json.dumps(body, ensure_ascii=False, indent=1, sort_keys=True) + "\n"
        (out_dir / name).write_text(text, encoding="utf-8")
    print(f"saved {len(bodies)} fixtures to {out_dir}")


if __name__ == "__main__":  # pragma: no cover
    main(Path(sys.argv[1] if len(sys.argv) > 1 else "fixtures"))
