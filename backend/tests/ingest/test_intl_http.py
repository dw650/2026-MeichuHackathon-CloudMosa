"""Downloads of the B5 sources: conditional, retried when busy, bounded in size."""

from collections.abc import Sequence

import httpx
import pytest

from app.ingest.intl.http import (
    MAX_BYTES,
    USER_AGENT,
    Download,
    UpstreamError,
    Validators,
    download,
    make_client,
)

URL = "https://example.test/file.xlsx"
LAST_MODIFIED = "Wed, 02 Sep 2026 20:17:37 GMT"


class Server:
    """Serves `answers` in turn (a status code, a response or an exception to raise)."""

    def __init__(self, answers: Sequence[int | httpx.Response | Exception]) -> None:
        self.answers = list(answers)
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        if isinstance(answer, int):
            return httpx.Response(answer, text="busy")
        return answer


class Sleeps(list[float]):
    async def __call__(self, seconds: float) -> None:
        self.append(seconds)


async def fetch(
    server: Server, validators: Validators | None = None, max_bytes: int = MAX_BYTES
) -> tuple[Download, Sleeps]:
    sleeps = Sleeps()
    async with make_client(httpx.MockTransport(server)) as client:
        result = await download(
            client, URL, validators=validators, max_bytes=max_bytes, sleep=sleeps
        )
    return result, sleeps


async def test_a_full_download_keeps_the_validators_for_next_time() -> None:
    headers = {"Last-Modified": LAST_MODIFIED, "ETag": '"a1"'}
    server = Server([httpx.Response(200, content=b"xlsx", headers=headers)])
    result, _ = await fetch(server)
    assert result == Download(
        url=URL,
        not_modified=False,
        content=b"xlsx",
        validators=Validators(etag='"a1"', last_modified=LAST_MODIFIED),
    )
    request = server.requests[0]
    assert request.headers["User-Agent"] == USER_AGENT
    assert "If-Modified-Since" not in request.headers


async def test_the_validators_make_the_request_conditional() -> None:
    server = Server([304])
    validators = Validators(etag='"a1"', last_modified=LAST_MODIFIED)
    result, _ = await fetch(server, validators)
    assert result.not_modified
    assert result.content == b""
    assert result.validators == validators
    assert server.requests[0].headers["If-Modified-Since"] == LAST_MODIFIED
    assert server.requests[0].headers["If-None-Match"] == '"a1"'


async def test_busy_answers_and_network_errors_are_retried_with_growing_pauses() -> None:
    server = Server([503, httpx.ConnectError("down"), httpx.Response(200, content=b"ok")])
    result, sleeps = await fetch(server)
    assert result.content == b"ok"
    assert sleeps == [5.0, 10.0]


async def test_three_failures_give_up() -> None:
    server = Server([429, 502, httpx.ReadTimeout("slow")])
    with pytest.raises(UpstreamError, match="failed 3 attempts: ReadTimeout"):
        await fetch(server)


async def test_other_client_errors_are_not_retried() -> None:
    server = Server([404, 200])
    with pytest.raises(UpstreamError, match="HTTP 404"):
        await fetch(server)
    assert len(server.requests) == 1


async def test_redirects_are_followed_and_the_final_address_kept() -> None:
    moved = httpx.Response(301, headers={"Location": "https://example.test/new.xlsx"})
    server = Server([moved, httpx.Response(200, content=b"new")])
    result, _ = await fetch(server)
    assert (result.url, result.content) == ("https://example.test/new.xlsx", b"new")


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, content=b"x" * 11),
        httpx.Response(200, content=b"x" * 5, headers={"Content-Length": "5000"}),
    ],
)
async def test_downloads_over_the_size_limit_are_refused(response: httpx.Response) -> None:
    with pytest.raises(UpstreamError, match="more than 10 bytes"):
        await fetch(Server([response]), max_bytes=10)
