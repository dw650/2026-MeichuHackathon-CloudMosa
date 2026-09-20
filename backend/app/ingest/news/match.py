"""Headline matching (docs/06 §1.6): normalised text, duplicate keys, and the crops, areas and
topic keywords a headline mentions.

Chinese terms match anywhere in the text (Chinese has no spaces between words). Latin terms
need word edges and accept a plural ending, so "onion" finds "Onions" but "rice" never
matches inside "prices".

Crops and areas are matched with a guard, because a wrong crop is worse than no crop: the
user presses 1 to open that crop's prices. A match is skipped when a negation comes just
before it (「不是香蕉苒果」, "not onions") and when it sits inside a longer term that also
matched (薜 inside 薜黃, kubis inside kubis bunga, 香蕉 inside the configured 香蕉葡萄, Taipei
inside New Taipei). Keywords, topics, price words and excludes are matched without the guard:
they only decide whether a headline is price news at all, and a negated price word
(「沒有蔬菜漲價」) still means the headline is about prices.

Publishers are matched by `SourceFilter`, on the domain rather than the headline."""

import re
import unicodedata
from collections.abc import Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass

Names = Mapping[str, str]
# Taiwan writes 台 and 臺 interchangeably; the seed uses 台.
_VARIANTS = str.maketrans({"臺": "台"})
_SPACES = re.compile(r"\s+")
_LATIN = re.compile(r"[a-z]")
TITLE_KEY_LENGTH = 200
# 台中市 → 台中, 雲林縣 → 雲林: headlines often drop the suffix.
_AREA_SUFFIXES = ("市", "縣")
# Negations that turn a mention into "this is not about it". 非 on its own is left out on
# purpose: 南非 (South Africa) and 非洲 (Africa) would then negate whatever follows them.
NEGATIONS_CJK = ("不是", "並非", "而非", "不含", "不加", "除了", "沒有")
NEGATIONS_LATIN = frozenset({"not", "no"})
NEGATION_CHARS = 6  # Chinese has no spaces: look at the few characters before the term
NEGATION_WORDS = 3  # Latin: look at the words right before the term
_WORDS = re.compile(r"[a-z]+")
# A negation does not reach past the end of a clause, so 「不是香蕉！甘藍價格…」 still tags the
# cabbage. A list separator (、 ,) is not an end: 「不是香蕉、苒果」 negates both.
_CLAUSE_END = re.compile(r"[。！？；：!?;:\n]")


def normalize(text: str) -> str:
    """NFKC (full-width letters and digits become plain ones), 臺 → 台, lower case, single
    spaces."""
    folded = unicodedata.normalize("NFKC", text).translate(_VARIANTS).lower()
    return _SPACES.sub(" ", folded).strip()


def title_key(title: str) -> str:
    """Duplicate key of a headline: its letters and digits only, so punctuation, spacing and
    case do not make two copies of one headline look different."""
    return "".join(ch for ch in normalize(title) if ch.isalnum())[:TITLE_KEY_LENGTH]


def clean_title(title: str, source: str | None) -> str:
    """Google News appends " - {source}" to every title; the source is shown on its own."""
    title = title.strip()
    if source:
        suffix = f" - {source.strip()}"
        if title.endswith(suffix):
            title = title[: -len(suffix)].rstrip()
    return title


def _pattern(term: str) -> re.Pattern[str]:
    words = [re.escape(w) for w in term.split(" ")]
    # Word edges on both sides; the last word may take a plural (onions, tomatoes, chillies).
    return re.compile(r"(?<![a-z0-9])" + r"\s+".join(words) + r"(?:e?s)?(?![a-z0-9])")


def _negated(haystack: str, at: int) -> bool:
    """True when a negation stands just before the match, in the same clause:
    「不是香蕉苒果」 negates both crops, "No tomatoes left" negates the tomato."""
    head = _CLAUSE_END.split(haystack[:at])[-1]
    if any(word in head[-NEGATION_CHARS:] for word in NEGATIONS_CJK):
        return True
    return any(word in NEGATIONS_LATIN for word in _WORDS.findall(head)[-NEGATION_WORDS:])


class TermIndex:
    """Ids and the terms that stand for them. `find` lists the ids a text mentions, in the
    order of their first mention. `confusable` adds longer phrases that contain a term but
    mean something else (香蕉葡萄 is a grape, not 香蕉)."""

    def __init__(
        self,
        terms: Mapping[str, Iterable[str]],
        *,
        guard: bool = False,
        confusable: Sequence[str] = (),
    ) -> None:
        self._terms: list[tuple[str, str, re.Pattern[str] | None]] = []
        for key, values in terms.items():
            for value in values:
                term = normalize(value)
                if not term:
                    continue
                self._terms.append((key, term, _pattern(term) if _LATIN.search(term) else None))
        self._guard = guard
        self._longer = _longer_terms([t for _, t, _ in self._terms], confusable) if guard else ()

    def find(self, text: str) -> list[str]:
        haystack = normalize(text)
        first: dict[str, int] = {}
        for key, term, pattern in self._terms:
            at = self._first(haystack, term, pattern)
            if at >= 0 and at < first.get(key, len(haystack) + 1):
                first[key] = at
        return sorted(first, key=lambda k: first[k])

    def _first(self, haystack: str, term: str, pattern: re.Pattern[str] | None) -> int:
        """Where the term first counts. With the guard on, a negated match or one inside a
        longer matched term is skipped, so a plain mention further on still counts
        (「薜黃與薜」 is both turmeric and ginger)."""
        for at, length in _spans(haystack, term, pattern):
            if not self._guard:
                return at
            if not _negated(haystack, at) and not self._inside_longer(haystack, at, length, term):
                return at
        return -1

    def _inside_longer(self, haystack: str, at: int, length: int, term: str) -> bool:
        for longer in self._longer:
            if len(longer) <= length or term not in longer:
                continue
            found = haystack.find(longer)
            while found >= 0:
                if found <= at and at + length <= found + len(longer):
                    return True
                found = haystack.find(longer, found + 1)
        return False


