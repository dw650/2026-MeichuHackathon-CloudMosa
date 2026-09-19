"""Unified error format: {"error": {"code", "message", "request_id"}}."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    """An error the client can act on; `code` is stable and mapped to i18n text."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def error_response(status: int, code: str, message: str, request_id: str) -> JSONResponse:
    body = {"error": {"code": code, "message": message, "request_id": request_id}}
    return JSONResponse(status_code=status, content=body)


def request_id_of(request: Request) -> str:
    return str(getattr(request.state, "request_id", "-"))


_HTTP_CODES = {404: "not_found", 405: "method_not_allowed"}


async def _api_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ApiError)
    return error_response(exc.status, exc.code, exc.message, request_id_of(request))


async def _http_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    code = _HTTP_CODES.get(exc.status_code, "http_error")
    return error_response(exc.status_code, code, str(exc.detail), request_id_of(request))


async def _validation_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    parts = []
    for err in exc.errors():
        where = ".".join(str(x) for x in err.get("loc", ()) if x not in ("query", "path"))
        parts.append(f"{where}: {err.get('msg', 'invalid')}")
    message = "; ".join(parts) or "Invalid parameter"
    return error_response(400, "invalid_param", message, request_id_of(request))


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, _api_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
