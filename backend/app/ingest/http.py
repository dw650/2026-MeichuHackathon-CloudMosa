"""HTTP access shared by the network sources (docs/06 §1.4).

One client per run; requests go out one after another with a pause between them; busy answers
(429, 5xx) and network errors are retried after a pause that doubles each time; any other error
answer fails the run, which keeps the previous data. Every request sent (retries included) is
counted, so each run can log how much it asked of the source."""

import asyncio
from collections.abc import Awaitable, Callable, Collection, Mapping
from dataclasses import dataclass, field
from types import TracebackType
from typing import Self

import httpx

Sleep = Callable[[float], Awaitable[None]]


class UpstreamError(RuntimeError):
    """The source failed, refused the request or answered with something we cannot read."""


@dataclass(frozen=True)
class RetryPolicy:
    attempts: int = 3
    pause_s: float = 1.0  # before every request of a run but the first
    backoff_s: float = 5.0  # before a retry, doubled each time
    timeout: httpx.Timeout = field(default_factory=lambda: httpx.Timeout(60.0, connect=10.0))


class Fetcher:
    """`async with Fetcher(...) as http:` then `await http.get(url, read=...)`.

    `read` gets the streamed response and returns what the caller keeps. A download cut off
    midway is retried from the start, so `read` must build its result from scratch each time."""

    def __init__(
        self,
        label: str,
        *,
        policy: RetryPolicy | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
        sleep: Sleep = asyncio.sleep,
    ) -> None:
        self.label = label
        self.policy = policy or RetryPolicy()
        self.requests = 0
        self._transport = transport
        self._sleep = sleep
        self._client: httpx.AsyncClient | None = None
        self._calls = 0

    async def __aenter__(self) -> Self:
        self._client = httpx.AsyncClient(transport=self._transport, timeout=self.policy.timeout)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def get[T](
        self,
        url: str,
        *,
        read: Callable[[httpx.Response], Awaitable[T]],
        params: Mapping[str, str] | None = None,
        headers: Mapping[str, str] | None = None,
        allow: Collection[int] = (),
        what: str | None = None,
    ) -> T:
        """One GET. Statuses in `allow` (for example 304 or 404) go to `read` like a success."""
        if self._client is None:
            raise RuntimeError("open the Fetcher with `async with` first")
        if self._calls:
            await self._sleep(self.policy.pause_s)
        self._calls += 1
        error = ""
        for attempt in range(1, self.policy.attempts + 1):
            if attempt > 1:
                await self._sleep(self.policy.backoff_s * 2 ** (attempt - 2))
            self.requests += 1
            try:
                async with self._client.stream("GET", url, params=params, headers=headers) as res:
                    status = res.status_code
                    if status in allow:
                        return await read(res)
                    if status == 429 or status >= 500:
                        error = f"HTTP {status}"
                        continue
                    if res.is_error:
                        raise UpstreamError(f"{self.label} answered HTTP {status}")
                    return await read(res)
            except httpx.TransportError as exc:
                error = repr(exc)
        target = what or url
        raise UpstreamError(
            f"{self.label} failed {self.policy.attempts} attempts for {target}: {error}"
        )
