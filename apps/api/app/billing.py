
from __future__ import annotations

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
from app.models import Agent, BillingPlan, Conversation, Document, Memory, Message, Subscription, SubscriptionStatus, User

PLAN_LIMITS: dict[str, dict[str, Any]] = {
    BillingPlan.free.value: {
        "chat_messages": 50,
        "memories": 25,
        "documents": 3,
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


def price_to_plan(price_id: str | None) -> str:
    settings = get_settings()
    mapping = {
        settings.stripe_price_pro: BillingPlan.pro.value,
        settings.stripe_price_premium: BillingPlan.premium.value,
        settings.stripe_price_enterprise: BillingPlan.enterprise.value,
    }
    return mapping.get(price_id or "", BillingPlan.free.value)


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
        },
        "limits": limits,
    }


def create_checkout_session(db: Session, user: User, plan: str) -> str:
    settings = get_settings()
    if not settings.stripe_secret_key or stripe is None:
        raise HTTPException(status_code=500, detail="Stripe is not configured")
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
    subscription.meta = {"last_event_subscription": data}
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
    db.commit()
