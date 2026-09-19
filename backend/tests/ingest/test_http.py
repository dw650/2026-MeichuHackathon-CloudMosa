"""The shared HTTP helper of network sources: spacing, retries with back-off, request counts."""

from collections.abc import Sequence

import httpx
import pytest

from app.ingest.http import Fetcher, RetryPolicy, UpstreamError

URL = "https://example.test/data"
POLICY = RetryPolicy(attempts=3, pause_s=1.0, backoff_s=5.0)


class Server:
    """Serves `failures` first (a status code or an exception each), then `body`."""

    def __init__(self, failures: Sequence[int | Exception] = (), body: str = "ok") -> None:
        self.failures = list(failures)
        self.body = body
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.failures:
            failure = self.failures.pop(0)
            if isinstance(failure, Exception):
                raise failure
            return httpx.Response(failure, text="busy")
        return httpx.Response(200, text=self.body)


class Sleeps(list[float]):
    async def __call__(self, seconds: float) -> None:
        self.append(seconds)


async def text(response: httpx.Response) -> str:
    return (await response.aread()).decode()


def fetcher(server: Server, policy: RetryPolicy = POLICY) -> tuple[Fetcher, Sleeps]:
    sleeps = Sleeps()
    http = Fetcher("Example", policy=policy, transport=httpx.MockTransport(server), sleep=sleeps)
    return http, sleeps


async def test_requests_after_the_first_wait_a_pause() -> None:
    server = Server()
    http, sleeps = fetcher(server)
    async with http:
        assert await http.get(URL, read=text) == "ok"
        assert await http.get(URL, read=text, params={"page": "2"}) == "ok"
    assert sleeps == [POLICY.pause_s]
    assert http.requests == 2
    assert server.requests[1].url.params["page"] == "2"


async def test_busy_answers_and_network_errors_are_retried_with_a_growing_pause() -> None:
    server = Server(failures=[503, httpx.ConnectTimeout("slow"), 429])
    http, sleeps = fetcher(server, RetryPolicy(attempts=4, pause_s=1.0, backoff_s=5.0))
    async with http:
        assert await http.get(URL, read=text) == "ok"
    assert sleeps == [5.0, 10.0, 20.0]
    assert http.requests == 4


async def test_the_last_error_is_reported_when_the_attempts_run_out() -> None:
    server = Server(failures=[503, 503, 502])
    http, _ = fetcher(server)
    async with http:
        with pytest.raises(UpstreamError, match=r"Example failed 3 attempts for .*: HTTP 502"):
            await http.get(URL, read=text)
    assert http.requests == 3


async def test_a_client_error_fails_at_once() -> None:
    server = Server(failures=[404])
    http, _ = fetcher(server)
    async with http:
        with pytest.raises(UpstreamError, match="Example answered HTTP 404"):
            await http.get(URL, read=text)
    assert http.requests == 1


async def test_allowed_statuses_reach_the_reader() -> None:
    server = Server(failures=[404])

    async def status(response: httpx.Response) -> int:
        return response.status_code

    http, _ = fetcher(server)
    async with http:
        assert await http.get(URL, read=status, allow={404}) == 404


async def test_a_download_cut_off_midway_starts_again() -> None:
    # The reader sees the whole body again on the retry, so it never keeps half a file.
    calls: list[str] = []

    async def body(response: httpx.Response) -> str:
        data = await text(response)
        calls.append(data)
        if len(calls) == 1:
            raise httpx.ReadError("connection reset")
        return data

    http, sleeps = fetcher(Server(body="a,b"))
    async with http:
        assert await http.get(URL, read=body) == "a,b"
    assert calls == ["a,b", "a,b"]
    assert sleeps == [POLICY.backoff_s]


async def test_headers_are_sent() -> None:
    server = Server()
    http, _ = fetcher(server)
    async with http:
        await http.get(URL, read=text, headers={"If-None-Match": '"abc"'})
    assert server.requests[0].headers["If-None-Match"] == '"abc"'


async def test_it_must_be_opened_before_use() -> None:
    http, _ = fetcher(Server())
    with pytest.raises(RuntimeError, match="async with"):
        await http.get(URL, read=text)
