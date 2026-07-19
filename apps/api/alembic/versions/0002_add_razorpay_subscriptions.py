"""add razorpay subscriptions

Revision ID: 0002_add_razorpay_subscriptions
Revises: 0001_initial_humanos_schema
Create Date: 2026-07-19 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0002_add_razorpay_subscriptions"
down_revision = "0001_initial_humanos_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("subscriptions", sa.Column("razorpay_customer_id", sa.String(length=128), nullable=True))
    op.add_column("subscriptions", sa.Column("razorpay_subscription_id", sa.String(length=128), nullable=True))
    op.add_column("subscriptions", sa.Column("razorpay_plan_id", sa.String(length=128), nullable=True))
    op.create_index(
        "ix_subscriptions_razorpay_subscription_id",
        "subscriptions",
        ["razorpay_subscription_id"],
        unique=True,
        postgresql_where=sa.text("razorpay_subscription_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_subscriptions_razorpay_subscription_id", table_name="subscriptions")
    op.drop_column("subscriptions", "razorpay_plan_id")
    op.drop_column("subscriptions", "razorpay_subscription_id")
    op.drop_column("subscriptions", "razorpay_customer_id")
