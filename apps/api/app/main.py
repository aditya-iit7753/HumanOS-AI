from collections import defaultdict, deque
from datetime import datetime, time, timedelta, timezone
from hashlib import sha256
import secrets
import time as time_module
import json
import logging
from uuid import UUID

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session
try:
    import stripe
except Exception:  # pragma: no cover
    stripe = None

from app import models as db_models
from app import schemas as api_schemas
from app.billing import create_billing_portal_session, create_checkout_session, ensure_agent_access, ensure_career_access, ensure_limit, handle_checkout_completed, subscription_payload, sync_razorpay_subscription, sync_stripe_subscription, usage_payload, verify_razorpay_checkout, verify_razorpay_webhook_signature
from app.ai import build_context, generate_agent_action_plan, generate_answer, generate_career_copilot, generate_daily_schedule, generate_evening_review, generate_goal_roadmap, generate_productivity_result, generate_research_result, generate_study_result, stream_answer, suggest_tasks
from app.config import get_settings
from app.database import Base, SessionLocal, engine, get_db
from app.document_copilot import extract_text, generate_document_copilot, upsert_document_embeddings
from app.memory import auto_save_memories_from_chat, delete_memory_vector, retrieve_relevant_memories, save_memory, upsert_memory_vector
from app.mcp_server import router as mcp_router
from app.models import Agent, AgentStatus, AuditLog, CareerProfile, Conversation, DailyPlan, Document, DocumentStatus, Goal, GoalMilestone, HumanOSApiKey, Memory, Message, Subscription, Task, TaskPriority, TaskStatus, User, UserSettings
from app.schemas import (
    CareerProfileRead,
    CareerProfileUpsert,
    ChatRequest,
    ClerkProfileSync,
    ConversationRead,
    ChatResponse,
    GoalCreate,
    GoalRead,
    GoalUpdate,
    LoginRequest,
    MemoryCreate,
    MemoryRead,
    TaskCreate,
    TaskRead,
    TaskUpdate,
    Token,
    UserCreate,
    UserRead,
)
from app.security import create_access_token, get_current_user, hash_password, verify_password
from app.security_clerk import decode_clerk_token, get_clerk_subject, get_current_clerk_user

settings = get_settings()
logger = logging.getLogger(__name__)
app = FastAPI(title=settings.app_name, version="1.0.0")

_rate_limit_hits: dict[str, deque[float]] = defaultdict(deque)

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(self)",
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-Robots-Tag": "noindex" if settings.app_url.startswith("http://localhost") else "index, follow",
}


