import os
import sys

DEFAULT_JWT_SECRET = "change-me-in-production"


def is_production() -> bool:
    env = os.getenv("APP_ENV", "development").strip().lower()
    if env == "production":
        return True
    return os.getenv("RENDER", "").lower() == "true"


def validate_settings() -> None:
    """Fail fast when production is misconfigured."""
    if not is_production():
        return

    jwt = os.getenv("JWT_SECRET", DEFAULT_JWT_SECRET).strip()
    if not jwt or jwt == DEFAULT_JWT_SECRET or len(jwt) < 32:
        print(
            "FATAL: JWT_SECRET must be set to a random string of at least 32 characters in production.",
            file=sys.stderr,
        )
        sys.exit(1)

    if not os.getenv("DATABASE_URL", "").strip():
        print("FATAL: DATABASE_URL is required in production.", file=sys.stderr)
        sys.exit(1)

    cors = os.getenv("CORS_ORIGINS", "").strip()
    if not cors:
        print("FATAL: CORS_ORIGINS must list your production frontend URL(s).", file=sys.stderr)
        sys.exit(1)
    if "https://" not in cors:
        print(
            "WARN: CORS_ORIGINS should include https:// production frontend URL(s).",
            file=sys.stderr,
        )


def cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    if is_production():
        return [o for o in origins if not o.startswith("http://localhost")]
    return origins
