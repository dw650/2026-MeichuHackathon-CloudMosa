import httpx


async def test_countries_lists_every_country_with_its_settings(api: httpx.AsyncClient) -> None:
    res = await api.get("/api/v1/countries")
    assert res.status_code == 200
    assert res.headers["Cache-Control"] == "public, max-age=60"
    countries = res.json()["countries"]
    assert [c["code"] for c in countries] == ["IN", "TW", "MY"]
    india, taiwan, malaysia = countries
    assert india["name"] == {"zh-TW": "印度", "en": "India"}
    assert (india["currency"], india["locale"], india["up_is_pos"]) == ("INR", "en-IN", True)
    assert india["today"] == "2026-09-19"
    assert india["closed_weekdays"] == [7]
    assert india["default_area_id"] == "nashik"
    assert india["default_recent_area_ids"] == ["nashik", "pune", "ahmednagar"]
    assert india["default_watch"][:2] == ["onion", "tomato"]
    assert india["units"]["wholesale"]["default"] == "qtl"
    assert india["units"]["wholesale"]["options"][0] == {
        "id": "qtl",
        "per_kg": 100,
        "decimals": 0,
        "label": {"zh-TW": "₹/公擔", "en": "₹/qtl"},
    }
    assert taiwan["up_is_pos"] is False
    assert taiwan["units"]["retail"]["default"] == "kg"
    assert malaysia["name"] == {"zh-TW": "馬來西亞", "en": "Malaysia"}
    assert (malaysia["currency"], malaysia["locale"], malaysia["up_is_pos"]) == (
        "MYR",
        "en-MY",
        True,
    )
    assert (malaysia["today"], malaysia["closed_weekdays"]) == ("2026-09-19", [])
    assert malaysia["default_area_id"] == "kualalumpur"
    assert [o["id"] for o in malaysia["units"]["wholesale"]["options"]] == ["kg", "kati"]
    assert "CC BY 4.0" in malaysia["source_label"]["en"]
    # Malaysia's source has retail prices only, so new users start on retail there.
    assert [c["default_price_type"] for c in countries] == ["wholesale", "wholesale", "retail"]


async def test_malaysia_areas_and_retail_from_the_demo(api: httpx.AsyncClient) -> None:
    areas = (await api.get("/api/v1/countries/MY/areas")).json()["areas"]
    assert len(areas) == 11
    by_id = {a["id"]: a for a in areas}
    assert by_id["kualalumpur"]["staleness"] == {"days": 0, "state": "today"}
    assert by_id["kuching"]["staleness"] == {"days": 1, "state": "stale"}
    quote = (
        await api.get(
            "/api/v1/crops/tomato/quote",
            params={"country": "MY", "area": "kualalumpur", "type": "retail"},
        )
    ).json()
    assert quote["currency"] == "MYR"
    assert quote["price_per_kg"] > 0
    penang = (
        await api.get(
            "/api/v1/crops/tomato/quote",
            params={"country": "MY", "area": "timurlaut", "type": "wholesale"},
        )
    ).json()
    assert penang["price_per_kg"] is None  # no wholesale market in Timur Laut


async def test_areas_carry_coordinates_and_freshness(api: httpx.AsyncClient) -> None:
    res = await api.get("/api/v1/countries/IN/areas")
    assert res.status_code == 200
    body = res.json()
    assert body["country"] == "IN"
    assert body["today"] == "2026-09-19"
    areas = {a["id"]: a for a in body["areas"]}
    assert len(areas) == 11
    nashik = areas["nashik"]
    assert (nashik["lat"], nashik["lon"], nashik["has_retail"]) == (20.0, 73.79, True)
    assert nashik["region"] == {"zh-TW": "Maharashtra", "en": "Maharashtra"}
    assert nashik["latest_trade_date"] == "2026-09-19"
    assert nashik["staleness"] == {"days": 0, "state": "today"}
    assert areas["jalgaon"]["staleness"] == {"days": 1, "state": "stale"}
    assert areas["kolar"]["staleness"] == {"days": 3, "state": "stale"}
    assert areas["kurnool"]["latest_trade_date"] is None
    assert areas["kurnool"]["staleness"] == {"days": None, "state": "none"}
    assert [a["id"] for a in body["areas"]][:3] == ["nashik", "pune", "ahmednagar"]


async def test_crops_list_names_categories_and_retail(api: httpx.AsyncClient) -> None:
    res = await api.get("/api/v1/countries/TW/crops")
    assert res.status_code == 200
    crops = {c["id"]: c for c in res.json()["crops"]}
    assert len(crops) == 21
    assert crops["cabbage"]["name"] == {"zh-TW": "甘藍", "en": "Cabbage"}
    assert crops["cabbage"]["variety"] == {"zh-TW": "初秋", "en": "Early autumn"}
    assert (crops["cabbage"]["category"], crops["cabbage"]["default_watch"]) == ("veg", True)
    assert crops["cauliflower"]["has_retail"] is False


async def test_unknown_country_is_404_with_an_error_code(api: httpx.AsyncClient) -> None:
    for path in ("/api/v1/countries/XX/areas", "/api/v1/countries/XX/crops"):
        res = await api.get(path)
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "country_not_found"
        assert "Cache-Control" not in res.headers


async def test_country_codes_are_case_insensitive(api: httpx.AsyncClient) -> None:
    res = await api.get("/api/v1/countries/tw/crops")
    assert res.status_code == 200


async def test_openapi_and_docs_are_published(api: httpx.AsyncClient) -> None:
    spec = (await api.get("/api/v1/openapi.json")).json()
    for path in (
        "/api/v1/countries",
        "/api/v1/countries/{cc}/areas",
        "/api/v1/countries/{cc}/crops",
    ):
        op = spec["paths"][path]["get"]
        assert op["summary"]
        assert op["responses"]["200"]["content"]["application/json"]["example"]
    docs = await api.get("/api/docs")
    assert docs.status_code == 200
    assert "swagger" in docs.text.lower()
