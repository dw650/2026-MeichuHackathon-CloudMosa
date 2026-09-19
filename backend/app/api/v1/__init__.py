"""Version 1 of the HTTP API, mounted at /api/v1."""

from fastapi import APIRouter

from app.api.v1 import catalog, health, intl, locate, news, prices

OPENAPI_TAGS = [
    {"name": "catalog", "description": "Countries, areas and crops."},
    {"name": "prices", "description": "Area prices, quotes, comparisons and markets."},
    {
        "name": "intl",
        "description": "International reference prices: World Bank monthly series per kg in"
        " the country's currency (bonus B5).",
    },
    {"name": "news", "description": "Farm price news of a country, with short summaries."},
    {"name": "locate", "description": "Location guess from the network address."},
    {"name": "health", "description": "Service and data source status."},
]

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(catalog.router)
api_router.include_router(prices.router)
api_router.include_router(intl.router)
api_router.include_router(news.router)
api_router.include_router(locate.router)
