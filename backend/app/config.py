import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    gee_project: str = ""
    gee_boundary_asset: str = "FAO/GAUL/2025/level2"
    cors_origins: str = "http://localhost:5173"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def origins(self) -> list[str]:
        return [part.strip() for part in self.cors_origins.split(",") if part.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings()
