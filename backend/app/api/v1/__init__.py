"""Version 1 of the HTTP API, mounted at /api/v1."""

from fastapi import APIRouter

from app.api.v1 import catalog, health

OPENAPI_TAGS = [
    {"name": "catalog", "description": "Countries, areas and crops."},
    {"name": "health", "description": "Service and data source status."},
]

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(catalog.router)
