"""Summaries: prompts, reply rules, the Gemini and OpenAI-compatible calls, and the model order."""

import json
from datetime import date
from typing import Any

import httpx
import pytest

from app.ingest.news.base import Pacer
from app.ingest.news.summarize import (
    GEMINI_TEXT_MODEL,
    GEMINI_URL,
    CropChoice,
    GeminiModel,
    ModelUnavailableError,
    OpenAICompatModel,
    Summaries,
    Summary,
    SummaryRequest,
    build_prompt,
    build_summaries,
    parse_reply,
)
from tests.news.helpers import FakeTime, Script, fixture_text

GROUNDED = "gemini-3.6-flash"  # grounding is off unless a model is named

TW_CROPS = (
    CropChoice("cabbage", ("甘藍", "Cabbage", "高麗菜")),
    CropChoice("bokchoy", ("小白菜", "Bok choy")),
)
IN_CROPS = (
    CropChoice("onion", ("洋蔥", "Onion")),
    CropChoice("potato", ("馬鈴薯", "Potato")),
    CropChoice("tomato", ("番茄", "Tomato")),
)
MY_CROPS = (
    CropChoice("chilli", ("辣椒", "Chilli", "cili")),
    CropChoice("cabbage", ("甘藍", "Cabbage", "kubis")),
)
TEXT = fixture_text("publisher_pts.html")[:500]
TW_REQUEST = SummaryRequest(
    title="連續降雨全台農損逾2.3億 西螺果菜市場菜價漲3成",
    source="公視新聞網PNN",
    published=date(2026, 9, 14),
    lang="zh-TW",
    crops=TW_CROPS,
    text="西螺果菜市場到貨量減少……",
)
IN_REQUEST = SummaryRequest(
    title="Onion prices surge nearly fourfold in year as vegetable market diverges",
    source="AgroSpectrum India",
    published=date(2026, 9, 18),
    lang="en",
    crops=IN_CROPS,
    text="Wholesale onion prices have emerged as the biggest pressure point…",
)
HI_REQUEST = SummaryRequest(**{**IN_REQUEST.__dict__, "lang": "hi"})
MS_REQUEST = SummaryRequest(
    title="Harga cili turun di pasar borong Kuala Lumpur",
    source="Berita Harian",
    published=date(2026, 9, 18),
    lang="ms",
    crops=MY_CROPS,
    text="Bekalan cili di pasar borong Kuala Lumpur bertambah minggu ini…",
)
HINDI = (
    "नासिक मंडी में प्याज़ की आवक बढ़ी और भाव नरम पड़ गए।"
    " व्यापारियों को नई फसल आने तक भाव स्थिर रहने की उम्मीद है।"
)
MALAY = (
    "Harga cili di pasar borong Kuala Lumpur turun minggu ini kerana bekalan bertambah."
    " Peniaga menjangkakan harga stabil sehingga akhir bulan."
)
LAB = "http://lab.test:11434/v1"
TEXT_URL = GEMINI_URL.format(model=GEMINI_TEXT_MODEL)
GROUNDED_URL = GEMINI_URL.format(model=GROUNDED)


def ok(name: str) -> httpx.Response:
    return httpx.Response(200, json=json.loads(fixture_text(name)))


def body_of(request: httpx.Request) -> dict[str, Any]:
    value = json.loads(request.content)
    assert isinstance(value, dict)
    return value


def gemini(script: Script, *, grounded: bool, time: FakeTime | None = None) -> GeminiModel:
    time = time or FakeTime()
    model = GROUNDED if grounded else GEMINI_TEXT_MODEL
    return GeminiModel(
        "key",
        model,
        grounded=grounded,
        pacer=Pacer(7.0, time.sleep, time.clock),
        transport=script.transport(),
    )


# ---------- prompts and replies ----------


