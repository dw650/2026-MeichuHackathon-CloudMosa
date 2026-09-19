"""Headline matching (docs/06 §1.4): normalised text, duplicate keys, and the crops, areas and
topic keywords a headline mentions.

Chinese terms match anywhere in the text (Chinese has no spaces between words). Latin terms
need word edges and accept a plural ending, so "onion" finds "Onions" but "rice" never
matches inside "prices"."""

import re
import unicodedata
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass

Names = Mapping[str, str]
# Taiwan writes 台 and 臺 interchangeably; the seed uses 台.
_VARIANTS = str.maketrans({"臺": "台"})
_SPACES = re.compile(r"\s+")
_LATIN = re.compile(r"[a-z]")
TITLE_KEY_LENGTH = 200
# 台中市 → 台中, 雲林縣 → 雲林: headlines often drop the suffix.
_AREA_SUFFIXES = ("市", "縣")


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


class TermIndex:
    """Ids and the terms that stand for them. `find` lists the ids a text mentions, in the
    order of their first mention."""

    def __init__(self, terms: Mapping[str, Iterable[str]]) -> None:
        self._terms: list[tuple[str, str | re.Pattern[str]]] = []
        for key, values in terms.items():
            for value in values:
                term = normalize(value)
                if not term:
                    continue
                self._terms.append((key, _pattern(term) if _LATIN.search(term) else term))

    def find(self, text: str) -> list[str]:
        haystack = normalize(text)
        first: dict[str, int] = {}
        for key, term in self._terms:
            if isinstance(term, str):
                at = haystack.find(term)
            else:
                match = term.search(haystack)
                at = match.start() if match else -1
            if at >= 0 and at < first.get(key, len(haystack) + 1):
                first[key] = at
        return sorted(first, key=lambda k: first[k])


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


@dataclass(frozen=True)
class Matcher:
    """What one country's headlines mention: crops, areas, and whether they are on topic."""

    crops: TermIndex
    areas: TermIndex
    keywords: TermIndex

    @classmethod
    def build(
        cls,
        *,
        crops: Iterable[tuple[str, Names]],
        areas: Iterable[tuple[str, Names]],
        crop_aliases: Mapping[str, Sequence[str]],
        area_aliases: Mapping[str, Sequence[str]],
        keywords: Sequence[str],
    ) -> "Matcher":
        return cls(
            crops=TermIndex(crop_terms(crops, crop_aliases)),
            areas=TermIndex(area_terms(areas, area_aliases)),
            keywords=TermIndex({kw: [kw] for kw in keywords}),
        )

    def crop_ids(self, text: str) -> list[str]:
        return self.crops.find(text)

    def area_ids(self, text: str) -> list[str]:
        return self.areas.find(text)

    def relevant(self, text: str) -> bool:
        """On topic: mentions a topic keyword or one of the country's crops."""
        return bool(self.keywords.find(text) or self.crops.find(text))
