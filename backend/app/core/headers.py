from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import settings

_UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}


class SecurityHeaders(BaseHTTPMiddleware):
    """API responses carry personal data: never cache, frame or sniff them.

    Cookie-authenticated (web portal) writes must carry X-Requested-With — a custom
    header a cross-site form cannot send, which closes CSRF without tokens. Bearer
    clients (the mobile app) are not exposed to CSRF and skip the check."""

    async def dispatch(self, request: Request, call_next):
        if (
            request.method in _UNSAFE
            and request.url.path.startswith("/api/")
            and "authorization" not in request.headers
            and request.cookies.get("deen_at")
            and request.headers.get("x-requested-with") != "deen-web"
        ):
            return JSONResponse({"detail": "Missing CSRF header"}, status_code=403)
        response = await call_next(request)
        h = response.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("X-Frame-Options", "DENY")
        h.setdefault("Referrer-Policy", "no-referrer")
        h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if request.url.path.startswith("/api/"):
            h.setdefault("Cache-Control", "no-store")
        if settings.is_production:
            h.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
        return response
