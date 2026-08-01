
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

try:
    import stripe
except Exception:  # pragma: no cover - keeps non-billing local dev alive until requirements are installed
    stripe = None
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Agent, BillingPlan, Conversation, DailyPlan, Document, Goal, Memory, Message, Subscription, SubscriptionStatus, Task, User

PLAN_LIMITS: dict[str, dict[str, Any]] = {
    BillingPlan.free.value: {
        "chat_messages": 50,
        "memories": 25,
        "documents": 3,
        "agents": ["study", "research"],
        "career_copilot": "basic",
    },
    BillingPlan.starter.value: {
        "chat_messages": 100,
        "memories": 50,
        "documents": 5,
        "agents": ["study", "research"],
        "career_copilot": "basic",
    },
    BillingPlan.pro.value: {
        "chat_messages": 1000,
        "memories": 500,
        "documents": 50,
        "agents": ["career", "study", "research", "productivity", "document"],
        "career_copilot": "full",
    },
    BillingPlan.premium.value: {
        "chat_messages": None,
        "memories": None,
        "documents": 250,
        "agents": ["career", "study", "research", "productivity", "document"],
        "career_copilot": "advanced",
    },
    BillingPlan.enterprise.value: {
        "chat_messages": None,
        "memories": None,
        "documents": None,
        "agents": ["career", "study", "research", "productivity", "document"],
        "career_copilot": "enterprise",
    },
}

PAID_STATUSES = {SubscriptionStatus.active.value, SubscriptionStatus.trialing.value}
RAZORPAY_API_BASE = "https://api.razorpay.com/v1"


def price_to_plan(price_id: str | None) -> str:
    settings = get_settings()
    mapping = {
        settings.stripe_price_pro: BillingPlan.pro.value,
        settings.stripe_price_premium: BillingPlan.premium.value,
        settings.stripe_price_enterprise: BillingPlan.enterprise.value,
    }
    return mapping.get(price_id or "", BillingPlan.free.value)


def razorpay_plan_to_plan(plan_id: str | None) -> str:
    settings = get_settings()
    mapping = {
        settings.razorpay_plan_starter: BillingPlan.starter.value,
        settings.razorpay_plan_pro: BillingPlan.pro.value,
        settings.razorpay_plan_premium: BillingPlan.premium.value,
        settings.razorpay_plan_enterprise: BillingPlan.enterprise.value,
    }
    return mapping.get(plan_id or "", BillingPlan.free.value)


def get_or_create_subscription(db: Session, user: User) -> Subscription:
    subscription = db.scalar(select(Subscription).where(Subscription.user_id == user.id))
    if subscription is None:
        subscription = Subscription(user_id=user.id, plan=BillingPlan.free.value, status=SubscriptionStatus.inactive.value)
        db.add(subscription)
        db.flush()
    return subscription


def active_plan(db: Session, user: User) -> str:
    subscription = get_or_create_subscription(db, user)
    if subscription.plan in {BillingPlan.enterprise.value}:
        return subscription.plan
    if subscription.status in PAID_STATUSES:
        return subscription.plan
    return BillingPlan.free.value


def subscription_payload(db: Session, user: User) -> dict[str, Any]:
    subscription = get_or_create_subscription(db, user)
    plan = active_plan(db, user)
    return {
        "plan": plan,
        "status": subscription.status,
        "limits": PLAN_LIMITS[plan],
        "current_period_end": subscription.current_period_end,
        "cancel_at_period_end": subscription.cancel_at_period_end,
        "stripe_customer_id": subscription.stripe_customer_id,
        "razorpay_customer_id": subscription.razorpay_customer_id,
        "razorpay_subscription_id": subscription.razorpay_subscription_id,
    }


def ensure_limit(db: Session, user: User, feature: str, used: int | None = None) -> None:
    plan = active_plan(db, user)
    limit = PLAN_LIMITS[plan].get(feature)
    if limit is None or isinstance(limit, list):
        return
    if used is None:
        used = usage_count(db, user, feature)
    if used >= int(limit):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Your {plan} plan limit for {feature.replace('_', ' ')} is reached. Upgrade to continue.",
        )


def ensure_agent_access(db: Session, user: User, agent_type: str) -> None:
    plan = active_plan(db, user)
    allowed = PLAN_LIMITS[plan].get("agents") or []
    if agent_type not in allowed:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"The {agent_type} agent requires a higher plan.",
        )