def test_prompt_for_article_text_lists_crops_language_and_the_text() -> None:
    prompt = build_prompt(TW_REQUEST, grounded=False)
    assert "Traditional Chinese" in prompt
    assert "exactly two short sentences" in prompt
    assert "cabbage: 甘藍, Cabbage, 高麗菜" in prompt
    assert "Headline: 連續降雨全台農損逾2.3億" in prompt
    assert "Publisher: 公視新聞網PNN, 2026-09-14" in prompt
    assert '"""\n西螺果菜市場到貨量減少……\n"""' in prompt
    assert "Google Search" not in prompt


def test_grounded_prompt_asks_to_find_the_article_and_has_no_text() -> None:
    prompt = build_prompt(IN_REQUEST, grounded=True)
    assert prompt.startswith("Use Google Search to find this news article")
    assert "English" in prompt
    assert "Article text" not in prompt


def test_reply_rules() -> None:
    good = json.dumps(
        {"summary": "菜價上漲三成，西螺果菜市場到貨量減少。預計十天後回穩。", "crops": ["cabbage"]},
        ensure_ascii=False,
    )
    assert parse_reply(good, TW_REQUEST) == (
        "菜價上漲三成，西螺果菜市場到貨量減少。預計十天後回穩。",
        ("cabbage",),
    )
    # Fenced JSON is fine; unknown and repeated crops are dropped; three at most.
    fenced = (
        '```json\n{"summary": "Onion prices rose sharply this month in the mandis of Nashik.",'
        ' "crops": ["onion", "garlic", "onion", "potato", "tomato", 7]}\n```'
    )
    assert parse_reply(fenced, IN_REQUEST) == (
        "Onion prices rose sharply this month in the mandis of Nashik.",
        ("onion", "potato", "tomato"),
    )


def test_replies_that_break_the_rules_are_dropped() -> None:
    assert parse_reply("no json here", TW_REQUEST) is None
    assert parse_reply("[1, 2]", TW_REQUEST) is None
    assert parse_reply('{"summary": "", "crops": []}', TW_REQUEST) is None
    assert parse_reply('{"summary": 3}', TW_REQUEST) is None
    # Wrong language for the country.
    english = '{"summary": "Vegetable prices rose by a third at the Xiluo market this week."}'
    assert parse_reply(english, TW_REQUEST) is None
    assert (
        parse_reply('{"summary": "洋蔥價格上漲，農民收入增加，市場供應減少。"}', IN_REQUEST) is None
    )
    too_long = json.dumps({"summary": "菜價" * 200 + "。"}, ensure_ascii=False)
    assert parse_reply(too_long, TW_REQUEST) is None


def test_the_prompt_names_malay_and_hindi_with_their_own_length() -> None:
    hindi = build_prompt(HI_REQUEST, grounded=False)
    assert "Hindi" in hindi and "Devanagari" in hindi
    assert "at most 160 Devanagari characters in total" in hindi
    malay = build_prompt(MS_REQUEST, grounded=False)
    assert "Bahasa Melayu" in malay
    assert "at most 40 words in total" in malay


def test_a_hindi_summary_needs_devanagari() -> None:
    reply = json.dumps({"summary": HINDI, "crops": ["onion"]}, ensure_ascii=False)
    assert parse_reply(reply, HI_REQUEST) == (HINDI, ("onion",))
    # Asked for Hindi, answered in English: no summary at all.
    english = '{"summary": "Onion prices eased at Lasalgaon. Traders expect steady rates."}'
    assert parse_reply(english, HI_REQUEST) is None
    # Mostly English with a few Hindi words is not a Hindi summary either.
    mixed = json.dumps(
        {
            "summary": "Onion arrivals at the Lasalgaon market rose and the modal price eased"
            " प्याज़ के भाव नरम. Traders expect steady rates until the new crop arrives."
        },
        ensure_ascii=False,
    )
    assert parse_reply(mixed, HI_REQUEST) is None
    assert parse_reply(reply, IN_REQUEST) is None  # Hindi where English was asked for


