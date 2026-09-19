"""HTTP for the B5 sources: conditional GETs, a few polite retries, bounded downloads."""

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

import httpx

USER_AGENT = "agriprice-worker/1.0 (monthly reference prices; one request a day)"
TIMEOUT = httpx.Timeout(60.0, connect=10.0)
ATTEMPTS = 3
BACKOFF_S = 5.0  # before a retry, doubled each time
MAX_BYTES = 20_000_000  # the Pink Sheet file is about 0.6 MB

Sleep = Callable[[float], Awaitable[None]]


class UpstreamError(RuntimeError):
    """A source failed, refused the request or answered with something unusable."""


@dataclass(frozen=True)
class Validators:
    """What a server said about its copy, sent back to ask "changed since?"."""

    etag: str | None = None
    last_modified: str | None = None


@dataclass(frozen=True)
class Download:
    url: str  # after redirects
    not_modified: bool  # 304: our copy is current
    content: bytes = b""
    validators: Validators = field(default_factory=Validators)


def make_client(transport: httpx.AsyncBaseTransport | None = None) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=transport,
        timeout=TIMEOUT,
        follow_redirects=True,
        headers={"User-Agent": USER_AGENT},
    )


async def _read(response: httpx.Response, max_bytes: int) -> bytes:
    declared = response.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > max_bytes:
        raise UpstreamError(f"{response.url} is more than {max_bytes} bytes")
    chunks: list[bytes] = []
    size = 0
    async for chunk in response.aiter_bytes():
        size += len(chunk)
        if size > max_bytes:
            raise UpstreamError(f"{response.url} is more than {max_bytes} bytes")
        chunks.append(chunk)
    return b"".join(chunks)


async def download(
    client: httpx.AsyncClient,
    url: str,
    *,
    validators: Validators | None = None,
    max_bytes: int = MAX_BYTES,
    sleep: Sleep = asyncio.sleep,
    attempts: int = ATTEMPTS,
) -> Download:
    """GETs `url`, conditionally when `validators` are given. Busy answers (429, 5xx) and
    network errors are retried after a growing pause; any other error raises at once."""
    headers: dict[str, str] = {}
    if validators and validators.etag:
        headers["If-None-Match"] = validators.etag
    if validators and validators.last_modified:
        headers["If-Modified-Since"] = validators.last_modified
    error = ""
    for attempt in range(1, attempts + 1):
        if attempt > 1:
            await sleep(BACKOFF_S * 2 ** (attempt - 2))
        try:
            async with client.stream("GET", url, headers=headers) as response:
                if response.status_code == 304:
                    return Download(str(response.url), True, validators=validators or Validators())
                if response.status_code == 429 or response.status_code >= 500:
                    error = f"HTTP {response.status_code}"
                    continue
                if response.is_error:
                    raise UpstreamError(f"{url} answered HTTP {response.status_code}")
                content = await _read(response, max_bytes)
                got = Validators(
                    response.headers.get("etag"), response.headers.get("last-modified")
                )
                return Download(str(response.url), False, content, got)
        except httpx.TransportError as exc:
            error = repr(exc)
    raise UpstreamError(f"{url} failed {attempts} attempts: {error}")
