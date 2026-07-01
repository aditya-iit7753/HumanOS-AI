from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer, OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.security_clerk import decode_clerk_token

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)


def create_access_token(user_id: UUID) -> str:
    settings = get_settings()
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_minutes)
    payload = {"sub": str(user_id), "exp": expires}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme), db: Session = Depends(get_db)) -> User:
    settings = get_settings()
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise credentials_error

    token = credentials.credentials

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        subject = payload.get("sub")
        if subject is None:
            raise credentials_error
        user_id = UUID(subject)
        user = db.scalar(select(User).where(User.id == user_id))
        if user is None:
            raise credentials_error
        return user
    except (JWTError, ValueError):
        pass

    try:
        clerk_payload = decode_clerk_token(token)
    except (JWTError, HTTPException):
        raise credentials_error from None

    clerk_user_id = clerk_payload.get("sub")
    if not clerk_user_id:
        raise credentials_error

    user = db.scalar(select(User).where(User.clerk_user_id == str(clerk_user_id)))
    if user is None:
        raise HTTPException(status_code=404, detail="User profile has not been synced")
    return user