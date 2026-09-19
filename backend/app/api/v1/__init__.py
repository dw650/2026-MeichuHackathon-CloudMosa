"""Version 1 of the HTTP API, mounted at /api/v1."""

from fastapi import APIRouter

from app.api.v1 import health

api_router = APIRouter()
api_router.include_router(health.router)