def ensure_career_access(db: Session, user: User) -> None:
    plan = active_plan(db, user)
    if PLAN_LIMITS[plan].get("career_copilot") == "basic":
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Career Copilot requires Pro or higher.")


def usage_count(db: Session, user: User, feature: str) -> int:
    if feature == "chat_messages":
        return int(
            db.scalar(
                select(func.count(Message.id)).join(Conversation).where(Conversation.user_id == user.id, Message.role == "user")
            )
            or 0
        )
    if feature == "memories":
        return int(db.scalar(select(func.count(Memory.id)).where(Memory.user_id == user.id)) or 0)
    if feature == "documents":
        return int(db.scalar(select(func.count(Document.id)).where(Document.user_id == user.id)) or 0)
    if feature == "agents":
        return int(db.scalar(select(func.count(Agent.id)).where(Agent.user_id == user.id)) or 0)
    if feature == "tasks":
        return int(db.scalar(select(func.count(Task.id)).where(Task.user_id == user.id)) or 0)
    if feature == "goals":
        return int(db.scalar(select(func.count(Goal.id)).where(Goal.user_id == user.id)) or 0)
    if feature == "daily_plans":
        return int(db.scalar(select(func.count(DailyPlan.id)).where(DailyPlan.user_id == user.id)) or 0)
    return 0


def usage_payload(db: Session, user: User) -> dict[str, Any]:
    plan = active_plan(db, user)
    limits = PLAN_LIMITS[plan]
    return {
        "plan": plan,
        "usage": {
            "chat_messages": usage_count(db, user, "chat_messages"),
            "memories": usage_count(db, user, "memories"),
            "documents": usage_count(db, user, "documents"),
            "agents": usage_count(db, user, "agents"),
            "tasks": usage_count(db, user, "tasks"),
            "goals": usage_count(db, user, "goals"),
            "daily_plans": usage_count(db, user, "daily_plans"),
        },
        "limits": limits,
    }


def _has_razorpay_config() -> bool:
    settings = get_settings()
    return bool(settings.razorpay_key_id and settings.razorpay_key_secret)


def _razorpay_plan_id(plan: str) -> str:
    settings = get_settings()
    plan_ids = {
        BillingPlan.starter.value: settings.razorpay_plan_starter,
        BillingPlan.pro.value: settings.razorpay_plan_pro,
        BillingPlan.premium.value: settings.razorpay_plan_premium,
        BillingPlan.enterprise.value: settings.razorpay_plan_enterprise,
    }
    plan_id = plan_ids.get(plan, "")
    if not plan_id:
        raise HTTPException(status_code=400, detail="This Razorpay plan is not configured")
    for other_plan, other_plan_id in plan_ids.items():
        if other_plan != plan and other_plan_id and other_plan_id == plan_id:
            raise HTTPException(
                status_code=500,
                detail=f"Razorpay {plan} plan is configured with the same plan ID as {other_plan}. Update Railway environment variables.",
            )
    return plan_id


