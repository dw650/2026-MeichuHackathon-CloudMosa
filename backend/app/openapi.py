"""Prints the OpenAPI document (`python -m app.openapi`), used to generate frontend types.

Always built with DEMO_MODE off, so demo-only endpoints never leak into the contract."""

import json
import sys

from app.config import Settings
from app.main import create_app


def document() -> dict[str, object]:
    return create_app(Settings(demo_mode=False)).openapi()


if __name__ == "__main__":  # pragma: no cover
    json.dump(document(), sys.stdout, indent=2, sort_keys=True, ensure_ascii=False)
    sys.stdout.write("\n")
