from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException
from jwt import PyJWKClient
from jwt import PyJWTError

from app.settings import get_settings


@dataclass(frozen=True)
class WorkbenchUser:
    sub: str
    email: str


@lru_cache(maxsize=4)
def _jwks_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url)


def _issuer(settings) -> str | None:
    if not settings.supabase_url:
        return None
    return f"{settings.supabase_url.rstrip('/')}/auth/v1"


def _decode_with_jwks(token: str, settings) -> dict:
    """Verify asymmetric JWTs (JWT Signing Keys) via JWKS."""
    if not settings.supabase_url:
        raise jwt.InvalidTokenError("SUPABASE_URL not set")
    jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    client = _jwks_client(jwks_url)
    signing_key = client.get_signing_key_from_jwt(token)
    header = jwt.get_unverified_header(token)
    alg = header.get("alg")
    if not alg:
        raise jwt.InvalidTokenError("Token missing alg header")
    iss = _issuer(settings)
    decode_kwargs: dict = {
        "algorithms": [alg],
        "audience": "authenticated",
        "options": {"require": ["exp", "sub"]},
    }
    if iss:
        decode_kwargs["issuer"] = iss
    return jwt.decode(token, signing_key.key, **decode_kwargs)


def _decode_with_legacy_secret(token: str, settings) -> dict:
    """Verify HS256 JWTs signed with the legacy JWT secret."""
    if not settings.supabase_jwt_secret:
        raise jwt.InvalidTokenError("SUPABASE_JWT_SECRET not set")
    iss = _issuer(settings)
    decode_kwargs: dict = {
        "algorithms": ["HS256"],
        "audience": "authenticated",
        "options": {"require": ["exp", "sub"]},
    }
    if iss:
        decode_kwargs["issuer"] = iss
    return jwt.decode(token, settings.supabase_jwt_secret, **decode_kwargs)


def decode_workbench_token(authorization: str | None) -> WorkbenchUser:
    settings = get_settings()
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()

    if not settings.supabase_url and not settings.supabase_jwt_secret:
        raise HTTPException(status_code=503, detail="Workbench auth not configured")

    decoded: dict | None = None
    last_error: PyJWTError | None = None

    # Prefer JWKS when SUPABASE_URL is set (JWT Signing Keys — ES256/RS256, recommended).
    if settings.supabase_url:
        try:
            decoded = _decode_with_jwks(token, settings)
        except PyJWTError as e:
            last_error = e

    # Fall back to legacy HS256 secret (older sessions or migrated-but-not-rotated tokens).
    if decoded is None and settings.supabase_jwt_secret:
        try:
            decoded = _decode_with_legacy_secret(token, settings)
        except PyJWTError as e:
            last_error = e

    if decoded is None:
        raise HTTPException(status_code=401, detail="Invalid token") from last_error

    email = decoded.get("email")
    if not email or not isinstance(email, str):
        raise HTTPException(status_code=401, detail="Token missing email")

    allow = settings.admin_email_allowlist_set
    if allow and email.strip().lower() not in allow:
        raise HTTPException(status_code=403, detail="Email not allowed for workbench")

    sub = decoded.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token")
    return WorkbenchUser(sub=str(sub), email=email.strip().lower())


async def get_current_workbench_user(authorization: str | None = Header(None)) -> WorkbenchUser:
    return decode_workbench_token(authorization)