def _razorpay_request(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    body = json.dumps(payload).encode("utf-8")
    token = base64.b64encode(f"{settings.razorpay_key_id}:{settings.razorpay_key_secret}".encode("utf-8")).decode("ascii")
    request = urllib.request.Request(
        f"{RAZORPAY_API_BASE}{path}",
        data=body,
        headers={"Authorization": f"Basic {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail=f"Razorpay API error: {detail}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Unable to reach Razorpay") from exc


def create_razorpay_subscription(db: Session, user: User, plan: str) -> dict[str, Any]:
    settings = get_settings()
    if not _has_razorpay_config():
        raise HTTPException(status_code=500, detail="Razorpay is not configured")
    plan_id = _razorpay_plan_id(plan)
    payload = {
        "plan_id": plan_id,
        "total_count": 120,
        "quantity": 1,
        "customer_notify": 1,
        "notes": {"user_id": str(user.id), "plan": plan, "email": user.email},
    }
    data = _razorpay_request("/subscriptions", payload)
    subscription = get_or_create_subscription(db, user)
    subscription.plan = plan
    subscription.status = SubscriptionStatus.inactive.value
    subscription.razorpay_subscription_id = data.get("id")
    subscription.razorpay_plan_id = plan_id
    subscription.razorpay_customer_id = data.get("customer_id")
    subscription.meta = {**(subscription.meta or {}), "provider": "razorpay", "latest_razorpay_subscription": data}
    db.commit()
    return {
        "provider": "razorpay",
        "key_id": settings.razorpay_key_id,
        "subscription_id": data.get("id"),
        "plan": plan,
        "name": user.full_name,
        "email": user.email,
    }


def create_checkout_session(db: Session, user: User, plan: str) -> dict[str, Any]:
    if _has_razorpay_config():
        return create_razorpay_subscription(db, user, plan)
    return {"provider": "stripe", "url": create_stripe_checkout_session(db, user, plan)}


def create_stripe_checkout_session(db: Session, user: User, plan: str) -> str:
    settings = get_settings()
    if not settings.stripe_secret_key or stripe is None:
        raise HTTPException(status_code=500, detail="Razorpay or Stripe is not configured")
    price_id = {
        BillingPlan.pro.value: settings.stripe_price_pro,
        BillingPlan.premium.value: settings.stripe_price_premium,
        BillingPlan.enterprise.value: settings.stripe_price_enterprise,
    }.get(plan)
    if not price_id:
        raise HTTPException(status_code=400, detail="This plan is not available for checkout")

    stripe.api_key = settings.stripe_secret_key
    subscription = get_or_create_subscription(db, user)
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=subscription.stripe_customer_id or None,
        customer_email=None if subscription.stripe_customer_id else user.email,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.app_url.rstrip('/')}/settings?billing=success",
        cancel_url=f"{settings.app_url.rstrip('/')}/pricing?billing=cancelled",
        client_reference_id=str(user.id),
        metadata={"user_id": str(user.id), "plan": plan},
        subscription_data={"metadata": {"user_id": str(user.id), "plan": plan}},
    )
    return str(session.url)


def create_billing_portal_session(db: Session, user: User) -> str:
    settings = get_settings()
    subscription = get_or_create_subscription(db, user)
    if subscription.razorpay_subscription_id:
        raise HTTPException(status_code=400, detail="Manage Razorpay subscriptions from your Razorpay payment email or contact support.")
    if stripe is None:
        raise HTTPException(status_code=500, detail="Stripe is not configured")
    if not settings.stripe_secret_key or not subscription.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing customer found")
    stripe.api_key = settings.stripe_secret_key
    session = stripe.billing_portal.Session.create(
        customer=subscription.stripe_customer_id,
        return_url=f"{settings.app_url.rstrip('/')}/settings",
    )
    return str(session.url)


def verify_razorpay_webhook_signature(payload: bytes, signature: str | None) -> None:
    settings = get_settings()
    if not settings.razorpay_webhook_secret:
        return
    if not signature:
        raise HTTPException(status_code=400, detail="Missing Razorpay signature")
    expected = hmac.new(settings.razorpay_webhook_secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid Razorpay webhook signature")


def _razorpay_status_to_local(status_value: str | None, event_type: str | None) -> str:
    if event_type in {"subscription.authenticated", "subscription.activated", "subscription.charged"}:
        return SubscriptionStatus.active.value
    if status_value in {"active", "authenticated", "completed"}:
        return SubscriptionStatus.active.value
    if status_value in {"pending", "halted"}:
        return SubscriptionStatus.past_due.value
    if status_value in {"cancelled", "cancelled_at_cycle_end"} or event_type == "subscription.cancelled":
        return SubscriptionStatus.canceled.value
    return SubscriptionStatus.inactive.value


def sync_razorpay_subscription(db: Session, event: dict[str, Any]) -> None:
    event_type = event.get("event")
    entity = (((event.get("payload") or {}).get("subscription") or {}).get("entity") or {})
    if not entity:
        return
    subscription_id = entity.get("id")
    plan_id = entity.get("plan_id")
    notes = entity.get("notes") or {}
    user_id = notes.get("user_id")
    subscription = None
    if subscription_id:
        subscription = db.scalar(select(Subscription).where(Subscription.razorpay_subscription_id == subscription_id))
    if subscription is None and user_id:
        subscription = db.scalar(select(Subscription).where(Subscription.user_id == UUID(str(user_id))))
    if subscription is None:
        return
    subscription.plan = notes.get("plan") or razorpay_plan_to_plan(plan_id)
    subscription.status = _razorpay_status_to_local(entity.get("status"), event_type)
    subscription.razorpay_customer_id = entity.get("customer_id")
    subscription.razorpay_subscription_id = subscription_id
    subscription.razorpay_plan_id = plan_id
    subscription.cancel_at_period_end = bool(entity.get("cancel_at_cycle_end") or entity.get("ended_at"))
    period_end = entity.get("current_end") or entity.get("end_at")
    subscription.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc) if period_end else None
    subscription.meta = {**(subscription.meta or {}), "provider": "razorpay", "last_razorpay_event": event}
    db.commit()


def verify_razorpay_checkout(db: Session, data: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    if not settings.razorpay_key_secret:
        raise HTTPException(status_code=500, detail="Razorpay is not configured")

    returned_subscription_id = str(data.get("razorpay_subscription_id") or "")
    payment_id = str(data.get("razorpay_payment_id") or "")
    signature = str(data.get("razorpay_signature") or "")
    requested_plan = str(data.get("plan") or BillingPlan.free.value)

    if not returned_subscription_id or not payment_id or not signature:
        raise HTTPException(status_code=400, detail="Missing Razorpay payment verification details")

    expected = hmac.new(
        settings.razorpay_key_secret.encode("utf-8"),
        f"{returned_subscription_id}|{payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid Razorpay payment signature")

    subscription = db.scalar(select(Subscription).where(Subscription.razorpay_subscription_id == returned_subscription_id))
    if subscription is None:
        raise HTTPException(status_code=404, detail="Razorpay subscription was not found")
    if requested_plan != subscription.plan:
        raise HTTPException(status_code=400, detail="Payment plan does not match the current checkout session")

    subscription.status = SubscriptionStatus.active.value
    subscription.meta = {
        **(subscription.meta or {}),
        "provider": "razorpay",
        "latest_checkout_verification": {
            "razorpay_payment_id": payment_id,
            "razorpay_subscription_id": returned_subscription_id,
            "plan": requested_plan,
            "verified_at": datetime.now(timezone.utc).isoformat(),
        },
    }
    db.commit()
    db.refresh(subscription)
    return subscription_payload(db, subscription.user)

def sync_stripe_subscription(db: Session, data: dict[str, Any]) -> None:
    customer_id = data.get("customer")
    subscription_id = data.get("id")
    metadata = data.get("metadata") or {}
    user_id = metadata.get("user_id")
    price_id = None
    items = ((data.get("items") or {}).get("data") or [])
    if items:
        price_id = ((items[0].get("price") or {}).get("id"))
    plan = metadata.get("plan") or price_to_plan(price_id)

    subscription = None
    if subscription_id:
        subscription = db.scalar(select(Subscription).where(Subscription.stripe_subscription_id == subscription_id))
    if subscription is None and customer_id:
        subscription = db.scalar(select(Subscription).where(Subscription.stripe_customer_id == customer_id))
    if subscription is None and user_id:
        subscription = db.scalar(select(Subscription).where(Subscription.user_id == UUID(str(user_id))))
    if subscription is None:
        return

    subscription.plan = plan
    subscription.status = data.get("status") or SubscriptionStatus.inactive.value
    subscription.stripe_customer_id = customer_id
    subscription.stripe_subscription_id = subscription_id
    subscription.stripe_price_id = price_id
    subscription.cancel_at_period_end = bool(data.get("cancel_at_period_end") or False)
    period_end = data.get("current_period_end")
    subscription.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc) if period_end else None
    subscription.meta = {**(subscription.meta or {}), "provider": "stripe", "last_event_subscription": data}
    db.commit()


def handle_checkout_completed(db: Session, data: dict[str, Any]) -> None:
    user_id = data.get("client_reference_id") or (data.get("metadata") or {}).get("user_id")
    customer_id = data.get("customer")
    subscription_id = data.get("subscription")
    plan = (data.get("metadata") or {}).get("plan") or BillingPlan.pro.value
    if not user_id:
        return
    parsed_user_id = UUID(str(user_id))
    subscription = db.scalar(select(Subscription).where(Subscription.user_id == parsed_user_id))
    if subscription is None:
        subscription = Subscription(user_id=parsed_user_id)
        db.add(subscription)
    subscription.plan = plan
    subscription.status = SubscriptionStatus.active.value
    subscription.stripe_customer_id = customer_id
    subscription.stripe_subscription_id = subscription_id
    subscription.meta = {**(subscription.meta or {}), "provider": "stripe", "checkout_session": data}
    db.commit()