def test_a_malay_summary_needs_common_malay_words() -> None:
    reply = json.dumps({"summary": MALAY, "crops": ["chilli"]}, ensure_ascii=False)
    assert parse_reply(reply, MS_REQUEST) == (MALAY, ("chilli",))
    # Latin letters alone cannot tell Malay from English, so the word test does.
    english = (
        '{"summary": "Chilli arrivals at the Kuala Lumpur wholesale market rose this week and'
        ' prices eased. Traders expect steady prices until the end of the month."}'
    )
    assert parse_reply(english, MS_REQUEST) is None
    # One common word can be a name in an English sentence ("Dan"); two cannot.
    one = '{"summary": "Dan reported cheaper chillies at the wholesale market in Kuala Lumpur."}'
    assert parse_reply(one, MS_REQUEST) is None


def test_only_the_first_two_sentences_are_kept() -> None:
    reply = json.dumps(
        {
            "summary": "Onion prices hit Rs 3,736.61 per quintal. Potato stayed low."
            " Tomato eased. Traders wait.",
            "crops": "onion",
        }
    )
    assert parse_reply(reply, IN_REQUEST) == (
        "Onion prices hit Rs 3,736.61 per quintal. Potato stayed low.",
        (),
    )


# ---------- Gemini ----------


async def test_gemini_text_call_uses_a_schema_limited_to_the_crop_list() -> None:
    script = Script({TEXT_URL: [ok("gemini_generate_content.json")]})
    summary = await gemini(script, grounded=False).summarize(TW_REQUEST)
    assert summary == Summary(
        text="西螺果菜市場蔬菜到貨量減至約720公噸，平均每公斤約50元，比半個月前漲約3成。"
        "市場預估還要約10天，復耕的葉菜上市後價格才會回穩。",
        crop_ids=("bokchoy", "cabbage"),
        model="gemini-3.5-flash-lite",
    )
    request = script.requests[0]
    assert request.headers["x-goog-api-key"] == "key"
    body = body_of(request)
    config = body["generationConfig"]
    assert config["responseMimeType"] == "application/json"
    crops = config["responseJsonSchema"]["properties"]["crops"]["items"]
    assert crops["enum"] == ["cabbage", "bokchoy"]
    assert "tools" not in body
    assert body["systemInstruction"]["parts"][0]["text"].startswith("You summarise")


async def test_gemini_text_model_needs_the_article_text() -> None:
    script = Script({})
    no_text = SummaryRequest(**{**TW_REQUEST.__dict__, "text": None})
    assert await gemini(script, grounded=False).summarize(no_text) is None
    assert script.requests == []


async def test_grounded_call_uses_google_search_and_needs_grounding() -> None:
    no_text = SummaryRequest(**{**TW_REQUEST.__dict__, "text": None})
    script = Script({GROUNDED_URL: [ok("gemini_grounded.json")]})
    summary = await gemini(script, grounded=True).summarize(no_text)
    assert summary is not None
    assert summary.crop_ids == ("cabbage",)
    assert summary.model == "gemini-2.5-flash"
    body = body_of(script.requests[0])
    assert body["tools"] == [{"googleSearch": {}}]
    assert "responseMimeType" not in body["generationConfig"]
    # The same answer without grounding chunks: the model did not find the article.
    payload = json.loads(fixture_text("gemini_grounded.json"))
    del payload["candidates"][0]["groundingMetadata"]
    bare = Script({GROUNDED_URL: [httpx.Response(200, json=payload)]})
    assert await gemini(bare, grounded=True).summarize(no_text) is None


async def test_gemini_calls_are_spaced_out() -> None:
    script = Script({TEXT_URL: [ok("gemini_generate_content.json")]})
    time = FakeTime()
    model = gemini(script, grounded=False, time=time)
    await model.summarize(TW_REQUEST)
    await model.summarize(TW_REQUEST)
    assert time.slept == [7.0]


