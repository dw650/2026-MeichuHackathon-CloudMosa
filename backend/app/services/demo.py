"""Demo switches (F18, docs/04 §6.2). Built from request headers only when DEMO_MODE=true."""

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import date, timedelta

LOCATE_NONE = "none"


@dataclass(frozen=True)
class Demo:
    fail: bool = False
    # Area → days to push its latest trade date back.
    stale_days: Mapping[str, int] = field(default_factory=dict)
    # Replaces the forwarded client address for /locate.
    ip: str | None = None
    # Forces the /locate answer: (country, area) or LOCATE_NONE.
    locate: tuple[str, str] | str | None = None

    def until(self, area_id: str, today: date) -> date:
        return today - timedelta(days=self.stale_days.get(area_id, 0))


NO_DEMO = Demo()
