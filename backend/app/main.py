"""FastAPI application factory (run with `uvicorn --factory app.main:create_app`)."""

from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI

from app.api.v1 import OPENAPI_TAGS, api_router, debug
from app.config import Settings, get_settings
from app.db.session import create_engine, create_sessionmaker
from app.errors import install_error_handlers
from app.middleware import RequestIdMiddleware, configure_logging


def _utc_now() -> datetime:
    return datetime.now(UTC)


def create_app(
    settings: Settings | None = None, clock: Callable[[], datetime] | None = None
) -> FastAPI:
    """`clock` returns the current UTC time; tests pass a fixed one."""
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    engine = create_engine(settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        await engine.dispose()

    app = FastAPI(
        title="AgriPrice API",
        version="1.0.0",
        summary="Regional crop prices for keypad phones (CloudMosa Cloud Phone).",
        description=(
            "Prices are per kg in the country's currency; units and formatting are the"
            ' client\'s job. Names come as `{"zh-TW": …, "en": …}`. Dates are the'
            " country's local trade dates (`YYYY-MM-DD`). Errors always look like"
            ' `{"error": {"code", "message", "request_id"}}`.'
        ),
        openapi_tags=OPENAPI_TAGS,
        # Operation ids are the handler names, which keeps the generated types readable.
        generate_unique_id_function=lambda route: route.name,
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/v1/openapi.json",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.clock = clock or _utc_now
    app.state.engine = engine
    app.state.sessionmaker = create_sessionmaker(engine)
    install_error_handlers(app)
    app.add_middleware(RequestIdMiddleware)
    app.include_router(api_router, prefix="/api/v1")
    if settings.demo_mode:
        # Diagnostics only exist in demo mode and stay out of the public OpenAPI document.
        app.include_router(debug.router, prefix="/api/v1", include_in_schema=False)
    return app