@pytest.mark.parametrize(
    "answer",
    [
        httpx.Response(429, json={"error": {"code": 429, "status": "RESOURCE_EXHAUSTED"}}),
        httpx.Response(400, json=json.loads(fixture_text("gemini_error_invalid_key.json"))),
        httpx.Response(404, json={"error": {"code": 404, "status": "NOT_FOUND"}}),
        httpx.ConnectError("no route"),
    ],
)
async def test_gemini_quota_key_model_and_network_errors_stop_it(answer: object) -> None:
    script = Script({TEXT_URL: [answer]})
    with pytest.raises(ModelUnavailableError):
        await gemini(script, grounded=False).summarize(TW_REQUEST)


@pytest.mark.parametrize(
    "answer",
    [
        httpx.Response(503, text="overloaded"),
        httpx.ReadTimeout("slow"),
        httpx.Response(200, text="not json"),
        httpx.Response(200, json={"promptFeedback": {"blockReason": "SAFETY"}}),
    ],
)
async def test_gemini_busy_slow_or_blocked_answers_skip_the_item(answer: object) -> None:
    script = Script({TEXT_URL: [answer]})
    assert await gemini(script, grounded=False).summarize(TW_REQUEST) is None


async def test_gemini_skips_thought_parts_and_falls_back_to_its_name() -> None:
    reply = '{"summary": "菜價上漲三成，西螺果菜市場到貨量減少。預計十天後回穩。", "crops": []}'
    payload = {
        "candidates": [
            {"content": {"parts": [{"text": "thinking…", "thought": True}, {"text": reply}]}}
        ]
    }
    script = Script({TEXT_URL: [httpx.Response(200, json=payload)]})
    summary = await gemini(script, grounded=False).summarize(TW_REQUEST)
    assert summary is not None
    assert summary.model == GEMINI_TEXT_MODEL


# ---------- OpenAI-compatible ----------


async def test_openai_compatible_call() -> None:
    script = Script({f"{LAB}/chat/completions": [ok("openai_chat_completion.json")]})
    model = OpenAICompatModel(
        LAB + "/", "qwen2.5:7b-instruct", "secret", transport=script.transport()
    )
    summary = await model.summarize(IN_REQUEST)
    assert summary is not None
    assert summary.text.startswith("Wholesale onion prices averaged Rs 3,736.61 per quintal")
    assert summary.crop_ids == ("onion", "potato", "tomato")
    assert summary.model == "qwen2.5:7b-instruct"
    request = script.requests[0]
    assert request.headers["authorization"] == "Bearer secret"
    body = body_of(request)
    assert body["model"] == "qwen2.5:7b-instruct"
    assert body["response_format"] == {"type": "json_object"}
    assert [m["role"] for m in body["messages"]] == ["system", "user"]
    assert "Article text" in body["messages"][1]["content"]


async def test_openai_compatible_needs_text_and_handles_errors() -> None:
    no_text = SummaryRequest(**{**IN_REQUEST.__dict__, "text": None})
    script = Script(
        {
            f"{LAB}/chat/completions": [
                httpx.ReadTimeout("slow"),
                httpx.Response(200, json={"choices": []}),
                httpx.Response(200, json={"choices": [{"message": {"content": "no json"}}]}),
                httpx.Response(500, text="crashed"),
            ]
        }
    )
    model = OpenAICompatModel(LAB, "small", transport=script.transport())
    assert await model.summarize(no_text) is None
    assert await model.summarize(IN_REQUEST) is None  # timed out
    assert await model.summarize(IN_REQUEST) is None  # no choices
    assert await model.summarize(IN_REQUEST) is None  # not JSON
    with pytest.raises(ModelUnavailableError):
        await model.summarize(IN_REQUEST)
    assert "authorization" not in script.requests[0].headers
    down = Script({f"{LAB}/chat/completions": [httpx.ConnectError("refused")]})
    with pytest.raises(ModelUnavailableError):
        await OpenAICompatModel(LAB, "small", transport=down.transport()).summarize(IN_REQUEST)


