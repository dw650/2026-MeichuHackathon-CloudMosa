"""Two-sentence summaries of news articles (docs/06 §1.4), in the country's UI language, with
the related crops picked only from the country's crop list.

Models, tried in this order:
- a self-hosted model behind an OpenAI-compatible chat endpoint (`SUMMARY_API_BASE`,
  `SUMMARY_MODEL`, optional `SUMMARY_API_KEY`), when configured; it can only condense the
  article text it is given;
- Gemini on the free tier (`GEMINI_API_KEY`): `GEMINI_MODEL` (default gemini-3.5-flash-lite)
  condenses the article text without grounding; when only the headline is known (the link could
  not be resolved or the page could not be read), gemini-2.5-flash searches for the article with
  Google Search grounding.

A model that fails (quota, key, network) is skipped for the rest of the run. An answer that does
not follow the rules (not JSON, empty, wrong language, too long, not grounded) is dropped: the
item keeps its title only. There is never a made-up summary."""

import asyncio
import json
import logging
import re
import time
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from typing import Any, Protocol

import httpx

from app.ingest.news.base import Monotonic, Pacer, Sleep

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
GEMINI_TEXT_MODEL = "gemini-3.5-flash-lite"  # free tier, stable (checked 2026-09-20)
GEMINI_GROUNDED_MODEL = "gemini-2.5-flash"  # free tier with Google Search grounding
GEMINI_PACE_S = 7.0  # fewer than 10 calls a minute, below the free tier's per-minute limits
GEMINI_TIMEOUT = httpx.Timeout(90.0, connect=10.0)
LAB_TIMEOUT = httpx.Timeout(300.0, connect=10.0)  # a small self-hosted model may be slow
MAX_SUMMARY_CHARS = 300
MAX_CROPS = 3

LANG_NAMES = {"zh-TW": "Traditional Chinese as written in Taiwan (繁體中文)", "en": "English"}
LENGTH = {"zh-TW": "at most 90 Chinese characters in total", "en": "at most 50 words in total"}
_CJK = re.compile("[\u3400-\u9fff]")  # CJK ideographs
_LATIN = re.compile(r"[A-Za-z]")
_SENTENCE_END = re.compile(r"(?<=[。！？!?])|(?<=\.)(?=\s|$)")

logger = logging.getLogger("app.ingest.news")

SYSTEM = (
    "You summarise farm-produce market news for farmers and traders who read it on a small"
    " keypad phone. Use only facts stated in the article. Never add facts, numbers, names,"
    " causes or advice the article does not state. Answer with one JSON object and nothing"
    " else."
)


@dataclass(frozen=True)
class CropChoice:
    id: str
    names: tuple[str, ...]


@dataclass(frozen=True)
class SummaryRequest:
    title: str
    source: str
    published: date
    lang: str
    crops: tuple[CropChoice, ...]
    # The article's main text; None when only the headline is known.
    text: str | None = None


@dataclass(frozen=True)
class Summary:
    text: str
    crop_ids: tuple[str, ...]
    model: str


class ModelUnavailableError(Exception):
    """The model cannot be used for the rest of the run (quota, key, network, configuration)."""


class Model(Protocol):
    name: str
    # True when it can find the article from the headline (Google Search grounding).
    grounded: bool

    async def summarize(self, request: SummaryRequest) -> Summary | None: ...


def build_prompt(request: SummaryRequest, *, grounded: bool) -> str:
    crops = "\n".join(f"{c.id}: {', '.join(c.names)}" for c in request.crops)
    lang = request.lang if request.lang in LANG_NAMES else "en"
    task = (
        "Use Google Search to find this news article and read it. If you cannot find this exact"
        ' article, answer {"summary": "", "crops": []}.\n'
        if grounded
        else ""
    )
    rules = (
        f"{task}Write the summary in {LANG_NAMES[lang]}: exactly two short sentences,"
        f" {LENGTH[lang]}.\n"
        "Also pick the crops the article is mainly about, using only ids from this list"
        " (id: names); if unsure, pick none:\n"
        f"{crops}\n"
        'Answer as JSON: {"summary": "...", "crops": ["id"]}.\n'
        "If the article is not about farm produce, or the text below is not the article of"
        ' this headline, answer {"summary": "", "crops": []}.\n\n'
        f"Headline: {request.title}\n"
        f"Publisher: {request.source}, {request.published.isoformat()}\n"
    )
    if grounded or request.text is None:
        return rules
    return (
        f"{rules}Article text (it may contain page menus or adverts; ignore them):\n"
        f'"""\n{request.text}\n"""\n'
    )