def _client_key(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    if request.method != "OPTIONS":
        content_length = request.headers.get("content-length")
        try:
            request_size = int(content_length) if content_length else 0
        except ValueError:
            return JSONResponse(status_code=400, content={"detail": "Invalid content length"})
        if request_size > settings.max_request_bytes:
            return JSONResponse(status_code=413, content={"detail": "Request body too large"})

        now = time_module.monotonic()
        window_start = now - 60
        key = f"{_client_key(request)}:{request.url.path}"
        hits = _rate_limit_hits[key]
        while hits and hits[0] < window_start:
            hits.popleft()
        limit = settings.auth_rate_limit_per_minute if request.url.path.startswith("/auth") else settings.rate_limit_per_minute
        if len(hits) >= limit:
            return JSONResponse(status_code=429, content={"detail": "Too many requests. Please try again shortly."})
        hits.append(now)

    response = await call_next(request)
    for header, value in SECURITY_HEADERS.items():
        response.headers.setdefault(header, value)
    if settings.app_url.startswith("https://"):
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    response.headers.setdefault("Cache-Control", "no-store" if request.url.path.startswith(("/auth", "/billing", "/settings")) else "private, max-age=0")
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mcp_router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled API error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.on_event("startup")
def startup() -> None:
    try:
        try:
            with engine.begin() as connection:
                connection.execute(text("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\""))
        except Exception as exc:
            logger.warning("Optional uuid-ossp extension setup skipped: %s", exc)
        Base.metadata.create_all(bind=engine)
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR(128)"))
            connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_clerk_user_id ON users (clerk_user_id)"))
            connection.execute(text("ALTER TABLE memories ADD COLUMN IF NOT EXISTS vector_id VARCHAR(80)"))
            connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_memories_vector_id ON memories (vector_id)"))
            connection.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS goal_id UUID"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_tasks_goal_id ON tasks (goal_id)"))
            connection.execute(text("ALTER TABLE tasks ALTER COLUMN priority TYPE VARCHAR(16) USING CASE WHEN priority::text IN ('1', 'low') THEN 'low' WHEN priority::text IN ('3', '4', '5', 'high') THEN 'high' ELSE 'medium' END"))
            connection.execute(text("ALTER TABLE tasks ALTER COLUMN priority SET DEFAULT 'medium'"))
            connection.execute(text("DO $$ BEGIN ALTER TABLE tasks ADD CONSTRAINT fk_tasks_goal_id_goals FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;"))
            connection.execute(text("CREATE TABLE IF NOT EXISTS goal_milestones (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE, title VARCHAR(220) NOT NULL, description TEXT NOT NULL DEFAULT '', target_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_goal_milestones_user_id ON goal_milestones (user_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_goal_milestones_goal_id ON goal_milestones (goal_id)"))
            connection.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_text TEXT NOT NULL DEFAULT ''"))
            connection.execute(text("CREATE TABLE IF NOT EXISTS user_settings (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, ai_preferences JSONB NOT NULL DEFAULT '{}'::jsonb, memory_enabled BOOLEAN NOT NULL DEFAULT true, theme VARCHAR(24) NOT NULL DEFAULT 'system', dev_api_keys JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())"))
            connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_user_settings_user_id ON user_settings (user_id)"))
            connection.execute(text("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_customer_id VARCHAR(128)"))
            connection.execute(text("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(128)"))
            connection.execute(text("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_plan_id VARCHAR(128)"))
            connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_subscriptions_razorpay_subscription_id ON subscriptions (razorpay_subscription_id) WHERE razorpay_subscription_id IS NOT NULL"))
            connection.execute(text("CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID REFERENCES users(id) ON DELETE SET NULL, action VARCHAR(120) NOT NULL, resource VARCHAR(120) NOT NULL DEFAULT '', ip_address VARCHAR(80) NOT NULL DEFAULT '', user_agent TEXT NOT NULL DEFAULT '', meta JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now())"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_user_id ON audit_logs (user_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs (action)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs (created_at)"))
            connection.execute(text("CREATE TABLE IF NOT EXISTS humanos_api_keys (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, name VARCHAR(120) NOT NULL DEFAULT 'Default key', key_hash VARCHAR(128) NOT NULL UNIQUE, key_prefix VARCHAR(16) NOT NULL, key_last4 VARCHAR(4) NOT NULL DEFAULT '', scopes JSONB NOT NULL DEFAULT '[]'::jsonb, last_used_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now())"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_humanos_api_keys_user_id ON humanos_api_keys (user_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_humanos_api_keys_key_prefix ON humanos_api_keys (key_prefix)"))
            connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_humanos_api_keys_key_hash ON humanos_api_keys (key_hash)"))
    except Exception as exc:
        logger.exception("Database startup setup failed; healthcheck remains available: %s", exc)

def _hash_api_key(api_key: str) -> str:
    return sha256(api_key.encode("utf-8")).hexdigest()


def _serialize_api_key(api_key: HumanOSApiKey) -> dict:
    return {
        "id": str(api_key.id),
        "name": api_key.name,
        "masked_key": api_key.masked_key,
        "key_prefix": api_key.key_prefix,
        "scopes": api_key.scopes or [],
        "last_used_at": api_key.last_used_at,
        "revoked_at": api_key.revoked_at,
        "created_at": api_key.created_at,
    }


def _issue_humanos_api_key(name: str) -> tuple[str, str, str, str]:
    secret = secrets.token_urlsafe(32).replace("-", "").replace("_", "")[:42]
    api_key = f"hos_live_{secret}"
    return api_key, _hash_api_key(api_key), "hos_live", api_key[-4:]

def _get_or_create_settings(user: User, db: Session) -> UserSettings:
    settings_row = db.scalar(select(UserSettings).where(UserSettings.user_id == user.id))
    if settings_row is None:
        settings_row = UserSettings(
            user_id=user.id,
            ai_preferences={"model": "gpt-4.1-mini", "tone": "practical", "response_style": "concise"},
            memory_enabled=True,
            theme="system",
            dev_api_keys={},
        )
        db.add(settings_row)
        db.flush()
    return settings_row


def _mask_keys(keys: dict | None) -> dict[str, str]:
    masked = {}
    for key, value in (keys or {}).items():
        value_str = str(value or "")
        if not value_str:
            masked[str(key)] = ""
        elif len(value_str) > 8:
            masked[str(key)] = f"{value_str[:4]}...{value_str[-4:]}"
        else:
            masked[str(key)] = "configured"
    return masked


def _memory_enabled(user: User, db: Session) -> bool:
    return _get_or_create_settings(user, db).memory_enabled


def _write_audit_log(db: Session, user: User | None, action: str, resource: str = "", request: Request | None = None, meta: dict | None = None) -> None:
    log = AuditLog(
        user_id=user.id if user else None,
        action=action[:120],
        resource=resource[:120],
        ip_address=_client_key(request)[:80] if request else "",
        user_agent=(request.headers.get("user-agent", "")[:1000] if request else ""),
        meta=meta or {},
    )
    db.add(log)


def _serialize_audit_log(log: AuditLog) -> dict:
    return {
        "id": str(log.id),
        "user_id": str(log.user_id) if log.user_id else None,
        "action": log.action,
        "resource": log.resource,
        "meta": log.meta or {},
        "created_at": log.created_at,
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "humanos-api"}


@app.post("/auth/register", response_model=Token)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> Token:
    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return Token(access_token=create_access_token(user.id))


@app.post("/auth/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> Token:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return Token(access_token=create_access_token(user.id))


@app.get("/auth/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@app.get("/billing/subscription", response_model=api_schemas.SubscriptionRead)
def get_subscription(user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return subscription_payload(db, user)


@app.get("/billing/usage", response_model=api_schemas.UsageRead)
def get_usage(user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return usage_payload(db, user)


@app.post("/analytics/events")
def track_event(payload: dict, request: Request, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)) -> dict:
    action = str(payload.get("action") or "event")
    resource = str(payload.get("resource") or "app")
    meta = payload.get("meta") if isinstance(payload.get("meta"), dict) else {"payload": payload}
    _write_audit_log(db, user, action, resource, request, meta)
    db.commit()
    return {"ok": True}


@app.get("/activity")
def user_activity(user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)) -> dict:
    logs = db.scalars(select(AuditLog).where(AuditLog.user_id == user.id).order_by(AuditLog.created_at.desc()).limit(30)).all()
    return {"activity": [_serialize_audit_log(log) for log in logs]}


def _require_admin(user: User) -> None:
    admin_emails = set(settings.admin_email_list)
    if user.role in {"admin", "owner"} or user.email.lower() in admin_emails:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


def _count(db: Session, model, *conditions) -> int:
    query = select(func.count(model.id))
    if conditions:
        query = query.where(*conditions)
    return int(db.scalar(query) or 0)


@app.get("/admin/analytics")
def admin_analytics(user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)) -> dict:
    _require_admin(user)
    now = datetime.now(timezone.utc)
    last_7_days = now - timedelta(days=7)
    last_30_days = now - timedelta(days=30)
    active_statuses = {"active", "trialing"}
    plan_prices_inr = {"starter": 149, "pro": 199, "premium": 249, "enterprise": 0}

    subscription_rows = db.execute(select(Subscription.plan, Subscription.status, func.count(Subscription.id)).group_by(Subscription.plan, Subscription.status)).all()
    subscriptions = [
        {"plan": plan or "free", "status": status_value or "inactive", "count": int(count or 0)}
        for plan, status_value, count in subscription_rows
    ]
    active_paid_by_plan: dict[str, int] = defaultdict(int)
    for plan, status_value, count in subscription_rows:
        if status_value in active_statuses and plan in plan_prices_inr:
            active_paid_by_plan[str(plan)] += int(count or 0)

    total_mrr_inr = sum(plan_prices_inr.get(plan, 0) * count for plan, count in active_paid_by_plan.items())
    recent_users = db.scalars(select(User).order_by(User.created_at.desc()).limit(8)).all()
    recent_activity = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(12)).all()
    average_plan_score = db.scalar(select(func.avg(DailyPlan.score))) or 0

    return {
        "generated_at": now,
        "overview": {
            "total_users": _count(db, User),
            "new_users_7d": _count(db, User, User.created_at >= last_7_days),
            "new_users_30d": _count(db, User, User.created_at >= last_30_days),
            "active_paid_subscriptions": sum(active_paid_by_plan.values()),
            "estimated_mrr_inr": total_mrr_inr,
        },
        "usage": {
            "conversations": _count(db, Conversation),
            "messages": _count(db, Message),
            "memories": _count(db, Memory),
            "tasks": _count(db, Task),
            "open_tasks": _count(db, Task, Task.status != TaskStatus.done),
            "goals": _count(db, Goal),
            "documents": _count(db, Document),
            "agents": _count(db, Agent),
            "daily_plans": _count(db, DailyPlan),
        },
        "engagement": {
            "messages_7d": _count(db, Message, Message.created_at >= last_7_days),
            "tasks_created_7d": _count(db, Task, Task.created_at >= last_7_days),
            "documents_uploaded_30d": _count(db, Document, Document.created_at >= last_30_days),
            "average_planner_score": round(float(average_plan_score), 1),
        },
        "subscriptions": subscriptions,
        "recent_activity": [_serialize_audit_log(log) for log in recent_activity],
        "recent_users": [
            {
                "id": str(recent_user.id),
                "email": recent_user.email,
                "full_name": recent_user.full_name,
                "role": recent_user.role,
                "created_at": recent_user.created_at,
            }
            for recent_user in recent_users
        ],
    }

@app.post("/billing/checkout", response_model=api_schemas.BillingCheckoutResponse)
def billing_checkout(payload: api_schemas.BillingCheckoutRequest, request: Request, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    result = create_checkout_session(db, user, payload.plan)
    _write_audit_log(db, user, "billing.checkout_started", "billing", request, {"plan": payload.plan, "provider": result.get("provider")})
    db.commit()
    return result


@app.post("/billing/razorpay/verify", response_model=api_schemas.SubscriptionRead)
def verify_razorpay_payment(payload: api_schemas.RazorpayVerifyRequest, db: Session = Depends(get_db)):
    return verify_razorpay_checkout(db, payload.model_dump())


@app.post("/billing/portal", response_model=api_schemas.BillingPortalResponse)
def billing_portal(user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return {"url": create_billing_portal_session(db, user)}


@app.post("/billing/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    if settings.stripe_webhook_secret:
        if stripe is None:
            raise HTTPException(status_code=500, detail="Stripe is not configured")
        try:
            event = stripe.Webhook.construct_event(payload, signature, settings.stripe_webhook_secret)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid Stripe webhook") from exc
    else:
        try:
            event = await request.json()
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid webhook payload") from exc

    event_type = event.get("type")
    data = (event.get("data") or {}).get("object") or {}
    if event_type == "checkout.session.completed":
        handle_checkout_completed(db, data)
    elif event_type in {"customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"}:
        sync_stripe_subscription(db, data)
    return {"received": True}


@app.post("/billing/razorpay/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    signature = request.headers.get("x-razorpay-signature")
    verify_razorpay_webhook_signature(payload, signature)
    try:
        event = json.loads(payload.decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid Razorpay webhook payload") from exc
    sync_razorpay_subscription(db, event)
    return {"received": True}

@app.post("/auth/clerk/sync", response_model=UserRead)
def sync_clerk_profile(
    payload: ClerkProfileSync,
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Clerk session token")

    try:
        token_payload = decode_clerk_token(token)
        clerk_user_id = str(token_payload.get("sub") or "")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Clerk token verification failed during profile sync")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unable to verify Clerk session token") from exc

    if not clerk_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Clerk subject")
    if payload.clerk_user_id != clerk_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Clerk user mismatch")

    try:
        email = payload.email.lower()
        user = db.scalar(select(User).where(User.clerk_user_id == clerk_user_id))
        if user is None:
            user = db.scalar(select(User).where(User.email == email))

        if user is None:
            user = User(
                clerk_user_id=clerk_user_id,
                email=email,
                full_name=payload.full_name,
                hashed_password="clerk_managed",
            )
            db.add(user)
        else:
            user.clerk_user_id = clerk_user_id
            user.email = email
            user.full_name = payload.full_name

        db.commit()
        db.refresh(user)
        _write_audit_log(db, user, "auth.profile_sync", "user", request, {"email": user.email})
        db.commit()
        return user
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Clerk profile sync failed")
        raise HTTPException(status_code=503, detail="Unable to sync user profile") from exc


@app.get("/api-keys", response_model=list[api_schemas.ApiKeyRead])
def list_api_keys(user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    keys = db.scalars(select(HumanOSApiKey).where(HumanOSApiKey.user_id == user.id).order_by(HumanOSApiKey.created_at.desc())).all()
    return [_serialize_api_key(api_key) for api_key in keys]


@app.post("/api-keys", response_model=api_schemas.ApiKeyCreateResponse)
def create_api_key(payload: api_schemas.ApiKeyCreateRequest, request: Request, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    active_count = int(db.scalar(select(func.count(HumanOSApiKey.id)).where(HumanOSApiKey.user_id == user.id, HumanOSApiKey.revoked_at.is_(None))) or 0)
    if active_count >= 5:
        raise HTTPException(status_code=400, detail="You can keep up to 5 active API keys. Revoke an old key first.")
    raw_key, key_hash, key_prefix, key_last4 = _issue_humanos_api_key(payload.name)
    api_key = HumanOSApiKey(user_id=user.id, name=payload.name.strip() or "Default key", key_hash=key_hash, key_prefix=key_prefix, key_last4=key_last4, scopes=["mcp:tools"])
    db.add(api_key)
    db.flush()
    _write_audit_log(db, user, "api_key.created", "api_keys", request, {"name": api_key.name, "key_prefix": api_key.key_prefix})
    db.commit()
    db.refresh(api_key)
    return {"api_key": raw_key, "key": _serialize_api_key(api_key)}


@app.delete("/api-keys/{api_key_id}")
def revoke_api_key(api_key_id: UUID, request: Request, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    api_key = db.scalar(select(HumanOSApiKey).where(HumanOSApiKey.id == api_key_id, HumanOSApiKey.user_id == user.id))
    if api_key is None:
        raise HTTPException(status_code=404, detail="API key not found")
    if api_key.revoked_at is None:
        api_key.revoked_at = datetime.now(timezone.utc)
        _write_audit_log(db, user, "api_key.revoked", "api_keys", request, {"name": api_key.name})
    db.commit()
    return {"revoked": True}


@app.get("/settings", response_model=api_schemas.UserSettingsRead)
def get_user_settings(user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    settings_row = _get_or_create_settings(user, db)
    db.commit()
    db.refresh(settings_row)
    return {
        "user": api_schemas.UserRead.model_validate(user),
        "ai_preferences": settings_row.ai_preferences or {},
        "memory_enabled": settings_row.memory_enabled,
        "theme": settings_row.theme,
        "dev_api_keys": _mask_keys(settings_row.dev_api_keys),
        "updated_at": settings_row.updated_at,
    }


@app.put("/settings", response_model=api_schemas.UserSettingsRead)
def update_user_settings(payload: api_schemas.UserSettingsUpdate, request: Request, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    settings_row = _get_or_create_settings(user, db)
    values = payload.model_dump(exclude_unset=True)
    if values.get("full_name") is not None:
        user.full_name = values["full_name"]
    if values.get("ai_preferences") is not None:
        settings_row.ai_preferences = values["ai_preferences"]
    if values.get("memory_enabled") is not None:
        settings_row.memory_enabled = values["memory_enabled"]
    if values.get("theme") is not None:
        settings_row.theme = values["theme"]
    if values.get("dev_api_keys") is not None:
        existing = settings_row.dev_api_keys or {}
        updated = {**existing}
        for key, value in values["dev_api_keys"].items():
            if value:
                updated[key] = value
        settings_row.dev_api_keys = updated
    _write_audit_log(db, user, "settings.updated", "settings", request, {"fields": sorted(values.keys())})
    db.commit()
    db.refresh(user)
    db.refresh(settings_row)
    return {
        "user": api_schemas.UserRead.model_validate(user),
        "ai_preferences": settings_row.ai_preferences or {},
        "memory_enabled": settings_row.memory_enabled,
        "theme": settings_row.theme,
        "dev_api_keys": _mask_keys(settings_row.dev_api_keys),
        "updated_at": settings_row.updated_at,
    }


@app.get("/settings/export")
def export_user_data(request: Request, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    settings_row = _get_or_create_settings(user, db)
    export = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user": api_schemas.UserRead.model_validate(user).model_dump(mode="json"),
        "settings": {
            "ai_preferences": settings_row.ai_preferences or {},
            "memory_enabled": settings_row.memory_enabled,
            "theme": settings_row.theme,
            "dev_api_keys": _mask_keys(settings_row.dev_api_keys),
        },
        "conversations": [api_schemas.ConversationRead.model_validate(item).model_dump(mode="json") for item in db.scalars(select(Conversation).where(Conversation.user_id == user.id))],
        "messages": [api_schemas.MessageRead.model_validate(item).model_dump(mode="json") for item in db.scalars(select(Message).join(Conversation).where(Conversation.user_id == user.id))],
        "memories": [api_schemas.MemoryRead.model_validate(item).model_dump(mode="json") for item in db.scalars(select(Memory).where(Memory.user_id == user.id))],
        "tasks": [api_schemas.TaskRead.model_validate(item).model_dump(mode="json") for item in db.scalars(select(Task).where(Task.user_id == user.id))],
        "goals": [api_schemas.GoalRead.model_validate(item).model_dump(mode="json") for item in db.scalars(select(Goal).where(Goal.user_id == user.id))],
        "documents": [api_schemas.DocumentRead.model_validate(item).model_dump(mode="json") for item in db.scalars(select(Document).where(Document.user_id == user.id))],
        "agents": [api_schemas.AgentRead.model_validate(item).model_dump(mode="json") for item in db.scalars(select(Agent).where(Agent.user_id == user.id))],
        "daily_plans": [api_schemas.DailyPlanRead.model_validate(item).model_dump(mode="json") for item in db.scalars(select(DailyPlan).where(DailyPlan.user_id == user.id))],
    }
    _write_audit_log(db, user, "data.exported", "settings", request)
    db.commit()
    return JSONResponse(content=export, headers={"Content-Disposition": "attachment; filename=humanos-export.json"})


@app.delete("/settings/account")
def delete_local_account(payload: api_schemas.DeleteAccountRequest, request: Request, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    if payload.confirmation != "DELETE":
        raise HTTPException(status_code=400, detail="Type DELETE to confirm account deletion")
    _write_audit_log(db, user, "account.deleted", "settings", request)
    db.flush()
    db.delete(user)
    db.commit()
    return {"deleted": True}


@app.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ChatResponse:
    ensure_limit(db, user, "chat_messages")
    conversation = None
    if payload.conversation_id:
        conversation = db.scalar(
            select(Conversation).where(Conversation.id == payload.conversation_id, Conversation.user_id == user.id)
        )
    if conversation is None:
        conversation = Conversation(user_id=user.id, title=payload.message[:80])
        db.add(conversation)
        db.flush()

    user_message = Message(conversation_id=conversation.id, role="user", content=payload.message)
    db.add(user_message)

    memories = retrieve_relevant_memories(db, user, payload.message, limit=12) if _memory_enabled(user, db) else []
    tasks = list(db.scalars(select(Task).where(Task.user_id == user.id, Task.status != TaskStatus.done).limit(12)))
    goals = list(db.scalars(select(Goal).where(Goal.user_id == user.id).limit(12)))
    answer = generate_answer(payload.message, build_context(memories, tasks, goals))

    assistant_message = Message(conversation_id=conversation.id, role="assistant", content=answer)
    db.add(assistant_message)

    if _memory_enabled(user, db):
        auto_save_memories_from_chat(db, user, payload.message)

    db.commit()
    messages = list(
        db.scalars(select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at.asc()))
    )
    return ChatResponse(conversation_id=conversation.id, answer=answer, messages=messages)



@app.get("/chat/conversations", response_model=list[ConversationRead])
def list_chat_conversations(
    user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)
) -> list[Conversation]:
    return list(
        db.scalars(
            select(Conversation)
            .where(Conversation.user_id == user.id)
            .order_by(Conversation.created_at.desc())
        )
    )


@app.get("/chat/conversations/{conversation_id}/messages", response_model=list[api_schemas.MessageRead])
def list_chat_messages(
    conversation_id: UUID,
    user: User = Depends(get_current_clerk_user),
    db: Session = Depends(get_db),
) -> list[Message]:
    conversation = db.scalar(
        select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == user.id)
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return list(
        db.scalars(select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at.asc()))
    )


@app.post("/chat/stream")
def stream_chat(
    payload: ChatRequest,
    user: User = Depends(get_current_clerk_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    ensure_limit(db, user, "chat_messages")
    conversation = None
    if payload.conversation_id:
        conversation = db.scalar(
            select(Conversation).where(Conversation.id == payload.conversation_id, Conversation.user_id == user.id)
        )
        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation is None:
        conversation = Conversation(user_id=user.id, title=payload.message[:80])
        db.add(conversation)
        db.flush()

    user_message = Message(conversation_id=conversation.id, role="user", content=payload.message)
    db.add(user_message)

    memories = retrieve_relevant_memories(db, user, payload.message, limit=12) if _memory_enabled(user, db) else []
    tasks = list(db.scalars(select(Task).where(Task.user_id == user.id, Task.status != TaskStatus.done).limit(12)))
    goals = list(db.scalars(select(Goal).where(Goal.user_id == user.id).limit(12)))
    context = build_context(memories, tasks, goals)

    auto_save_memories_from_chat(db, user, payload.message)

    conversation_id = conversation.id
    db.commit()

    def token_generator():
        content_parts: list[str] = []
        try:
            for token in stream_answer(payload.message, context):
                content_parts.append(token)
                yield token
        finally:
            assistant_content = "".join(content_parts).strip()
            if assistant_content:
                with SessionLocal() as write_db:
                    write_db.add(Message(conversation_id=conversation_id, role="assistant", content=assistant_content))
                    write_db.commit()

    return StreamingResponse(
        token_generator(),
        media_type="text/plain; charset=utf-8",
        headers={"X-Conversation-Id": str(conversation_id)},
    )

@app.get("/memories", response_model=list[MemoryRead])
def list_memories(user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)) -> list[Memory]:
    return list(
        db.scalars(
            select(Memory)
            .where(Memory.user_id == user.id)
            .order_by(Memory.importance.desc(), Memory.updated_at.desc())
        )
    )


@app.post("/memories", response_model=MemoryRead)
def create_memory(payload: MemoryCreate, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)) -> Memory:
    ensure_limit(db, user, "memories")
    memory = save_memory(
        db=db,
        user=user,
        content=payload.content,
        memory_type=payload.category.value,
        importance=payload.importance,
        source=payload.source,
        meta=payload.meta,
    )
    db.commit()
    db.refresh(memory)
    return memory



@app.get("/tasks", response_model=list[TaskRead])
def list_tasks(user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)) -> list[Task]:
    return list(
        db.scalars(
            select(Task)
            .where(Task.user_id == user.id)
            .order_by(Task.status.asc(), Task.due_at.asc().nulls_last(), Task.created_at.desc())
        )
    )


def _validate_goal_link(goal_id: UUID | None, user: User, db: Session) -> None:
    if goal_id is None:
        return
    goal = db.scalar(select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id))
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")


@app.post("/tasks", response_model=TaskRead)
def create_task(payload: TaskCreate, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)) -> Task:
    _validate_goal_link(payload.goal_id, user, db)
    task = Task(user_id=user.id, **payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.patch("/tasks/{task_id}", response_model=TaskRead)
def update_task(task_id: UUID, payload: TaskUpdate, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)) -> Task:
    task = db.scalar(select(Task).where(Task.id == task_id, Task.user_id == user.id))
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    values = payload.model_dump(exclude_unset=True)
    if "goal_id" in values:
        _validate_goal_link(values["goal_id"], user, db)
    for key, value in values.items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)
    return task


@app.post("/tasks/{task_id}/complete", response_model=TaskRead)
def complete_task(task_id: UUID, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)) -> Task:
    task = db.scalar(select(Task).where(Task.id == task_id, Task.user_id == user.id))
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = TaskStatus.done
    db.commit()
    db.refresh(task)
    return task


@app.get("/tasks/suggestions", response_model=api_schemas.TaskSuggestionsResponse)
def task_suggestions(focus: str = "", user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)) -> dict:
    goals = list(db.scalars(select(Goal).where(Goal.user_id == user.id, Goal.status == db_models.GoalStatus.active).limit(8)))
    existing_tasks = list(db.scalars(select(Task).where(Task.user_id == user.id, Task.status != TaskStatus.done).limit(12)))
    raw_suggestions = suggest_tasks(goals, existing_tasks, focus)
    goals_by_title = {goal.title: goal.id for goal in goals}
    suggestions = []
    for item in raw_suggestions:
        title = str(item.get("title", "")).strip()
        if not title:
            continue
        priority = item.get("priority", "medium")
        if priority not in {"low", "medium", "high"}:
            priority = "medium"
        goal_title = item.get("goal_title")
        suggestions.append(
            {
                "title": title[:220],
                "notes": str(item.get("notes", ""))[:1000],
                "priority": priority,
                "goal_id": goals_by_title.get(goal_title),
                "goal_title": goal_title if goal_title in goals_by_title else None,
            }
        )
    return {"suggestions": suggestions[:5]}


@app.get("/goals", response_model=list[GoalRead])
def list_goals(user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)) -> list[Goal]:
    return list(db.scalars(select(Goal).where(Goal.user_id == user.id).order_by(Goal.created_at.desc())))


@app.post("/goals", response_model=GoalRead)
def create_goal(payload: GoalCreate, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)) -> Goal:
    goal = Goal(user_id=user.id, **payload.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@app.patch("/goals/{goal_id}", response_model=GoalRead)
def update_goal(goal_id: UUID, payload: GoalUpdate, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)) -> Goal:
    goal = db.scalar(select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id))
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(goal, key, value)
    db.commit()
    db.refresh(goal)
    return goal




def _recalculate_goal_progress(goal: Goal, db: Session) -> None:
    milestones = list(db.scalars(select(GoalMilestone).where(GoalMilestone.goal_id == goal.id)))
    if milestones:
        complete = len([milestone for milestone in milestones if milestone.completed_at is not None])
        goal.progress = round((complete / len(milestones)) * 100)
    if goal.progress >= 100:
        goal.status = db_models.GoalStatus.complete


@app.post("/goals/roadmap", response_model=api_schemas.GoalRoadmapResponse)
def create_goal_roadmap(
    payload: api_schemas.GoalRoadmapRequest,
    user: User = Depends(get_current_clerk_user),
    db: Session = Depends(get_db),
):
    goal = Goal(
        user_id=user.id,
        title=payload.title,
        why=payload.target_outcome or f"Roadmap target: {payload.title}",
        metric=f"Complete roadmap in {payload.timeframe}",
        target_at=datetime.utcnow() + timedelta(days=180),
    )
    db.add(goal)
    db.flush()
    raw_milestones = generate_goal_roadmap(payload.title, payload.timeframe, payload.current_level, payload.target_outcome)
    milestones = []
    for index, item in enumerate(raw_milestones):
        try:
            offset_weeks = int(item.get("offset_weeks", (index + 1) * 4))
        except (TypeError, ValueError):
            offset_weeks = (index + 1) * 4
        milestone = GoalMilestone(
            user_id=user.id,
            goal_id=goal.id,
            title=str(item.get("title", f"Milestone {index + 1}"))[:220],
            description=str(item.get("description", ""))[:1200],
            target_at=datetime.utcnow() + timedelta(weeks=offset_weeks),
            sort_order=index,
        )
        db.add(milestone)
        milestones.append(milestone)
    db.commit()
    db.refresh(goal)
    for milestone in milestones:
        db.refresh(milestone)
    return {"goal": goal, "milestones": milestones}


@app.get("/goals/{goal_id}/milestones", response_model=list[api_schemas.GoalMilestoneRead])
def list_goal_milestones(goal_id: UUID, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    _get_owned(db_models.Goal, goal_id, user, db)
    return list(db.scalars(select(GoalMilestone).where(GoalMilestone.goal_id == goal_id).order_by(GoalMilestone.sort_order.asc(), GoalMilestone.target_at.asc())))


@app.post("/goals/{goal_id}/milestones", response_model=api_schemas.GoalMilestoneRead)
def create_goal_milestone(goal_id: UUID, payload: api_schemas.GoalMilestoneCreate, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    goal = _get_owned(db_models.Goal, goal_id, user, db)
    milestone = GoalMilestone(user_id=user.id, goal_id=goal.id, **payload.model_dump())
    db.add(milestone)
    _recalculate_goal_progress(goal, db)
    db.commit()
    db.refresh(milestone)
    return milestone


@app.patch("/goals/{goal_id}/milestones/{milestone_id}", response_model=api_schemas.GoalMilestoneRead)
def update_goal_milestone(goal_id: UUID, milestone_id: UUID, payload: api_schemas.GoalMilestoneUpdate, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    goal = _get_owned(db_models.Goal, goal_id, user, db)
    milestone = db.scalar(select(GoalMilestone).where(GoalMilestone.id == milestone_id, GoalMilestone.goal_id == goal.id, GoalMilestone.user_id == user.id))
    if milestone is None:
        raise HTTPException(status_code=404, detail="Milestone not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(milestone, key, value)
    _recalculate_goal_progress(goal, db)
    db.commit()
    db.refresh(milestone)
    return milestone


@app.post("/goals/{goal_id}/milestones/{milestone_id}/complete", response_model=api_schemas.GoalMilestoneRead)
def complete_goal_milestone(goal_id: UUID, milestone_id: UUID, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    goal = _get_owned(db_models.Goal, goal_id, user, db)
    milestone = db.scalar(select(GoalMilestone).where(GoalMilestone.id == milestone_id, GoalMilestone.goal_id == goal.id, GoalMilestone.user_id == user.id))
    if milestone is None:
        raise HTTPException(status_code=404, detail="Milestone not found")
    milestone.completed_at = datetime.utcnow()
    _recalculate_goal_progress(goal, db)
    db.commit()
    db.refresh(milestone)
    return milestone


@app.delete("/goals/{goal_id}/milestones/{milestone_id}")
def delete_goal_milestone(goal_id: UUID, milestone_id: UUID, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    goal = _get_owned(db_models.Goal, goal_id, user, db)
    milestone = db.scalar(select(GoalMilestone).where(GoalMilestone.id == milestone_id, GoalMilestone.goal_id == goal.id, GoalMilestone.user_id == user.id))
    if milestone is None:
        raise HTTPException(status_code=404, detail="Milestone not found")
    db.delete(milestone)
    _recalculate_goal_progress(goal, db)
    db.commit()
    return {"status": "deleted"}


@app.post("/goals/{goal_id}/milestones/{milestone_id}/task", response_model=api_schemas.MilestoneTaskResponse)
def convert_milestone_to_task(goal_id: UUID, milestone_id: UUID, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    goal = _get_owned(db_models.Goal, goal_id, user, db)
    milestone = db.scalar(select(GoalMilestone).where(GoalMilestone.id == milestone_id, GoalMilestone.goal_id == goal.id, GoalMilestone.user_id == user.id))
    if milestone is None:
        raise HTTPException(status_code=404, detail="Milestone not found")
    task = Task(user_id=user.id, goal_id=goal.id, title=milestone.title, notes=milestone.description, priority=TaskPriority.medium.value, due_at=milestone.target_at)
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"task": task}
@app.get("/career", response_model=CareerProfileRead | None)
def get_career(user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)) -> CareerProfile | None:
    return db.scalar(select(CareerProfile).where(CareerProfile.user_id == user.id))


@app.put("/career", response_model=CareerProfileRead)
def upsert_career(
    payload: CareerProfileUpsert, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)
) -> CareerProfile:
    profile = db.scalar(select(CareerProfile).where(CareerProfile.user_id == user.id))
    if profile is None:
        profile = CareerProfile(user_id=user.id)
        db.add(profile)
    for key, value in payload.model_dump().items():
        setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile




@app.post("/career/copilot", response_model=api_schemas.CareerCopilotResponse)
def career_copilot(payload: api_schemas.CareerCopilotRequest, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    ensure_career_access(db, user)
    profile = db.scalar(select(CareerProfile).where(CareerProfile.user_id == user.id))
    goals = list(db.scalars(select(Goal).where(Goal.user_id == user.id).order_by(Goal.created_at.desc()).limit(8)))
    memories = list(db.scalars(select(Memory).where(Memory.user_id == user.id).order_by(Memory.importance.desc()).limit(12)))
    resume = db.scalar(select(db_models.ResumeVersion).where(db_models.ResumeVersion.user_id == user.id, db_models.ResumeVersion.is_active == True).order_by(db_models.ResumeVersion.updated_at.desc()))
    context = {
        "target_role": payload.target_role,
        "resume_text": payload.resume_text or (resume.content if resume else ""),
        "resume_data": payload.resume_data,
        "job_description": payload.job_description,
        "profile": CareerProfileRead.model_validate(profile).model_dump() if profile else {},
        "goals": [GoalRead.model_validate(goal).model_dump(mode="json") for goal in goals],
        "memories": [MemoryRead.model_validate(memory).model_dump(mode="json") for memory in memories],
    }
    result = generate_career_copilot(payload.tool, context)
    if payload.tool == "resume_builder" and result.get("content"):
        resume_version = db_models.ResumeVersion(
            user_id=user.id,
            title=f"{payload.target_role} resume",
            target_role=payload.target_role,
            content=result["content"],
            version=1,
            is_active=True,
            meta={"source": "career_copilot"},
        )
        db.add(resume_version)
        db.commit()
    return result
@app.get("/dashboard")
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    tasks = list(db.scalars(select(Task).where(Task.user_id == user.id)))
    goals = list(db.scalars(select(Goal).where(Goal.user_id == user.id)))
    memories = list(db.scalars(select(Memory).where(Memory.user_id == user.id).order_by(Memory.created_at.desc()).limit(5)))
    career = db.scalar(select(CareerProfile).where(CareerProfile.user_id == user.id))
    return {
        "user": UserRead.model_validate(user),
        "focus": {
            "open_tasks": len([task for task in tasks if task.status != TaskStatus.done]),
            "completed_tasks": len([task for task in tasks if task.status == TaskStatus.done]),
            "active_goals": len([goal for goal in goals if goal.status.value == "active"]),
            "average_goal_progress": round(sum(goal.progress for goal in goals) / max(len(goals), 1)),
        },
        "recent_memories": [MemoryRead.model_validate(memory) for memory in memories],
        "career": CareerProfileRead.model_validate(career) if career else None,
        "billing": subscription_payload(db, user),
        "usage": usage_payload(db, user),
    }





# Generic CRUD helpers for user-owned resources.
def _get_owned(model, resource_id: UUID, user: User, db: Session):
    resource = db.scalar(select(model).where(model.id == resource_id, model.user_id == user.id))
    if resource is None:
        raise HTTPException(status_code=404, detail=f"{model.__name__} not found")
    return resource


def _list_owned(model, user: User, db: Session):
    return list(db.scalars(select(model).where(model.user_id == user.id).order_by(model.created_at.desc())))


def _create_owned(model, payload, user: User, db: Session):
    resource = model(user_id=user.id, **payload.model_dump())
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


def _update_owned(model, resource_id: UUID, payload, user: User, db: Session):
    resource = _get_owned(model, resource_id, user, db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(resource, key, value)
    db.commit()
    db.refresh(resource)
    return resource


def _delete_owned(model, resource_id: UUID, user: User, db: Session) -> dict[str, str]:
    resource = _get_owned(model, resource_id, user, db)
    db.delete(resource)
    db.commit()
    return {"status": "deleted"}


@app.get("/users/me", response_model=api_schemas.UserRead)
def read_current_profile(user: User = Depends(get_current_user)) -> User:
    return user


@app.patch("/users/me", response_model=api_schemas.UserRead)
def update_current_profile(
    payload: api_schemas.UserUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


@app.get("/conversations", response_model=list[api_schemas.ConversationRead])
def list_conversations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _list_owned(db_models.Conversation, user, db)


@app.post("/conversations", response_model=api_schemas.ConversationRead)
def create_conversation(payload: api_schemas.ConversationCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _create_owned(db_models.Conversation, payload, user, db)


@app.get("/conversations/{conversation_id}", response_model=api_schemas.ConversationRead)
def get_conversation(conversation_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _get_owned(db_models.Conversation, conversation_id, user, db)


@app.patch("/conversations/{conversation_id}", response_model=api_schemas.ConversationRead)
def update_conversation(conversation_id: UUID, payload: api_schemas.ConversationUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _update_owned(db_models.Conversation, conversation_id, payload, user, db)


@app.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _delete_owned(db_models.Conversation, conversation_id, user, db)


@app.get("/messages", response_model=list[api_schemas.MessageRead])
def list_messages(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return list(
        db.scalars(
            select(db_models.Message)
            .join(db_models.Conversation)
            .where(db_models.Conversation.user_id == user.id)
            .order_by(db_models.Message.created_at.desc())
        )
    )


@app.post("/messages", response_model=api_schemas.MessageRead)
def create_message(payload: api_schemas.MessageCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = _get_owned(db_models.Conversation, payload.conversation_id, user, db)
    message = db_models.Message(conversation_id=conversation.id, role=payload.role, content=payload.content, meta=payload.meta)
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


@app.get("/messages/{message_id}", response_model=api_schemas.MessageRead)
def get_message(message_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    message = db.scalar(
        select(db_models.Message)
        .join(db_models.Conversation)
        .where(db_models.Message.id == message_id, db_models.Conversation.user_id == user.id)
    )
    if message is None:
        raise HTTPException(status_code=404, detail="Message not found")
    return message


@app.patch("/messages/{message_id}", response_model=api_schemas.MessageRead)
def update_message(message_id: UUID, payload: api_schemas.MessageUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    message = get_message(message_id, user, db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(message, key, value)
    db.commit()
    db.refresh(message)
    return message


@app.delete("/messages/{message_id}")
def delete_message(message_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    message = get_message(message_id, user, db)
    db.delete(message)
    db.commit()
    return {"status": "deleted"}


@app.get("/memories/{memory_id}", response_model=api_schemas.MemoryRead)
def get_memory(memory_id: UUID, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _get_owned(db_models.Memory, memory_id, user, db)


@app.patch("/memories/{memory_id}", response_model=api_schemas.MemoryRead)
def update_memory(memory_id: UUID, payload: api_schemas.MemoryUpdate, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    memory = _get_owned(db_models.Memory, memory_id, user, db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        if key == "category" and hasattr(value, "value"):
            value = value.value
        setattr(memory, key, value)
    upsert_memory_vector(memory)
    db.commit()
    db.refresh(memory)
    return memory


@app.delete("/memories/{memory_id}")
def delete_memory(memory_id: UUID, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    memory = _get_owned(db_models.Memory, memory_id, user, db)
    delete_memory_vector(memory)
    db.delete(memory)
    db.commit()
    return {"status": "deleted"}


@app.get("/tasks/{task_id}", response_model=api_schemas.TaskRead)
def get_task(task_id: UUID, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _get_owned(db_models.Task, task_id, user, db)


@app.delete("/tasks/{task_id}")
def delete_task(task_id: UUID, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _delete_owned(db_models.Task, task_id, user, db)


@app.get("/goals/{goal_id}", response_model=api_schemas.GoalRead)
def get_goal(goal_id: UUID, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _get_owned(db_models.Goal, goal_id, user, db)


@app.delete("/goals/{goal_id}")
def delete_goal(goal_id: UUID, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _delete_owned(db_models.Goal, goal_id, user, db)


@app.get("/documents", response_model=list[api_schemas.DocumentRead])
def list_documents(user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return list(
        db.scalars(
            select(Document)
            .where(Document.user_id == user.id)
            .order_by(Document.updated_at.desc(), Document.created_at.desc())
        )
    )


@app.post("/documents", response_model=api_schemas.DocumentRead)
def create_document(payload: api_schemas.DocumentCreate, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _create_owned(db_models.Document, payload, user, db)


@app.post("/documents/upload", response_model=api_schemas.DocumentRead)
async def upload_document(
    file: UploadFile = File(...),
    user: User = Depends(get_current_clerk_user),
    db: Session = Depends(get_db),
) -> Document:
    ensure_limit(db, user, "documents")
    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Document must be 15MB or smaller")
    try:
        extracted, meta = extract_text(file.filename or "document.txt", file.content_type or "", data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unable to extract text from document") from exc

    if not extracted:
        raise HTTPException(status_code=400, detail="No readable text was found in this document")

    title = (file.filename or "Untitled document").rsplit(".", 1)[0][:220]
    document = Document(
        user_id=user.id,
        title=title,
        file_name=file.filename or "",
        mime_type=file.content_type or "",
        storage_url="local-upload",
        status=DocumentStatus.ready,
        extracted_text=extracted[:250000],
        summary="",
        meta={**meta, "text_length": len(extracted), "chunk_count": 0, "vector_ids": []},
    )
    db.add(document)
    db.flush()
    vector_ids = upsert_document_embeddings(document)
    chunks = len(vector_ids)
    document.meta = {**(document.meta or {}), "chunk_count": chunks, "vector_ids": vector_ids[:200]}
    summary = generate_document_copilot(document, "summary")
    document.summary = summary.get("answer", "")[:5000]
    db.commit()
    db.refresh(document)
    return document


@app.get("/documents/{document_id}", response_model=api_schemas.DocumentRead)
def get_document(document_id: UUID, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _get_owned(db_models.Document, document_id, user, db)


@app.patch("/documents/{document_id}", response_model=api_schemas.DocumentRead)
def update_document(document_id: UUID, payload: api_schemas.DocumentUpdate, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _update_owned(db_models.Document, document_id, payload, user, db)


@app.post("/documents/{document_id}/copilot", response_model=api_schemas.DocumentCopilotResponse)
def document_copilot(document_id: UUID, payload: api_schemas.DocumentCopilotRequest, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    document = _get_owned(db_models.Document, document_id, user, db)
    if not document.extracted_text:
        raise HTTPException(status_code=400, detail="Document text has not been extracted")
    if payload.action == "question" and not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question is required")
    result = generate_document_copilot(document, payload.action, payload.question)
    if payload.action == "summary" and result.get("answer"):
        document.summary = result["answer"][:5000]
        db.commit()
    return result


@app.delete("/documents/{document_id}")
def delete_document(document_id: UUID, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _delete_owned(db_models.Document, document_id, user, db)


@app.get("/job-matches", response_model=list[api_schemas.JobMatchRead])
def list_job_matches(user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _list_owned(db_models.JobMatch, user, db)


@app.post("/job-matches", response_model=api_schemas.JobMatchRead)
def create_job_match(payload: api_schemas.JobMatchCreate, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _create_owned(db_models.JobMatch, payload, user, db)


@app.get("/job-matches/{job_match_id}", response_model=api_schemas.JobMatchRead)
def get_job_match(job_match_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _get_owned(db_models.JobMatch, job_match_id, user, db)


@app.patch("/job-matches/{job_match_id}", response_model=api_schemas.JobMatchRead)
def update_job_match(job_match_id: UUID, payload: api_schemas.JobMatchUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _update_owned(db_models.JobMatch, job_match_id, payload, user, db)


@app.delete("/job-matches/{job_match_id}")
def delete_job_match(job_match_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _delete_owned(db_models.JobMatch, job_match_id, user, db)


@app.get("/resume-versions", response_model=list[api_schemas.ResumeVersionRead])
def list_resume_versions(user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _list_owned(db_models.ResumeVersion, user, db)


@app.post("/resume-versions", response_model=api_schemas.ResumeVersionRead)
def create_resume_version(payload: api_schemas.ResumeVersionCreate, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _create_owned(db_models.ResumeVersion, payload, user, db)


@app.get("/resume-versions/{resume_version_id}", response_model=api_schemas.ResumeVersionRead)
def get_resume_version(resume_version_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _get_owned(db_models.ResumeVersion, resume_version_id, user, db)


@app.patch("/resume-versions/{resume_version_id}", response_model=api_schemas.ResumeVersionRead)
def update_resume_version(resume_version_id: UUID, payload: api_schemas.ResumeVersionUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _update_owned(db_models.ResumeVersion, resume_version_id, payload, user, db)


@app.delete("/resume-versions/{resume_version_id}")
def delete_resume_version(resume_version_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _delete_owned(db_models.ResumeVersion, resume_version_id, user, db)


AGENT_CATALOG = {
    "career": {
        "name": "Career Agent",
        "purpose": "Personalizes career strategy, role targeting, interviews, resumes, and portfolio moves.",
        "instructions": "Use career memories, goals, skills, resumes, tasks, and job context to create practical career action plans.",
        "tools": ["career_profile", "resume_versions", "goals", "memories", "tasks"],
    },
    "study": {
        "name": "Study Agent",
        "purpose": "Turns study goals into learning plans, review loops, notes, quizzes, and focus blocks.",
        "instructions": "Use study memories, documents, goals, and tasks to plan learning with realistic review intervals.",
        "tools": ["documents", "memories", "goals", "tasks", "daily_plans"],
    },
    "research": {
        "name": "Research Agent",
        "purpose": "Creates research briefs, synthesis plans, comparison frameworks, and decision memos.",
        "instructions": "Use saved documents, memories, goals, and task context to produce grounded research plans.",
        "tools": ["documents", "memory_search", "tasks", "goals"],
    },
    "productivity": {
        "name": "Productivity Agent",
        "purpose": "Triages tasks, organizes goals, builds execution plans, and protects daily momentum.",
        "instructions": "Use tasks, goals, daily plans, and memories to produce a clear execution plan.",
        "tools": ["tasks", "goals", "daily_plans", "memories"],
    },
    "document": {
        "name": "Document Agent",
        "purpose": "Analyzes uploaded documents, extracts notes, action items, and document-grounded plans.",
        "instructions": "Use extracted document summaries and document memories to create grounded document workflows.",
        "tools": ["documents", "document_copilot", "qdrant", "tasks"],
    },
}


def _agent_type_from_name(name: str) -> str | None:
    lowered = name.lower()
    for agent_type, definition in AGENT_CATALOG.items():
        if definition["name"].lower() == lowered or agent_type in lowered:
            return agent_type
    return None


def _ensure_agent(agent_type: str, user: User, db: Session) -> Agent:
    definition = AGENT_CATALOG[agent_type]
    agent = db.scalar(select(Agent).where(Agent.user_id == user.id, Agent.name == definition["name"]))
    if agent is None:
        agent = Agent(
            user_id=user.id,
            name=definition["name"],
            purpose=definition["purpose"],
            status=AgentStatus.idle,
            instructions=definition["instructions"],
            tools=definition["tools"],
            schedule={"agent_type": agent_type, "outputs": []},
        )
        db.add(agent)
        db.flush()
    else:
        agent.purpose = definition["purpose"]
        agent.instructions = definition["instructions"]
        agent.tools = definition["tools"]
        agent.schedule = {**(agent.schedule or {}), "agent_type": agent_type, "outputs": (agent.schedule or {}).get("outputs", [])}
    return agent


def _agent_context(user: User, db: Session, objective: str, extra_context: str) -> dict:
    memories = retrieve_relevant_memories(db, user, objective or extra_context or "agent plan", limit=12)
    tasks = list(db.scalars(select(Task).where(Task.user_id == user.id).order_by(Task.updated_at.desc()).limit(12)))
    goals = list(db.scalars(select(Goal).where(Goal.user_id == user.id).order_by(Goal.updated_at.desc()).limit(8)))
    documents = list(db.scalars(select(Document).where(Document.user_id == user.id).order_by(Document.updated_at.desc()).limit(8)))
    return {
        "memories": [api_schemas.MemoryRead.model_validate(memory).model_dump(mode="json") for memory in memories],
        "tasks": [_serialize_task(task) for task in tasks],
        "goals": [_serialize_goal(goal) for goal in goals],
        "documents": [api_schemas.DocumentRead.model_validate(document).model_dump(mode="json") for document in documents],
        "objective": objective,
        "context": extra_context,
    }


@app.get("/agents/catalog")
def agent_catalog(user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)) -> list[dict]:
    agents = []
    for agent_type, definition in AGENT_CATALOG.items():
        agent = _ensure_agent(agent_type, user, db)
        agents.append({"agent_type": agent_type, "agent": api_schemas.AgentRead.model_validate(agent).model_dump(mode="json"), **definition})
    db.commit()
    return agents


@app.get("/agents", response_model=list[api_schemas.AgentRead])
def list_agents(user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    for agent_type in AGENT_CATALOG:
        _ensure_agent(agent_type, user, db)
    db.commit()
    return list(db.scalars(select(Agent).where(Agent.user_id == user.id).order_by(Agent.name.asc())))


@app.post("/agents", response_model=api_schemas.AgentRead)
def create_agent(payload: api_schemas.AgentCreate, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _create_owned(db_models.Agent, payload, user, db)


@app.post("/agents/run", response_model=api_schemas.AgentRunResponse)
def run_agent(payload: api_schemas.AgentRunRequest, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    ensure_agent_access(db, user, payload.agent_type)
    agent = _ensure_agent(payload.agent_type, user, db)
    agent.status = AgentStatus.running
    db.flush()
    context = _agent_context(user, db, payload.objective, payload.context)
    context["tool_preferences"] = payload.tool_preferences
    output = generate_agent_action_plan(payload.agent_type, context)
    now = datetime.now(timezone.utc).isoformat()
    previous = (agent.schedule or {}).get("outputs", [])
    saved_output = {**output, "objective": payload.objective, "created_at": now}
    agent.schedule = {**(agent.schedule or {}), "agent_type": payload.agent_type, "latest_output": saved_output, "outputs": [saved_output, *previous][:20]}
    agent.status = AgentStatus.idle
    agent.last_run_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(agent)
    return {"agent": agent, "output": saved_output}


@app.post("/agents/productivity/run", response_model=api_schemas.ProductivityAgentResponse)
def run_productivity_agent(payload: api_schemas.ProductivityAgentRequest, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    ensure_agent_access(db, user, "productivity")
    agent = _ensure_agent("productivity", user, db)
    agent.status = AgentStatus.running
    db.flush()
    memories = retrieve_relevant_memories(db, user, payload.focus or payload.context or "productivity", limit=12)
    tasks = list(db.scalars(select(Task).where(Task.user_id == user.id).order_by(Task.updated_at.desc()).limit(40)))
    goals = list(db.scalars(select(Goal).where(Goal.user_id == user.id).order_by(Goal.updated_at.desc()).limit(10)))
    plans = list(db.scalars(select(DailyPlan).where(DailyPlan.user_id == user.id).order_by(DailyPlan.plan_date.desc()).limit(7)))
    result = generate_productivity_result(
        {
            "focus": payload.focus,
            "timeframe": payload.timeframe,
            "context": payload.context,
            "tasks": [_serialize_task(task) for task in tasks],
            "goals": [_serialize_goal(goal) for goal in goals],
            "daily_plans": [api_schemas.DailyPlanRead.model_validate(plan).model_dump(mode="json") for plan in plans],
            "memories": [api_schemas.MemoryRead.model_validate(memory).model_dump(mode="json") for memory in memories],
        }
    )
    now = datetime.now(timezone.utc).isoformat()
    previous = (agent.schedule or {}).get("productivity_results", [])
    saved_result = {**result, "created_at": now, "focus": payload.focus, "timeframe": payload.timeframe, "context": payload.context}
    agent.schedule = {
        **(agent.schedule or {}),
        "agent_type": "productivity",
        "latest_productivity": saved_result,
        "productivity_results": [saved_result, *previous][:20],
        "latest_output": {
            "agent_type": "productivity",
            "title": result.get("title", "Productivity analysis"),
            "summary": result.get("summary", ""),
            "tools_used": ["tasks", "goals", "daily_plans", "memories", "priority_analysis"],
            "action_plan": result.get("improvement_plan", []),
            "next_task": (result.get("suggested_tasks") or [{}])[0].get("title", "Start first focus block"),
            "confidence": 83,
            "objective": payload.focus or payload.timeframe,
            "created_at": now,
        },
    }
    agent.status = AgentStatus.idle
    agent.last_run_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(agent)
    return {"agent": agent, "result": result}


@app.post("/agents/productivity/convert")
def convert_productivity_result(payload: api_schemas.ProductivityConvertRequest, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)) -> dict:
    if payload.mode == "notes":
        memory = save_memory(
            db=db,
            user=user,
            content=payload.result.notes or payload.result.summary,
            memory_type="task",
            importance=4,
            source="productivity_agent",
            meta={"title": payload.result.title, "kind": "productivity_review"},
        )
        db.commit()
        db.refresh(memory)
        return {"mode": "notes", "created": [api_schemas.MemoryRead.model_validate(memory).model_dump(mode="json")]}

    created_tasks = []
    source_items = payload.result.suggested_tasks or [
        {"title": item.get("title", "Productivity improvement"), "notes": item.get("description", ""), "priority": "medium"}
        for item in payload.result.improvement_plan
    ]
    for item in source_items[:8]:
        priority = str(item.get("priority", "medium"))
        task = Task(
            user_id=user.id,
            title=str(item.get("title", "Productivity follow-up"))[:220],
            notes=str(item.get("notes") or item.get("description") or "Follow up from Productivity Agent analysis."),
            priority=priority if priority in {"low", "medium", "high"} else "medium",
            status=TaskStatus.todo,
        )
        db.add(task)
        created_tasks.append(task)
    db.commit()
    for task in created_tasks:
        db.refresh(task)
    return {"mode": "tasks", "created": [api_schemas.TaskRead.model_validate(task).model_dump(mode="json") for task in created_tasks]}


@app.post("/agents/study/run", response_model=api_schemas.StudyAgentResponse)
def run_study_agent(payload: api_schemas.StudyAgentRequest, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    ensure_agent_access(db, user, "study")
    agent = _ensure_agent("study", user, db)
    agent.status = AgentStatus.running
    db.flush()
    context = _agent_context(user, db, payload.topic, payload.context)
    context["level"] = payload.level
    context["goal"] = payload.goal
    context["time_available"] = payload.time_available
    result = generate_study_result(payload.topic, context)
    now = datetime.now(timezone.utc).isoformat()
    previous = (agent.schedule or {}).get("study_results", [])
    saved_result = {**result, "created_at": now, "context": payload.context, "level": payload.level, "goal": payload.goal, "time_available": payload.time_available}
    agent.schedule = {
        **(agent.schedule or {}),
        "agent_type": "study",
        "latest_study": saved_result,
        "study_results": [saved_result, *previous][:20],
        "latest_output": {
            "agent_type": "study",
            "title": result.get("title", "Study result"),
            "summary": result.get("simple_explanation", ""),
            "tools_used": ["memories", "documents", "study_plan", "quiz", "flashcards", "tasks"],
            "action_plan": result.get("study_plan", []),
            "next_task": (result.get("daily_tasks") or [{}])[0].get("title", "Start the first study block"),
            "confidence": 84,
            "objective": payload.topic,
            "created_at": now,
        },
    }
    agent.status = AgentStatus.idle
    agent.last_run_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(agent)
    return {"agent": agent, "result": result}


@app.post("/agents/study/convert")
def convert_study_result(payload: api_schemas.StudyConvertRequest, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)) -> dict:
    if payload.mode == "notes":
        memory = save_memory(
            db=db,
            user=user,
            content=payload.result.notes or payload.result.simple_explanation,
            memory_type="skill",
            importance=4,
            source="study_agent",
            meta={"topic": payload.result.topic, "title": payload.result.title, "kind": "study_notes"},
        )
        db.commit()
        db.refresh(memory)
        return {"mode": "notes", "created": [api_schemas.MemoryRead.model_validate(memory).model_dump(mode="json")]}

    created_tasks = []
    source_items = payload.result.daily_tasks or [
        {"title": item.get("title", "Study follow-up"), "notes": item.get("description", ""), "priority": "medium"}
        for item in payload.result.study_plan
    ]
    for item in source_items[:8]:
        priority = str(item.get("priority", "medium"))
        task = Task(
            user_id=user.id,
            title=str(item.get("title", "Study follow-up"))[:220],
            notes=str(item.get("notes") or item.get("description") or f"Follow up from study plan for {payload.result.topic}"),
            priority=priority if priority in {"low", "medium", "high"} else "medium",
            status=TaskStatus.todo,
        )
        db.add(task)
        created_tasks.append(task)
    db.commit()
    for task in created_tasks:
        db.refresh(task)
    return {"mode": "tasks", "created": [api_schemas.TaskRead.model_validate(task).model_dump(mode="json") for task in created_tasks]}


@app.post("/agents/research/run", response_model=api_schemas.ResearchAgentResponse)
def run_research_agent(payload: api_schemas.ResearchAgentRequest, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    ensure_agent_access(db, user, "research")
    agent = _ensure_agent("research", user, db)
    agent.status = AgentStatus.running
    db.flush()
    context = _agent_context(user, db, payload.topic, payload.context)
    context["depth"] = payload.depth
    result = generate_research_result(payload.topic, context)
    now = datetime.now(timezone.utc).isoformat()
    previous = (agent.schedule or {}).get("research_results", [])
    saved_result = {**result, "created_at": now, "context": payload.context, "depth": payload.depth}
    agent.schedule = {
        **(agent.schedule or {}),
        "agent_type": "research",
        "latest_research": saved_result,
        "research_results": [saved_result, *previous][:20],
        "latest_output": {
            "agent_type": "research",
            "title": result.get("title", "Research result"),
            "summary": result.get("summary", ""),
            "tools_used": ["memories", "documents", "research_synthesis", "tasks"],
            "action_plan": result.get("learning_roadmap", []),
            "next_task": (result.get("suggested_tasks") or [{}])[0].get("title", "Review research notes"),
            "confidence": 82,
            "objective": payload.topic,
            "created_at": now,
        },
    }
    agent.status = AgentStatus.idle
    agent.last_run_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(agent)
    return {"agent": agent, "result": result}


@app.post("/agents/research/convert")
def convert_research_result(payload: api_schemas.ResearchConvertRequest, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)) -> dict:
    if payload.mode == "notes":
        memory = save_memory(
            db=db,
            user=user,
            content=payload.result.notes or payload.result.summary,
            memory_type="document",
            importance=4,
            source="research_agent",
            meta={"topic": payload.result.topic, "title": payload.result.title, "kind": "research_notes"},
        )
        db.commit()
        db.refresh(memory)
        return {"mode": "notes", "created": [api_schemas.MemoryRead.model_validate(memory).model_dump(mode="json")]}

    created_tasks = []
    source_items = payload.result.suggested_tasks or [
        {"title": item.get("title", "Research follow-up"), "notes": item.get("description", ""), "priority": "medium"}
        for item in payload.result.learning_roadmap
    ]
    for item in source_items[:8]:
        task = Task(
            user_id=user.id,
            title=str(item.get("title", "Research follow-up"))[:220],
            notes=str(item.get("notes") or item.get("description") or f"Follow up from research on {payload.result.topic}"),
            priority=str(item.get("priority", "medium")) if str(item.get("priority", "medium")) in {"low", "medium", "high"} else "medium",
            status=TaskStatus.todo,
        )
        db.add(task)
        created_tasks.append(task)
    db.commit()
    for task in created_tasks:
        db.refresh(task)
    return {"mode": "tasks", "created": [api_schemas.TaskRead.model_validate(task).model_dump(mode="json") for task in created_tasks]}


@app.get("/agents/by-type/{agent_type}", response_model=api_schemas.AgentRead)
def get_agent_by_type(agent_type: str, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    if agent_type not in AGENT_CATALOG:
        raise HTTPException(status_code=404, detail="Agent type not found")
    agent = _ensure_agent(agent_type, user, db)
    db.commit()
    db.refresh(agent)
    return agent


@app.get("/agents/{agent_id}", response_model=api_schemas.AgentRead)
def get_agent(agent_id: UUID, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _get_owned(db_models.Agent, agent_id, user, db)


@app.patch("/agents/{agent_id}", response_model=api_schemas.AgentRead)
def update_agent(agent_id: UUID, payload: api_schemas.AgentUpdate, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _update_owned(db_models.Agent, agent_id, payload, user, db)


@app.delete("/agents/{agent_id}")
def delete_agent(agent_id: UUID, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _delete_owned(db_models.Agent, agent_id, user, db)


def _day_bounds(plan_date: datetime) -> tuple[datetime, datetime]:
    value = plan_date if plan_date.tzinfo else plan_date.replace(tzinfo=timezone.utc)
    start = datetime.combine(value.date(), time.min, tzinfo=value.tzinfo)
    return start, start + timedelta(days=1)


def _serialize_task(task: Task) -> dict:
    return {
        "id": str(task.id),
        "title": task.title,
        "notes": task.notes,
        "status": task.status.value,
        "priority": task.priority,
        "due_at": task.due_at.isoformat() if task.due_at else None,
        "goal_id": str(task.goal_id) if task.goal_id else None,
        "goal_title": task.goal_title,
    }


def _serialize_goal(goal: Goal) -> dict:
    return {
        "id": str(goal.id),
        "title": goal.title,
        "why": goal.why,
        "metric": goal.metric,
        "progress": goal.progress,
        "status": goal.status.value,
        "target_at": goal.target_at.isoformat() if goal.target_at else None,
    }


@app.get("/daily-plans", response_model=list[api_schemas.DailyPlanRead])
def list_daily_plans(user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return list(
        db.scalars(
            select(DailyPlan).where(DailyPlan.user_id == user.id).order_by(DailyPlan.plan_date.desc(), DailyPlan.created_at.desc())
        )
    )


@app.post("/daily-plans", response_model=api_schemas.DailyPlanRead)
def create_daily_plan(payload: api_schemas.DailyPlanCreate, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _create_owned(db_models.DailyPlan, payload, user, db)


@app.get("/daily-plans/today", response_model=api_schemas.DailyPlanRead | None)
def get_today_daily_plan(user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    start, end = _day_bounds(datetime.now(timezone.utc))
    return db.scalar(
        select(DailyPlan)
        .where(DailyPlan.user_id == user.id, DailyPlan.plan_date >= start, DailyPlan.plan_date < end)
        .order_by(DailyPlan.updated_at.desc())
    )


@app.get("/daily-plans/dashboard")
def daily_plan_dashboard(user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)) -> dict:
    start, end = _day_bounds(datetime.now(timezone.utc))
    today = db.scalar(
        select(DailyPlan)
        .where(DailyPlan.user_id == user.id, DailyPlan.plan_date >= start, DailyPlan.plan_date < end)
        .order_by(DailyPlan.updated_at.desc())
    )
    tasks = list(db.scalars(select(Task).where(Task.user_id == user.id)))
    goals = list(db.scalars(select(Goal).where(Goal.user_id == user.id)))
    open_tasks = [task for task in tasks if task.status != TaskStatus.done]
    due_today = [task for task in open_tasks if task.due_at and start <= (task.due_at if task.due_at.tzinfo else task.due_at.replace(tzinfo=timezone.utc)) < end]
    planned_task_ids = {
        str(item.get("task_id")) for item in (today.agenda if today else []) if isinstance(item, dict) and item.get("task_id")
    }
    completed_planned = [task for task in tasks if str(task.id) in planned_task_ids and task.status == TaskStatus.done]
    return {
        "today": api_schemas.DailyPlanRead.model_validate(today).model_dump(mode="json") if today else None,
        "tasks": {"open": len(open_tasks), "done": len(tasks) - len(open_tasks), "due_today": len(due_today), "planned": len(planned_task_ids), "completed_planned": len(completed_planned)},
        "goals": {"active": len([goal for goal in goals if goal.status.value == "active"]), "average_progress": round(sum(goal.progress for goal in goals) / max(len(goals), 1))},
        "productivity_score": today.score if today else 0,
    }


@app.post("/daily-plans/generate", response_model=api_schemas.DailyPlanRead)
def generate_daily_plan(payload: api_schemas.DailyPlanGenerateRequest, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    tasks_query = select(Task).where(Task.user_id == user.id, Task.status != TaskStatus.done)
    if payload.include_task_ids:
        tasks_query = tasks_query.where(Task.id.in_(payload.include_task_ids))
    tasks = list(db.scalars(tasks_query.order_by(Task.due_at.asc().nulls_last(), Task.created_at.desc()).limit(12)))

    goals_query = select(Goal).where(Goal.user_id == user.id)
    if payload.include_goal_ids:
        goals_query = goals_query.where(Goal.id.in_(payload.include_goal_ids))
    goals = list(db.scalars(goals_query.order_by(Goal.updated_at.desc()).limit(8)))

    generated = generate_daily_schedule(
        {
            "daily_goals": payload.daily_goals,
            "tasks": [_serialize_task(task) for task in tasks],
            "goals": [_serialize_goal(goal) for goal in goals],
            "start_time": payload.start_time,
            "end_time": payload.end_time,
            "energy": payload.energy,
        }
    )
    start, end = _day_bounds(payload.plan_date)
    plan = db.scalar(
        select(DailyPlan)
        .where(DailyPlan.user_id == user.id, DailyPlan.plan_date >= start, DailyPlan.plan_date < end)
        .order_by(DailyPlan.updated_at.desc())
    )
    if plan is None:
        plan = DailyPlan(user_id=user.id, plan_date=payload.plan_date)
        db.add(plan)
    plan.focus = generated.get("focus", "")[:220]
    plan.agenda = generated.get("agenda", [])
    plan.reflection = generated.get("morning_plan", "")
    plan.score = int(generated.get("score", 0))
    db.commit()
    db.refresh(plan)
    return plan


@app.post("/daily-plans/{daily_plan_id}/review", response_model=api_schemas.DailyPlanRead)
def review_daily_plan(daily_plan_id: UUID, payload: api_schemas.DailyPlanReviewRequest, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    plan = _get_owned(db_models.DailyPlan, daily_plan_id, user, db)
    for task_id in payload.completed_task_ids:
        task = db.scalar(select(Task).where(Task.id == task_id, Task.user_id == user.id))
        if task:
            task.status = TaskStatus.done
    result = generate_evening_review(
        {"focus": plan.focus, "agenda": plan.agenda, "score": plan.score},
        payload.model_dump(mode="json"),
    )
    plan.reflection = result.get("reflection", "")
    plan.score = int(result.get("score", plan.score or 0))
    db.commit()
    db.refresh(plan)
    return plan


@app.get("/daily-plans/{daily_plan_id}", response_model=api_schemas.DailyPlanRead)
def get_daily_plan(daily_plan_id: UUID, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _get_owned(db_models.DailyPlan, daily_plan_id, user, db)


@app.patch("/daily-plans/{daily_plan_id}", response_model=api_schemas.DailyPlanRead)
def update_daily_plan(daily_plan_id: UUID, payload: api_schemas.DailyPlanUpdate, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _update_owned(db_models.DailyPlan, daily_plan_id, payload, user, db)


@app.delete("/daily-plans/{daily_plan_id}")
def delete_daily_plan(daily_plan_id: UUID, user: User = Depends(get_current_clerk_user), db: Session = Depends(get_db)):
    return _delete_owned(db_models.DailyPlan, daily_plan_id, user, db)
