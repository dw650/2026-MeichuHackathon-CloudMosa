"""Test helpers for the news pipeline: fixtures on disk, a fake clock, a scripted server.

The fixtures under tests/fixtures/news/ are real answers saved on 2026-09-20 (Google News RSS
searches for TW, IN and MY, a news.google.com article page and its batchexecute answer, two
publisher pages), trimmed to keep them small. The Gemini and OpenAI-compatible answers follow
the documented response shapes (no key was used to record them). Nothing touches the network."""

from collections.abc import Callable, Sequence
from pathlib import Path

import httpx

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "news"


def fixture_bytes(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def fixture_text(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


class FakeTime:
    """`sleep` advances `now` instead of waiting; `slept` records every pause."""

    def __init__(self) -> None:
        self.now = 1000.0
        self.slept: list[float] = []

    def clock(self) -> float:
        return self.now

    async def sleep(self, seconds: float) -> None:
        self.slept.append(seconds)
        self.now += seconds


Handler = Callable[[httpx.Request], httpx.Response]


class Script:
    """A MockTransport handler answering from a queue per URL prefix; records every request.
    An answer is a response, an exception to raise, or a callable taking the request."""

    def __init__(self, routes: dict[str, Sequence[object]]) -> None:
        self.routes = {prefix: list(answers) for prefix, answers in routes.items()}
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        url = str(request.url)
        for prefix, answers in self.routes.items():
            if url.startswith(prefix):
                if not answers:
                    raise AssertionError(f"no answer left for {url}")
                answer = answers.pop(0) if len(answers) > 1 else answers[0]
                if isinstance(answer, Exception):
                    raise answer
                if callable(answer):
                    response = answer(request)
                    assert isinstance(response, httpx.Response)
                    return response
                assert isinstance(answer, httpx.Response)
                return answer
        raise AssertionError(f"unexpected request {url}")

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self)

    def urls(self) -> list[str]:
        return [str(r.url) for r in self.requests]
