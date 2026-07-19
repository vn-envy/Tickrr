"""Runtime settings, loaded from environment / .env (see .env.example)."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    tickrr_env: str = "dev"

    # Data sources (read-only, public)
    polymarket_gamma_url: str = "https://gamma-api.polymarket.com"
    polymarket_clob_url: str = "https://clob.polymarket.com"
    kalshi_api_url: str = "https://api.elections.kalshi.com/trade-api/v2"

    # The Odds API (sportsbook consensus — DraftKings, FanDuel, Pinnacle, bet365, ...).
    # Free key at the-odds-api.com (500 req/mo; responses cached ~15 min to stay inside it).
    # Leave empty to run without the books layer — everything degrades gracefully.
    odds_api_url: str = "https://api.the-odds-api.com"
    odds_api_key: str = ""

    # Google Cloud / Gemini (Vertex AI)
    google_cloud_project: str = ""
    google_cloud_location: str = "us-central1"
    gemini_model: str = "gemini-2.5-flash"

    # HTTP
    request_timeout_s: float = 20.0


settings = Settings()
