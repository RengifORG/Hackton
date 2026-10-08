"""Configuración por entorno con pydantic-settings.

Secretos solo por variables de entorno (`.env` está en .gitignore; ver `.env.example`).
"""

from __future__ import annotations

from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends, Request
from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

API_DIR = Path(__file__).resolve().parents[2]  # apps/api
REPO_ROOT = API_DIR.parents[1]  # raíz del monorepo
DATA_DIR = REPO_ROOT / "data"


class Settings(BaseSettings):
    # `env_ignore_empty`: `HUBSPOT_TOKEN=` (como deja .env.example) cuenta como ausente.
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", env_ignore_empty=True, extra="ignore"
    )

    app_name: str = "BYD Ecuador Lead Agent API"
    log_level: str = "INFO"
    # Orígenes CORS separados por coma (front local + CloudFront por env).
    cors_origins: str = "http://localhost:5173"
    catalog_path: Path = DATA_DIR / "catalog.json"
    slots_path: Path = DATA_DIR / "slots.json"
    # LLM (F5): solo si USE_BEDROCK=1; nunca credenciales en código. pydantic-settings no
    # exporta el .env a os.environ: el perfil se pasa explícito a boto3 (`AWS_PROFILE`).
    use_bedrock: bool = False
    aws_region: str = "us-east-1"
    aws_profile: str | None = None
    # D3: Claude Haiku 4.5 vía perfil de inferencia `us.`; respaldo `amazon.nova-lite-v1:0`.
    bedrock_model_id: str = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
    bedrock_guardrail_id: str | None = None
    bedrock_guardrail_version: str = "DRAFT"
    # Simulación de hora para la demo (F6), p. ej. `2026-10-08T19:00:00-05:00`. Vacío = hora real.
    demo_now: datetime | None = None
    # CRM (F1): si falta, se usa FakeCrm.
    hubspot_token: SecretStr | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Settings del proceso (uvicorn). Dentro de la app usa `SettingsDep`, no esta función."""
    return Settings()


def get_app_settings(request: Request) -> Settings:
    """Dependencia FastAPI: los settings con los que se construyó ESTA app (tests incluidos)."""
    return request.app.state.settings


SettingsDep = Annotated[Settings, Depends(get_app_settings)]
