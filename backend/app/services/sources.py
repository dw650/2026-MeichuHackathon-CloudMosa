"""Display names of the data sources."""

SOURCE_NAMES: dict[str, dict[str, str]] = {
    "mock": {"zh-TW": "示範資料", "en": "Demo data"},
    "tw_moa": {"zh-TW": "農業部 農產品交易行情", "en": "MOA farm product prices"},
    "in_datagov": {"zh-TW": "data.gov.in（Agmarknet）", "en": "data.gov.in (Agmarknet)"},
}


def source_info(source_id: str | None) -> dict[str, object] | None:
    if source_id is None:
        return None
    return {
        "id": source_id,
        "name": SOURCE_NAMES.get(source_id, {"zh-TW": source_id, "en": source_id}),
    }
