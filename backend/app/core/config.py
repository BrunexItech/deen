from pydantic_settings import BaseSettings, SettingsConfigDict

# Development-only Fernet key. Production refuses to boot with it (assert_production_safe).
_DEV_DATA_KEY = "cOAlLv4X0GmBxbyKq0wWJ3YJv8b3WZ1cTqQ2yYhF0mA="


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "DEEN"
    environment: str = "development"  # development | production
    testing: bool = False
    # Development convenience: run the background worker inside the API process.
    # Production runs `python -m app.worker` separately (EMBEDDED_WORKER=false).
    embedded_worker: bool = True
    timezone: str = "Africa/Nairobi"

    database_url: str = "postgresql+asyncpg://deen:deen@localhost:5437/deen"
    db_pool_size: int = 20
    db_max_overflow: int = 30
    # Optional. When set, rate limits and hot caches are shared across API replicas;
    # without it each process keeps its own (fine for a single instance).
    redis_url: str = ""

    # Tokens
    jwt_secret: str = "change-me-jwt"
    jwt_algorithm: str = "HS256"
    access_minutes: int = 20
    refresh_days: int = 45
    web_session_hours: int = 12

    # Field-level encryption (identity documents, TOTP secrets) + keyed hashing.
    data_key: str = _DEV_DATA_KEY
    hash_pepper: str = "change-me-pepper"

    cors_origins: str = "http://localhost:3020,http://127.0.0.1:3020"
    app_url: str = "http://localhost:3020"  # web portal (invite links point here)
    api_public_url: str = "http://localhost:8020"

    # Brute-force protection
    max_failed_logins: int = 6
    lockout_minutes: int = 15
    otp_minutes: int = 10
    otp_max_attempts: int = 5
    # Staff (DEEN + organization users) must use an authenticator app in production.
    staff_mfa_required: bool = False

    trusted_proxies: int = 0
    client_ip_header: str = ""

    # Storage
    data_dir: str = "./data"
    max_upload_mb: int = 10

    # Messaging providers (sandbox = log only; dev codes are returned to the client)
    sms_provider: str = "sandbox"  # sandbox | africastalking
    at_username: str = "sandbox"
    at_api_key: str = ""
    at_sender_id: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "DEEN <no-reply@deen.africa>"
    whatsapp_provider: str = "sandbox"  # sandbox | cloud (Meta WhatsApp Business Cloud API)
    wa_phone_number_id: str = ""
    wa_access_token: str = ""
    wa_template: str = "deen_update"
    expo_push_enabled: bool = True
    expo_access_token: str = ""

    # Payments (M-Pesa Daraja). sandbox = simulated STK push that settles itself.
    payments_provider: str = "sandbox"  # sandbox | daraja
    mpesa_env: str = "sandbox"  # sandbox | production
    mpesa_consumer_key: str = ""
    mpesa_consumer_secret: str = ""
    mpesa_shortcode: str = "174379"
    mpesa_passkey: str = ""
    mpesa_callback_token: str = "change-me-callback"

    # Matching
    match_notify_threshold: int = 50  # score (0-100) above which a new opportunity notifies a member
    fanout_batch_size: int = 2000

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def assert_production_safe(self) -> None:
        if not self.is_production:
            return
        weak = [k for k in ("jwt_secret", "hash_pepper", "mpesa_callback_token") if getattr(self, k).startswith("change-me")]
        if self.data_key == _DEV_DATA_KEY:
            weak.append("data_key")
        if weak:
            raise RuntimeError(f"Refusing to start in production with default secrets: {', '.join(weak)}")


settings = Settings()
