"""Headline matching: normalisation, duplicate keys, crop, area and keyword terms."""

from app.ingest.news.match import (
    Matcher,
    TermIndex,
    area_terms,
    clean_title,
    crop_terms,
    normalize,
    title_key,
)

TW_CROPS = [
    ("cabbage", {"zh-TW": "甘藍", "en": "Cabbage"}),
    ("sweetpotato", {"zh-TW": "甘藷", "en": "Sweet potato"}),
    ("guava", {"zh-TW": "芭樂", "en": "Guava"}),
    ("banana", {"zh-TW": "香蕉", "en": "Banana"}),
    ("mango", {"zh-TW": "芒果", "en": "Mango"}),
    ("ginger", {"zh-TW": "薑", "en": "Ginger"}),
    ("turmeric", {"zh-TW": "薑黃", "en": "Turmeric"}),
]
TW_AREAS = [
    ("taipei", {"zh-TW": "台北市", "en": "Taipei"}),
    ("taichung", {"zh-TW": "台中市", "en": "Taichung"}),
    ("yunlin", {"zh-TW": "雲林縣", "en": "Yunlin"}),
]
IN_CROPS = [
    ("onion", {"zh-TW": "洋蔥", "en": "Onion"}),
    ("tomato", {"zh-TW": "番茄", "en": "Tomato"}),
    ("rice", {"zh-TW": "稻米", "en": "Rice"}),
    ("chilli", {"zh-TW": "青辣椒", "en": "Chilli"}),
    ("maize", {"zh-TW": "玉米", "en": "Maize"}),
]
IN_AREAS = [
    ("nashik", {"zh-TW": "Nashik", "en": "Nashik"}),
    ("bengaluru", {"zh-TW": "Bengaluru Urban", "en": "Bengaluru Urban"}),
]


def test_normalize_folds_width_case_spaces_and_the_tai_variant() -> None:
    assert normalize("  臺北市ＡＢＣ　Onion\tPRICES ") == "台北市abc onion prices"


def test_title_key_ignores_punctuation_spaces_and_case() -> None:
    plain = title_key("菜價漲到阿娘喂 北農釋出12種平價菜！")
    assert title_key("菜價漲到「阿娘喂」？ 北農釋出12種平價菜") == plain
    assert title_key("Onion prices fall 9%") == title_key("onion  prices fall 9 %")
    assert title_key("Onion prices fall") != title_key("Onion prices rise")
    assert len(title_key("字" * 500)) == 200


def test_clean_title_drops_the_source_google_appends() -> None:
    title = clean_title("連日大雨菜價漲近1倍 - 公視新聞網PNN", "公視新聞網PNN")
    assert title == "連日大雨菜價漲近1倍"
    # Only the exact source at the end goes; other dashes stay.
    assert clean_title("Onion - the new gold - Rediff", "Rediff") == "Onion - the new gold"
    assert clean_title("Onion prices - Rediff", "Other") == "Onion prices - Rediff"
    assert clean_title("  Only a title  ", None) == "Only a title"


def test_cjk_terms_match_inside_words_latin_terms_need_word_edges() -> None:
    index = TermIndex({"rice": ["rice"], "cabbage": ["甘藍", "高麗菜"]})
    assert index.find("Prices of rice rise") == ["rice"]
    assert index.find("Why prices rise") == []  # "price" is not rice
    assert index.find("宜蘭南山高麗菜一斤38元") == ["cabbage"]


def test_latin_terms_accept_plurals_and_spacing() -> None:
    index = TermIndex({"tomato": ["tomato"], "chilli": ["chilli"], "kw": ["mandi price"]})
    assert index.find("Tomatoes and chillies cost more") == ["tomato", "chilli"]
    assert index.find("MANDI   PRICES fall") == ["kw"]
    assert index.find("Mandi pricing") == []


def test_find_returns_ids_in_order_of_first_mention_without_repeats() -> None:
    index = TermIndex({"a": ["onion"], "b": ["tomato"]})
    assert index.find("Tomato up, onion down, tomato flat") == ["b", "a"]
    assert index.find("") == []


def test_empty_terms_are_ignored() -> None:
    assert TermIndex({"a": ["", "  "]}).find("anything") == []


def tw_matcher(confusable: list[str] | None = None) -> Matcher:
    return Matcher.build(
        crops=TW_CROPS,
        areas=TW_AREAS,
        crop_aliases={"cabbage": ["高麗菜"]},
        area_aliases={},
        keywords=["菜價"],
        topics=["水果", "蔬菜"],
        price_words=["價", "漲", "跌"],
        confusable=confusable or [],
    )


def test_a_crop_the_headline_says_it_is_not_about_is_not_tagged() -> None:
    """The real 2026-09-20 miss: 「不是香蕉芒果」 was tagged as banana, and pressing 1 opened
    banana prices for an article about Korean grapes."""
    title = "不是香蕉芒果，1水果大降價！產地價格暴跌68.6%"
    matcher = tw_matcher()
    assert matcher.crop_ids(title) == []
    assert matcher.relevant(title)  # still price news: a topic word and a price word
    # A negation only covers what follows it closely.
    assert matcher.crop_ids("不是香蕉！甘藍價格連三週下跌，產地到貨增加") == ["cabbage"]
    assert matcher.crop_ids("除了芭樂，其他水果都漲價") == []
    assert matcher.crop_ids("香蕉價格不是最高") == ["banana"]  # the negation comes after


