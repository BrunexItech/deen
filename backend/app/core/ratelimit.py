"""Fixed-window rate limiter. Uses Redis when REDIS_URL is set (shared across API
replicas, required when scaling horizontally), else an in-process window."""
import time
from collections import defaultdict

from fastapi import HTTPException, Request

from app.core.config import settings

_redis = None
if settings.redis_url and not settings.testing:
    import redis.asyncio as aioredis

    _redis = aioredis.from_url(settings.redis_url, decode_responses=True)


class RateLimiter:
    _registry: list["RateLimiter"] = []

    def __init__(self, name: str, limit: int, window_seconds: int):
        self.name = name
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)
        RateLimiter._registry.append(self)

    @classmethod
    def reset_all(cls) -> None:
        for limiter in cls._registry:
            limiter.reset()

    async def hit(self, key: str) -> None:
        if _redis is not None:
            bucket = f"rl:{self.name}:{key}:{int(time.time() // self.window)}"
            count = await _redis.incr(bucket)
            if count == 1:
                await _redis.expire(bucket, self.window)
            if count > self.limit:
                raise HTTPException(429, "Too many attempts. Please wait a moment and try again.")
            return
        now = time.monotonic()
        hits = [t for t in self._hits[key] if now - t < self.window]
        if len(hits) >= self.limit:
            raise HTTPException(429, "Too many attempts. Please wait a moment and try again.")
        hits.append(now)
        self._hits[key] = hits

    def reset(self) -> None:
        self._hits.clear()


def client_ip(request: Request) -> str:
    if settings.client_ip_header:
        value = request.headers.get(settings.client_ip_header, "").strip()
        if value:
            return value[:64]
    peer = request.client.host if request.client else "unknown"
    if settings.trusted_proxies > 0:
        hops = [h.strip() for h in request.headers.get("x-forwarded-for", "").split(",") if h.strip()]
        if len(hops) >= settings.trusted_proxies:
            return hops[-settings.trusted_proxies][:64]
    return peer
