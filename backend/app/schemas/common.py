"""Shared response parts."""

from pydantic import BaseModel, ConfigDict, Field


class I18nText(BaseModel):
    """Text in every supported language; switching language needs no refetch."""

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    zh_tw: str = Field(alias="zh-TW")
    en: str


class StalenessOut(BaseModel):
    """today · closed (only closed days since) · stale · none (nothing in 30 days)."""

    days: int | None
    state: str = Field(pattern="^(today|closed|stale|none)$")


class ErrorBody(BaseModel):
    code: str
    message: str
    request_id: str


class ErrorOut(BaseModel):
    error: ErrorBody


def error_responses(*codes: tuple[int, str, str]) -> dict[int | str, dict[str, object]]:
    """OpenAPI entries for error responses: (status, code, description)."""
    return {
        status: {
            "model": ErrorOut,
            "description": description,
            "content": {
                "application/json": {
                    "example": {
                        "error": {"code": code, "message": description, "request_id": "b3f1c2…"}
                    }
                }
            },
        }
        for status, code, description in codes
    }
