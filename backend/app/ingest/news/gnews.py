"""Google News links → publisher URLs.

RSS links (`news.google.com/rss/articles/<id>`) are JavaScript redirects that plain HTTP cannot
follow. The known way round it, as the open-source googlenewsdecoder does: fetch the article
page for the signature and timestamp on the element carrying `data-n-a-sg` / `data-n-a-ts`, then
ask Google's `batchexecute` endpoint (rpc `Fbv4je`, "garturlreq") for the URL. Two requests per
link; failures leave the item title-only."""

import json
from html.parser import HTMLParser
from urllib.parse import quote, urlparse

ARTICLE_URL = "https://news.google.com/rss/articles/{id}"
BATCH_URL = "https://news.google.com/_/DotsSplashUi/data/batchexecute"
BATCH_HEADERS = {"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"}


def article_id(link: str) -> str | None:
    """The id at the end of `https://news.google.com/rss/articles/<id>?oc=5`; None for other
    links (those already point at the publisher)."""
    url = urlparse(link)
    parts = url.path.rstrip("/").split("/")
    if url.hostname == "news.google.com" and len(parts) > 2 and parts[-2] in ("articles", "read"):
        return parts[-1] or None
    return None


class _ParamFinder(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.found: tuple[str, str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if self.found is None:
            values = dict(attrs)
            signature, timestamp = values.get("data-n-a-sg"), values.get("data-n-a-ts")
            if signature and timestamp:
                self.found = (signature, timestamp)


def decoding_params(html: str) -> tuple[str, str] | None:
    """(signature, timestamp) from a news.google.com article page."""
    finder = _ParamFinder()
    finder.feed(html)
    return finder.found


def batch_body(aid: str, timestamp: str, signature: str) -> str:
    """Form body of the `garturlreq` call for one article."""
    inner = (
        '["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,'
        'null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],'
        f'"{aid}",{timestamp},"{signature}"]'
    )
    return "f.req=" + quote(json.dumps([[["Fbv4je", inner]]]))


def parse_batch(text: str) -> str | None:
    """The publisher URL from a batchexecute answer (`)]}'` guard, blank line, JSON)."""
    try:
        payload = json.loads(text.split("\n\n", 1)[1])
        for entry in payload:
            if isinstance(entry, list) and len(entry) > 2 and entry[1] == "Fbv4je":
                result = json.loads(entry[2])
                url = result[1] if isinstance(result, list) and len(result) > 1 else None
                if isinstance(url, str) and urlparse(url).scheme in ("http", "https"):
                    return url
    except (IndexError, ValueError, TypeError):
        return None
    return None