def _json_object(text: str) -> dict[str, Any] | None:
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        value = json.loads(text[start : end + 1])
    except ValueError:
        return None
    return value if isinstance(value, dict) else None


def _language_ok(text: str, lang: str) -> bool:
    cjk, latin = len(_CJK.findall(text)), len(_LATIN.findall(text))
    if lang == "zh-TW":
        return cjk >= 10 and cjk >= latin
    return latin >= 20 and cjk == 0


def _two_sentences(text: str) -> str:
    parts = [p.strip() for p in _SENTENCE_END.split(text) if p and p.strip()]
    joiner = "" if _CJK.search(text) else " "
    return joiner.join(parts[:2])


def parse_reply(reply: str, request: SummaryRequest) -> tuple[str, tuple[str, ...]] | None:
    """(summary, crop ids) from a model's answer; None when it breaks a rule."""
    value = _json_object(reply)
    if value is None:
        return None
    raw = value.get("summary")
    summary = _two_sentences(" ".join(raw.split())) if isinstance(raw, str) else ""
    if not summary or len(summary) > MAX_SUMMARY_CHARS or not _language_ok(summary, request.lang):
        return None
    allowed = {c.id for c in request.crops}
    picked = value.get("crops")
    crops = (
        [c for c in picked if isinstance(c, str) and c in allowed]
        if isinstance(picked, list)
        else []
    )
    return summary, tuple(dict.fromkeys(crops))[:MAX_CROPS]