# ---------- order and budget ----------


class FakeModel:
    def __init__(self, name: str, answers: list[object], *, grounded: bool = False) -> None:
        self.name = name
        self.grounded = grounded
        self.answers = answers
        self.calls = 0

    async def summarize(self, request: SummaryRequest) -> Summary | None:
        self.calls += 1
        answer = self.answers.pop(0) if len(self.answers) > 1 else self.answers[0]
        if isinstance(answer, Exception):
            raise answer
        assert answer is None or isinstance(answer, Summary)
        return answer


SUMMARY = Summary("…", (), "m")


async def test_text_models_are_tried_in_order_and_a_failed_one_is_left_out() -> None:
    lab = FakeModel("lab", [ModelUnavailableError("down")])
    flash = FakeModel("flash", [None, SUMMARY])
    grounded = FakeModel("grounded", [SUMMARY], grounded=True)
    summaries = Summaries([lab, flash], grounded, calls=10)
    assert await summaries.summarize(TW_REQUEST) is None  # lab down, flash had no answer
    assert await summaries.summarize(TW_REQUEST) == SUMMARY  # lab no longer tried
    assert (lab.calls, flash.calls, grounded.calls) == (1, 2, 0)
    assert summaries.calls == 3


async def test_headline_only_requests_go_to_the_grounded_model() -> None:
    flash = FakeModel("flash", [SUMMARY])
    grounded = FakeModel("grounded", [SUMMARY], grounded=True)
    summaries = Summaries([flash], grounded, calls=10)
    no_text = SummaryRequest(**{**TW_REQUEST.__dict__, "text": None})
    assert await summaries.summarize(no_text) == SUMMARY
    assert (flash.calls, grounded.calls) == (0, 1)
    assert summaries.reads_headlines
    assert await Summaries([flash], None, calls=5).summarize(no_text) is None
    assert not Summaries([flash], None, calls=5).reads_headlines


async def test_the_call_budget_is_never_exceeded() -> None:
    flash = FakeModel("flash", [None])
    summaries = Summaries([flash], None, calls=2)
    for _ in range(4):
        await summaries.summarize(TW_REQUEST)
    assert flash.calls == 2
    assert summaries.calls_left == 0
    assert not summaries.available


def test_build_summaries_from_the_settings() -> None:
    none = build_summaries(
        gemini_api_key="",
        gemini_model="",
        summary_api_base="",
        summary_model="",
        summary_api_key="",
        calls=30,
    )
    assert none is None
    gemini_only = build_summaries(
        gemini_api_key="k",
        gemini_model="",
        summary_api_base="",
        summary_model="",
        summary_api_key="",
        calls=30,
    )
    assert gemini_only is not None
    assert [m.name for m in gemini_only.text_models] == [GEMINI_TEXT_MODEL]
    # Grounding is off by default: the free tier has no quota for it.
    assert gemini_only.headline_model is None
    grounded = build_summaries(
        gemini_api_key="k",
        gemini_model="",
        summary_api_base="",
        summary_model="",
        summary_api_key="",
        calls=30,
        gemini_grounded_model=GROUNDED,
    )
    assert grounded is not None
    assert grounded.headline_model is not None
    assert grounded.headline_model.name == GROUNDED
    both = build_summaries(
        gemini_api_key="k",
        gemini_model="gemini-2.5-flash-lite",
        summary_api_base=LAB,
        summary_model="small",
        summary_api_key="",
        calls=30,
    )
    assert both is not None
    assert [m.name for m in both.text_models] == ["small", "gemini-2.5-flash-lite"]
    lab_only = build_summaries(
        gemini_api_key="",
        gemini_model="",
        summary_api_base=LAB,
        summary_model="small",
        summary_api_key="",
        calls=30,
    )
    assert lab_only is not None
    assert lab_only.headline_model is None
