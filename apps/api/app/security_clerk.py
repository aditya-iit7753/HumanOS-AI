from functools import lru_cache
from typing import Any
from urllib.error import URLError
from urllib.request import urlopen

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User

bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def fetch_clerk_jwks() -> dict[str, Any]:
    settings = get_settings()
    if not settings.clerk_jwks_url:
        raise HTTPException(status_code=500, detail="CLERK_JWKS_URL is not configured")
    try:
        with urlopen(settings.clerk_jwks_url, timeout=10) as response:
            import json

            return json.loads(response.read().decode("utf-8"))
    except (OSError, URLError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="Unable to load Clerk signing keys") from exc


def decode_clerk_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    jwks = fetch_clerk_jwks()
    key = next((candidate for candidate in jwks.get("keys", []) if candidate.get("kid") == kid), None)
    if key is None:
        fetch_clerk_jwks.cache_clear()
        jwks = fetch_clerk_jwks()
        key = next((candidate for candidate in jwks.get("keys", []) if candidate.get("kid") == kid), None)
    if key is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown Clerk signing key")

    options = {"verify_aud": bool(settings.clerk_jwt_audience)}
    kwargs: dict[str, Any] = {"key": key, "algorithms": ["RS256"], "options": options}
    if settings.clerk_issuer:
        kwargs["issuer"] = settings.clerk_issuer
    if settings.clerk_jwt_audience:
        kwargs["audience"] = settings.clerk_jwt_audience
    return jwt.decode(token, **kwargs)


def get_clerk_subject(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> str:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Clerk session token")
    try:
        payload = decode_clerk_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Clerk session token") from None
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unable to verify Clerk session token") from exc
    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Clerk subject")
    return str(subject)


def get_current_clerk_user(
    clerk_user_id: str = Depends(get_clerk_subject), db: Session = Depends(get_db)
) -> User:
    user = db.scalar(select(User).where(User.clerk_user_id == clerk_user_id))
    if user is None:
        raise HTTPException(status_code=404, detail="User profile has not been synced")
    return user