class OpenAICompatModel:
    """A self-hosted model (Ollama, vLLM, llama.cpp server…) behind `/v1/chat/completions`."""

    grounded = False

    def __init__(
        self,
        base_url: str,
        model: str,
        api_key: str = "",
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.name = model
        self._url = base_url.rstrip("/") + "/chat/completions"
        self._headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self._transport = transport

    async def summarize(self, request: SummaryRequest) -> Summary | None:
        if request.text is None:
            return None  # it cannot read the web: no text, no summary
        body = {
            "model": self.name,
            "messages": [
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": build_prompt(request, grounded=False)},
            ],
            "temperature": 0.2,
            "stream": False,
            "response_format": {"type": "json_object"},
        }
        async with httpx.AsyncClient(transport=self._transport, timeout=LAB_TIMEOUT) as client:
            try:
                response = await client.post(self._url, json=body, headers=self._headers)
            except httpx.TimeoutException:
                logger.info("news: summary model %s timed out", self.name)
                return None
            except httpx.HTTPError as exc:
                raise ModelUnavailableError(f"{self.name}: {exc!r}") from exc
        if response.is_error:
            raise ModelUnavailableError(f"{self.name}: HTTP {response.status_code}")
        try:
            payload = response.json()
            content = payload["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError):
            return None
        parsed = parse_reply(content, request) if isinstance(content, str) else None
        if parsed is None:
            return None
        model = payload.get("model") if isinstance(payload.get("model"), str) else self.name
        return Summary(text=parsed[0], crop_ids=parsed[1], model=model)


def _reply_text(payload: dict[str, Any]) -> str:
    candidates = payload.get("candidates") or []
    if not candidates:
        return ""
    parts = (candidates[0].get("content") or {}).get("parts") or []
    return "".join(p.get("text", "") for p in parts if isinstance(p, dict) and not p.get("thought"))


def _grounded(payload: dict[str, Any]) -> bool:
    candidates = payload.get("candidates") or [{}]
    chunks = (candidates[0].get("groundingMetadata") or {}).get("groundingChunks") or []
    return any(isinstance(c, dict) and c.get("web") for c in chunks)


class GeminiModel:
    """Gemini `generateContent` on the free tier. `grounded` models get the Google Search tool
    (and no JSON schema, which grounded 2.5 models do not accept with tools)."""

    def __init__(
        self,
        api_key: str,
        model: str,
        *,
        grounded: bool,
        pacer: Pacer,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.name = model
        self.grounded = grounded
        self._key = api_key
        self._pacer = pacer
        self._transport = transport

    def body(self, request: SummaryRequest) -> dict[str, Any]:
        body: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": SYSTEM}]},
            "contents": [
                {"role": "user", "parts": [{"text": build_prompt(request, grounded=self.grounded)}]}
            ],
            "generationConfig": {"temperature": 0.2},
        }
        if self.grounded:
            body["tools"] = [{"googleSearch": {}}]
        else:
            crop_ids = [c.id for c in request.crops]
            items: dict[str, Any] = {"type": "string"}
            if crop_ids:
                items["enum"] = crop_ids
            body["generationConfig"] |= {
                "responseMimeType": "application/json",
                "responseJsonSchema": {
                    "type": "object",
                    "properties": {
                        "summary": {"type": "string"},
                        "crops": {"type": "array", "items": items},
                    },
                    "required": ["summary", "crops"],
                },
            }
        return body

    async def summarize(self, request: SummaryRequest) -> Summary | None:
        if request.text is None and not self.grounded:
            return None
        await self._pacer.wait()
        async with httpx.AsyncClient(transport=self._transport, timeout=GEMINI_TIMEOUT) as client:
            try:
                response = await client.post(
                    GEMINI_URL.format(model=self.name),
                    json=self.body(request),
                    headers={"x-goog-api-key": self._key},
                )
            except httpx.TimeoutException:
                logger.info("news: %s timed out", self.name)
                return None
            except httpx.HTTPError as exc:
                raise ModelUnavailableError(f"{self.name}: {exc!r}") from exc
        if response.status_code >= 500:
            logger.info("news: %s answered HTTP %s", self.name, response.status_code)
            return None
        if response.is_error:
            # 429 quota used up, 400 bad key or request, 403, 404 unknown model.
            raise ModelUnavailableError(
                f"{self.name}: HTTP {response.status_code} {response.text[:200]}"
            )
        try:
            payload = response.json()
        except ValueError:
            return None
        if self.grounded and not _grounded(payload):
            return None  # it did not find the article: nothing to summarise
        parsed = parse_reply(_reply_text(payload), request)
        if parsed is None:
            return None
        version = payload.get("modelVersion")
        return Summary(
            text=parsed[0],
            crop_ids=parsed[1],
            model=version if isinstance(version, str) and version else self.name,
        )


class Summaries:
    """Runs the models in order within a call budget; counts every call."""

    def __init__(
        self,
        text_models: Sequence[Model],
        headline_model: Model | None,
        *,
        calls: int,
    ) -> None:
        self.text_models = list(text_models)
        self.headline_model = headline_model
        self.calls_left = calls
        self.calls = 0
        self._down: set[str] = set()

    def _up(self, models: Sequence[Model | None]) -> list[Model]:
        return [m for m in models if m is not None and m.name not in self._down]

    @property
    def reads_headlines(self) -> bool:
        """A model can still summarise from the headline alone."""
        return self.calls_left > 0 and bool(self._up([self.headline_model]))

    @property
    def available(self) -> bool:
        return self.calls_left > 0 and bool(self._up([*self.text_models, self.headline_model]))

    async def summarize(self, request: SummaryRequest) -> Summary | None:
        models = self.text_models if request.text is not None else [self.headline_model]
        for model in self._up(models):
            if self.calls_left <= 0:
                break
            self.calls_left -= 1
            self.calls += 1
            try:
                summary = await model.summarize(request)
            except ModelUnavailableError as exc:
                logger.warning("news: %s is not used for the rest of this run: %s", model.name, exc)
                self._down.add(model.name)
                continue
            if summary is not None:
                return summary
        return None


def build_summaries(
    *,
    gemini_api_key: str,
    gemini_model: str,
    summary_api_base: str,
    summary_model: str,
    summary_api_key: str,
    calls: int,
    transport: httpx.AsyncBaseTransport | None = None,
    sleep: Sleep = asyncio.sleep,
    clock: Monotonic = time.monotonic,
) -> Summaries | None:
    """The configured models; None when neither a self-hosted model nor Gemini is set up."""
    text_models: list[Model] = []
    headline_model: Model | None = None
    if summary_api_base and summary_model:
        text_models.append(
            OpenAICompatModel(summary_api_base, summary_model, summary_api_key, transport=transport)
        )
    if gemini_api_key:
        pacer = Pacer(GEMINI_PACE_S, sleep, clock)
        text_models.append(
            GeminiModel(
                gemini_api_key,
                gemini_model or GEMINI_TEXT_MODEL,
                grounded=False,
                pacer=pacer,
                transport=transport,
            )
        )
        headline_model = GeminiModel(
            gemini_api_key, GEMINI_GROUNDED_MODEL, grounded=True, pacer=pacer, transport=transport
        )
    if not text_models:
        return None
    return Summaries(text_models, headline_model, calls=calls)