def test_a_negated_crop_in_an_english_headline_is_not_tagged() -> None:
    matcher = Matcher.build(
        crops=IN_CROPS,
        areas=IN_AREAS,
        crop_aliases={},
        area_aliases={},
        keywords=["mandi price"],
        topics=["vegetable"],
        price_words=["price"],
    )
    assert matcher.crop_ids("Not onions this time: tomato prices double in Nashik") == ["tomato"]
    assert matcher.crop_ids("No tomatoes left as prices double") == []
    assert matcher.crop_ids("Onion prices are not falling") == ["onion"]


def test_the_longer_of_two_matched_terms_wins() -> None:
    matcher = tw_matcher()
    assert matcher.crop_ids("薑黃價格上漲") == ["turmeric"]  # not ginger as well
    # A plain mention next to the longer term still counts.
    assert matcher.crop_ids("薑黃與薑的產地價齊漲") == ["turmeric", "ginger"]
    latin = TermIndex({"cabbage": ["kubis"], "cauliflower": ["kubis bunga"]}, guard=True)
    assert latin.find("Harga kubis bunga naik") == ["cauliflower"]
    assert latin.find("Harga kubis dan kubis bunga naik") == ["cabbage", "cauliflower"]


def test_configured_confusable_terms_are_not_crops() -> None:
    """「香蕉葡萄」 is a Korean grape, not a banana; the phrase is listed per country."""
    plain = tw_matcher()
    assert plain.crop_ids("韓國香蕉葡萄產地價格暴跌") == ["banana"]
    guarded = tw_matcher(["香蕉葡萄"])
    assert guarded.crop_ids("韓國香蕉葡萄產地價格暴跌") == []
    assert guarded.crop_ids("香蕉葡萄大降價，香蕉價格也跌") == ["banana"]


def test_crop_terms_use_every_language_and_the_aliases() -> None:
    terms = crop_terms(TW_CROPS, {"cabbage": ["高麗菜"], "sweetpotato": ["地瓜"], "nope": ["x"]})
    assert terms["cabbage"] == ["甘藍", "Cabbage", "高麗菜"]
    assert "地瓜" in terms["sweetpotato"]
    assert "nope" not in terms  # aliases of unknown crops are ignored


def test_area_terms_add_chinese_names_without_the_city_or_county_suffix() -> None:
    terms = area_terms(TW_AREAS, {"taipei": ["北市"]})
    assert terms["taichung"] == ["台中市", "Taichung", "台中"]
    assert terms["yunlin"] == ["雲林縣", "Yunlin", "雲林"]
    assert "北市" in terms["taipei"]


def test_matcher_finds_crops_areas_and_relevance() -> None:
    matcher = Matcher.build(
        crops=TW_CROPS,
        areas=TW_AREAS,
        crop_aliases={"cabbage": ["高麗菜"]},
        area_aliases={},
        keywords=["菜價"],
        topics=["果菜", "蔬菜"],
        price_words=["價", "漲"],
        exclude=["裝運點"],
    )
    title = "臺中高麗菜價格回穩 雲林果菜市場到貨增"
    assert matcher.crop_ids(title) == ["cabbage"]
    assert matcher.area_ids(title) == ["taichung", "yunlin"]
    assert matcher.relevant(title)  # a crop and a price word
    assert matcher.relevant("菜價飆漲偷摘菜")  # a keyword alone
    assert not matcher.relevant("芭樂盛產")  # a crop without a price word
    assert not matcher.relevant("竹市加倍券開跑 果菜市場首日發2200張")  # a topic without one
    assert not matcher.relevant("自助餐4菜+白飯要85元")
    assert not matcher.relevant("本頓港蔬菜裝運點價格")  # excluded


def test_matcher_for_english_headlines() -> None:
    matcher = Matcher.build(
        crops=IN_CROPS,
        areas=IN_AREAS,
        crop_aliases={"maize": ["corn"]},
        area_aliases={"bengaluru": ["Bengaluru", "Bangalore"]},
        keywords=["mandi price", "vegetable price"],
        topics=["vegetable"],
        price_words=["price", "rate", "kg"],
        exclude=["on road price"],
    )
    assert matcher.crop_ids("Onion, tomato prices climb in Nashik mandis") == ["onion", "tomato"]
    assert matcher.area_ids("Onion arrivals drop at Nashik; Bangalore prices up") == [
        "nashik",
        "bengaluru",
    ]
    assert matcher.crop_ids("Corner shops raise prices") == []
    assert matcher.relevant("Vegetable prices remain stable")
    assert matcher.relevant("Onion supply at 32/kg soon")
    assert not matcher.relevant("Onion supply improves")
    assert not matcher.relevant("Mahindra XUV400 on road price Ramganj Mandi")
