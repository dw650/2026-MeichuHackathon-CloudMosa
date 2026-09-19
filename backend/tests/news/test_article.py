"""Main text of publisher pages (saved real pages, trimmed)."""

import json
import re

from app.ingest.news.article import MAX_CHARS, decode_html, extract_text
from tests.news.helpers import fixture_text

PTS = fixture_text("publisher_pts.html")
AGRO = fixture_text("publisher_agrospectrum.html")
_LD = re.compile(r'<script type="application/ld\+json">.*?</script>', re.S)


def test_json_ld_article_body_comes_first() -> None:
    text = extract_text(PTS)
    assert text is not None
    assert text.startswith("受到連續降雨影響，導致雲林葉菜類產區的蔬菜成長緩慢")
    assert "西螺果菜市場" in text
    assert "加入公視會員" not in text  # page chrome is not part of the body


def test_paragraphs_when_there_is_no_json_ld() -> None:
    text = extract_text(_LD.sub("", PTS))
    assert text is not None
    assert "平均價每公斤50元" in text
    assert "關於我們" not in text  # footer links


def test_english_page_without_article_or_json_ld() -> None:
    text = extract_text(AGRO)
    assert text is not None
    assert text.startswith("Wholesale onion prices have emerged as the biggest pressure point")
    assert len(text) <= MAX_CHARS
    assert "AGROPOLICY" not in text  # navigation


def test_long_text_is_cut_at_a_paragraph_end() -> None:
    page = "".join(f"<p>{'段落文字' * 20}{i}</p>" for i in range(40))
    text = extract_text(page, max_chars=500)
    assert text is not None
    assert len(text) <= 500
    assert text.endswith(("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"))


def test_paragraphs_inside_article_win_over_the_rest() -> None:
    inside = "".join(
        f"<p>Onion arrivals at the market fell again today, part {i}.</p>" for i in range(8)
    )
    page = (
        f"<p>{'Sidebar story about something else entirely. ' * 3}</p><article>{inside}</article>"
    )
    text = extract_text(page)
    assert text is not None
    assert "Sidebar" not in text


def test_link_lists_and_short_lines_are_dropped() -> None:
    links = "<p><a href='/a'>Read more: another story about vegetables and prices</a></p>"
    body = "".join(
        f"<p>Tomato prices eased in the wholesale market this week, report {i}.</p>"
        for i in range(6)
    )
    text = extract_text(links + "<p>Share</p>" + body)
    assert text is not None
    assert "Read more" not in text
    assert "Share" not in text


def test_description_when_the_body_is_too_short() -> None:
    description = (
        "菜價上漲三成，西螺果菜市場到貨量減少，農業部表示將增加供應以穩定價格，預計兩週內回穩。"
    )
    page = f'<meta property="og:description" content="{description * 2}"><p>短短一段</p>'
    assert extract_text(page) == description * 2


def test_nothing_usable_gives_none() -> None:
    assert extract_text("<html><body><p>Only a line.</p></body></html>") is None
    assert extract_text("") is None


def test_broken_json_ld_is_ignored() -> None:
    body = "".join(
        f"<p>{'Mandi prices of onion rose again in Nashik. ' * 2}{i}</p>" for i in range(5)
    )
    page = '<script type="application/ld+json">{not json</script>' + body
    text = extract_text(page)
    assert text is not None
    assert text.startswith("Mandi prices")
    short = json.dumps({"@type": "NewsArticle", "articleBody": "too short"})
    assert extract_text(f'<script type="application/ld+json">{short}</script>{body}') == text


def test_decode_html_uses_header_meta_or_utf8() -> None:
    big5 = "<meta charset=big5><p>菜價</p>".encode("big5")
    assert "菜價" in decode_html(big5, None)
    assert "菜價" in decode_html("<p>菜價</p>".encode(), "utf-8")
    assert "菜價" in decode_html("<p>菜價</p>".encode(), None)
    assert decode_html(b"<p>\xff</p>", "no-such-charset") == "<p>�</p>"