def _spans(haystack: str, term: str, pattern: re.Pattern[str] | None) -> Iterator[tuple[int, int]]:
    """Every place the term occurs, left to right, as (start, length)."""
    if pattern is None:
        at = haystack.find(term)
        while at >= 0:
            yield at, len(term)
            at = haystack.find(term, at + 1)
        return
    for match in pattern.finditer(haystack):
        yield match.start(), match.end() - match.start()


def _longer_terms(terms: Sequence[str], confusable: Sequence[str]) -> tuple[str, ...]:
    """The terms that contain another term of this index, plus the configured phrases."""
    every = sorted(set(terms))
    inside = {t for t in every if any(other != t and other in t for other in every)}
    return tuple(sorted(inside | {c for c in map(normalize, confusable) if c}))


def _unique(values: Iterable[str]) -> list[str]:
    out: list[str] = []
    for value in values:
        if value and value not in out:
            out.append(value)
    return out


def crop_terms(
    crops: Iterable[tuple[str, Names]], aliases: Mapping[str, Sequence[str]]
) -> dict[str, list[str]]:
    """Every name of every crop (all languages of the seed) plus the configured aliases;
    aliases of crops the country does not have are ignored."""
    return {cid: _unique([*names.values(), *aliases.get(cid, ())]) for cid, names in crops}


def area_terms(
    areas: Iterable[tuple[str, Names]], aliases: Mapping[str, Sequence[str]]
) -> dict[str, list[str]]:
    """Every name of every area, the Chinese names without 市／縣, and the aliases."""
    out: dict[str, list[str]] = {}
    for aid, names in areas:
        values = list(names.values())
        short = [
            v[:-1]
            for v in values
            if v.endswith(_AREA_SUFFIXES) and len(v) > 2 and not _LATIN.search(v.lower())
        ]
        out[aid] = _unique([*values, *short, *aliases.get(aid, ())])
    return out


def _words(values: Sequence[str]) -> TermIndex:
    return TermIndex({value: [value] for value in values})


class SourceFilter:
    """Publishers whose items are never kept (docs/06 §1.6). A foreign content farm that
    translates another country's market reports into the local language carries no country
    word at all, so no title rule can catch it.

    An entry matches the publisher's domain, either exactly or as a parent of it
    (`vietnam.vn` also blocks `www.vietnam.vn` and `en.vietnam.vn`), and the publisher's name
    as a whole word, so a local paper that merely writes about Vietnam stays. An entry that
    starts with a dot is a whole top-level domain (`.in` blocks every Indian publisher) and is
    never matched against a name."""

    def __init__(self, entries: Sequence[str]) -> None:
        cleaned = [(e.startswith("."), _host(e)) for e in map(normalize, entries)]
        self._domains = frozenset(host for _, host in cleaned if host)
        self._names = _words([host for tld, host in cleaned if host and not tld])

    def blocked(self, name: str, domain: str | None) -> bool:
        host = _host(domain or "")
        if host and any(host == d or host.endswith(f".{d}") for d in self._domains):
            return True
        return bool(name and self._names.find(name))


def _host(value: str) -> str:
    """`  WWW.Vietnam.VN/ ` → `vietnam.vn`, `.in` → `in`."""
    return normalize(value).strip(" ./").removeprefix("www.")


@dataclass(frozen=True)
class Matcher:
    """What one country's headlines mention: crops, areas, and whether they are on topic."""

    crops: TermIndex
    areas: TermIndex
    keywords: TermIndex
    topics: TermIndex
    price_words: TermIndex
    exclude: TermIndex
    exclude_sources: SourceFilter

    @classmethod
    def build(
        cls,
        *,
        crops: Iterable[tuple[str, Names]],
        areas: Iterable[tuple[str, Names]],
        crop_aliases: Mapping[str, Sequence[str]],
        area_aliases: Mapping[str, Sequence[str]],
        keywords: Sequence[str],
        topics: Sequence[str] = (),
        price_words: Sequence[str] = (),
        exclude: Sequence[str] = (),
        exclude_sources: Sequence[str] = (),
        confusable: Sequence[str] = (),
    ) -> "Matcher":
        return cls(
            crops=TermIndex(crop_terms(crops, crop_aliases), guard=True, confusable=confusable),
            areas=TermIndex(area_terms(areas, area_aliases), guard=True),
            keywords=_words(keywords),
            topics=_words(topics),
            price_words=_words(price_words),
            exclude=_words(exclude),
            exclude_sources=SourceFilter(exclude_sources),
        )

    def blocked_source(self, name: str, domain: str | None) -> bool:
        """True when this publisher is never kept, whatever the headline says."""
        return self.exclude_sources.blocked(name, domain)

    def crop_ids(self, text: str) -> list[str]:
        return self.crops.find(text)

    def area_ids(self, text: str) -> list[str]:
        return self.areas.find(text)

    def relevant(self, text: str) -> bool:
        """On topic: a price keyword (菜價, mandi prices), or a crop or farm topic together with
        a price word (芭樂 … 價格, onion … prices). A market or a crop alone is not enough:
        「果菜市場發加倍券」 is not price news. Headlines with an `exclude` word (other
        countries' market reports) are never on topic."""
        if self.exclude.find(text):
            return False
        if self.keywords.find(text):
            return True
        about_produce = bool(self.crops.find(text) or self.topics.find(text))
        return about_produce and bool(self.price_words.find(text))
