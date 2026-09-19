"""FastAPI application factory (run with `uvicorn --factory app.main:create_app`)."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1 import api_router, debug
from app.config import Settings, get_settings
from app.db.session import create_engine, create_sessionmaker
from app.errors import install_error_handlers
from app.middleware import RequestIdMiddleware, configure_logging


def create_app(settings: Settings | None = None) -> FastAPI:
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
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/v1/openapi.json",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.sessionmaker = create_sessionmaker(engine)
    install_error_handlers(app)
    app.add_middleware(RequestIdMiddleware)
    app.include_router(api_router, prefix="/api/v1")
    if settings.demo_mode:
        # Diagnostics only exist in demo mode and stay out of the public OpenAPI document.
        app.include_router(debug.router, prefix="/api/v1", include_in_schema=False)
    return app
