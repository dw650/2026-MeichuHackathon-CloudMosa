"""The main text of a publisher's page, with a light heuristic and no extra dependency.

In order of preference:
1. `articleBody` of the page's schema.org JSON-LD (most news sites have it);
2. the page's paragraphs (`<p>`), inside `<article>` when there is one, without navigation,
   headers, footers, forms and scripts, and without paragraphs that are mostly links;
3. the `og:description` / `description` meta tag.

The text is only passed to the summariser and is never stored (docs/06 §1.4)."""

import json
import re
from collections.abc import Iterator
from html.parser import HTMLParser
from typing import Any

MAX_CHARS = 3000  # enough for a two-sentence summary; keeps model calls small
MIN_BODY = 200  # shorter than this is not an article body
MIN_DESCRIPTION = 60
MIN_PARAGRAPH = 20
MAX_LINK_SHARE = 0.5
_SPACES = re.compile(r"\s+")
_SKIP = frozenset(
    {
        "script", "style", "noscript", "template", "svg", "iframe", "nav", "header",
        "footer", "aside", "form", "button", "select", "figcaption",
    }
)  # fmt: skip
_CHARSET = re.compile(rb"""<meta[^>]+charset\s*=\s*["']?([A-Za-z0-9_.:-]+)""", re.IGNORECASE)


def _clean(text: str) -> str:
    return _SPACES.sub(" ", text).strip()


class _PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: dict[str, str] = {}
        self.json_ld: list[str] = []
        # (text, link characters, inside <article>)
        self.paragraphs: list[tuple[str, int, bool]] = []
        self._skip = 0
        self._article = 0
        self._links = 0
        self._paragraph: list[str] | None = None
        self._link_chars = 0
        self._ld: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {k: v or "" for k, v in attrs}
        if tag == "meta":
            key = (values.get("property") or values.get("name") or "").lower()
            if key in ("og:description", "description") and values.get("content"):
                self.meta.setdefault(key, values["content"])
            return
        if tag == "script" and values.get("type", "").lower() == "application/ld+json":
            self._ld = []
        if tag in _SKIP:
            self._skip += 1
        elif tag == "article":
            self._article += 1
        elif tag == "a":
            self._links += 1
        elif tag == "p" and not self._skip:
            self._flush()
            self._paragraph, self._link_chars = [], 0

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._ld is not None:
            self.json_ld.append("".join(self._ld))
            self._ld = None
        if tag in _SKIP:
            self._skip = max(0, self._skip - 1)
        elif tag == "article":
            self._article = max(0, self._article - 1)
        elif tag == "a":
            self._links = max(0, self._links - 1)
        elif tag == "p":
            self._flush()

    def handle_data(self, data: str) -> None:
        if self._ld is not None:
            self._ld.append(data)
        elif self._paragraph is not None and not self._skip:
            self._paragraph.append(data)
            if self._links:
                self._link_chars += len(data.strip())

    def close(self) -> None:
        super().close()
        self._flush()

    def _flush(self) -> None:
        if self._paragraph is not None:
            text = _clean("".join(self._paragraph))
            if text:
                self.paragraphs.append((text, self._link_chars, self._article > 0))
            self._paragraph = None


def _walk(node: Any) -> Iterator[dict[str, Any]]:
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from _walk(value)
    elif isinstance(node, list):
        for value in node:
            yield from _walk(value)


def _article_body(blocks: list[str]) -> str:
    for block in blocks:
        try:
            data = json.loads(block)
        except ValueError:
            continue
        for node in _walk(data):
            body = node.get("articleBody")
            if isinstance(body, str) and len(_clean(body)) >= MIN_BODY:
                return _clean(body)
    return ""


def _paragraph_text(paragraphs: list[tuple[str, int, bool]]) -> str:
    kept = [
        (text, inside)
        for text, links, inside in paragraphs
        if len(text) >= MIN_PARAGRAPH and links / len(text) < MAX_LINK_SHARE
    ]
    inside = [text for text, flag in kept if flag]
    chosen = inside if len("".join(inside)) >= MIN_BODY else [text for text, _ in kept]
    unique = list(dict.fromkeys(chosen))
    return "\n".join(unique)


def _cut(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    cut = text[:limit]
    end = cut.rfind("\n")
    return cut[:end] if end > limit // 2 else cut


def extract_text(html: str, max_chars: int = MAX_CHARS) -> str | None:
    """The page's main text, at most `max_chars`; None when the page has nothing usable."""
    parser = _PageParser()
    parser.feed(html)
    parser.close()
    body = _article_body(parser.json_ld)
    if len(body) < MIN_BODY:
        body = _paragraph_text(parser.paragraphs)
    if len(body) >= MIN_BODY:
        return _cut(body, max_chars)
    description = _clean(parser.meta.get("og:description") or parser.meta.get("description", ""))
    if len(description) >= max(MIN_DESCRIPTION, len(body)):
        return _cut(description, max_chars)
    return _cut(body, max_chars) if len(body) >= MIN_DESCRIPTION else None


def decode_html(content: bytes, charset: str | None) -> str:
    """Text of a page: the header's charset, else a `<meta charset>` near the top, else UTF-8.
    Undecodable bytes become U+FFFD instead of failing."""
    if not charset:
        match = _CHARSET.search(content[:4096])
        charset = match.group(1).decode("ascii") if match else "utf-8"
    try:
        return content.decode(charset, errors="replace")
    except LookupError:
        return content.decode("utf-8", errors="replace")
