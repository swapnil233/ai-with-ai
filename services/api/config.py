from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_app_builder"
    cors_origin: str = "http://localhost:3000"
    trusted_origins: str = "http://localhost:3000"
    api_port: int = 4000
    rate_limit_max: int = 300
    rate_limit_window_ms: int = 900000
    node_env: str = "development"
    modal_token_id: str = ""
    modal_token_secret: str = ""
    better_auth_session_cookie: str = "better-auth.session_token"

    @property
    def async_database_url(self) -> str:
        """Convert standard postgresql:// URL to asyncpg format."""
        url = self.database_url
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        # Strip ?schema=public if present (Prisma-specific, not valid for asyncpg)
        if "?schema=" in url:
            url = url.split("?schema=")[0]
        return url

    @property
    def is_production(self) -> bool:
        return self.node_env == "production"

    @property
    def trusted_origins_list(self) -> list[str]:
        origins = [o.strip() for o in self.trusted_origins.split(",") if o.strip()]
        if self.cors_origin and self.cors_origin not in origins:
            origins.append(self.cors_origin)
        return origins or ["http://localhost:3000"]

    model_config = ConfigDict(env_file="../../.env", extra="ignore")


settings = Settings()
