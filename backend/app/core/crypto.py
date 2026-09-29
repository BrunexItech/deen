"""Encryption at rest for sensitive fields and files (Kenya Data Protection Act 2019:
religion and identity documents are sensitive personal data)."""
from cryptography.fernet import Fernet

from app.core.config import settings

_fernet = Fernet(settings.data_key.encode())


def encrypt_text(value: str) -> str:
    return _fernet.encrypt(value.encode()).decode()


def decrypt_text(token: str) -> str:
    return _fernet.decrypt(token.encode()).decode()


def encrypt_bytes(data: bytes) -> bytes:
    return _fernet.encrypt(data)


def decrypt_bytes(data: bytes) -> bytes:
    return _fernet.decrypt(data)


def mask_tail(value: str | None, keep: int = 4) -> str:
    return f"••••{value[-keep:]}" if value else "—"
