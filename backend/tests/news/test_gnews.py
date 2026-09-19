"""Google News link decoding against the saved real article page and batchexecute answer."""

import json
from urllib.parse import unquote

from app.ingest.news.gnews import article_id, batch_body, decoding_params, parse_batch
from tests.news.helpers import fixture_text

AID = (
    "CBMiT0FVX3lxTE5EYTYtM1F6bjJQN2pVeDl3UXgxRFNLdFJqWEtYMVpSenItbXp0Skhnc2tsVTlXeTM4UEpCSkx3dnZy"
    "RmZ4WFIyaEgtVHZmY1U"
)


def test_article_id_from_rss_and_web_links() -> None:
    assert article_id(f"https://news.google.com/rss/articles/{AID}?oc=5") == AID
    assert article_id(f"https://news.google.com/articles/{AID}") == AID
    assert article_id(f"https://news.google.com/read/{AID}?hl=en") == AID
    assert article_id("https://news.pts.org.tw/article/825149") is None
    assert article_id("https://news.google.com/topics/abc") is None
    assert article_id("https://news.google.com/rss/articles/") is None


def test_decoding_params_from_the_saved_page() -> None:
    assert decoding_params(fixture_text("gnews_article_TW.html")) == (
        "Ae5Wzi9pW-wb9qVug27jMIDtXkTI",
        "1789847224",
    )
    assert decoding_params("<html><body><div data-n-a-sg='x'></div></body></html>") is None


def test_batch_body_carries_the_id_timestamp_and_signature() -> None:
    body = batch_body(AID, "1789847224", "Ae5Wzi9pW-wb9qVug27jMIDtXkTI")
    assert body.startswith("f.req=")
    request = json.loads(unquote(body.removeprefix("f.req=")))
    rpc, inner = request[0][0]
    assert rpc == "Fbv4je"
    args = json.loads(inner)
    assert args[0] == "garturlreq"
    assert args[-3:] == [AID, 1789847224, "Ae5Wzi9pW-wb9qVug27jMIDtXkTI"]


def test_parse_the_saved_batch_answer() -> None:
    assert parse_batch(fixture_text("gnews_batchexecute_TW.txt")) == (
        "https://health.tvbs.com.tw/life/365962"
    )


def test_unusable_batch_answers_give_none() -> None:
    assert parse_batch("") is None
    assert parse_batch(")]}'\n\nnot json") is None
    assert parse_batch(')]}\'\n\n[["wrb.fr","Other","[]"]]') is None
    assert (
        parse_batch(')]}\'\n\n[["wrb.fr","Fbv4je","[\\"garturlres\\",\\"javascript:x\\"]"]]')
        is None
    )
    assert parse_batch(')]}\'\n\n[["wrb.fr","Fbv4je","[\\"garturlres\\"]"]]') is None
