"""Application settings, loaded from environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    database_url: str = "postgresql+psycopg://agri:agri-local-only@127.0.0.1:5432/agri"
    # Tests use a fresh connection per session so engines never cross event loops.
    db_null_pool: bool = False
    demo_mode: bool = False
    providers: str = "mock"
    geoip_db_path: str = "/data/geoip/city.mmdb"
    datagov_api_key: str = ""
    log_level: str = "INFO"
    # The running commit, passed by `make up` and scripts/deploy.sh (APP_VERSION).
    app_version: str = "dev"

    @property
    def provider_ids(self) -> list[str]:
        return [p.strip() for p in self.providers.split(",") if p.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
