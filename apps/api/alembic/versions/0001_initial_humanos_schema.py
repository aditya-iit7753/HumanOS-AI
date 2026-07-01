"""initial humanos schema

Revision ID: 0001_initial_humanos_schema
Revises:
Create Date: 2026-06-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_humanos_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')
    task_status = postgresql.ENUM("todo", "in_progress", "done", name="taskstatus")
    goal_status = postgresql.ENUM("active", "paused", "complete", name="goalstatus")
    document_status = postgresql.ENUM("uploaded", "processing", "ready", "failed", name="documentstatus")
    agent_status = postgresql.ENUM("idle", "running", "paused", "disabled", name="agentstatus")
    memory_type = postgresql.ENUM(
        "career_goal",
        "personal_preference",
        "project",
        "skill",
        "task",
        "document",
        "important_fact",
        name="memorytype",
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("clerk_user_id", sa.String(length=128), nullable=True),
        sa.Column("full_name", sa.String(length=160), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=80), nullable=False, server_default="member"),
        *_timestamps(),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_clerk_user_id", "users", ["clerk_user_id"], unique=True)


    op.create_table(
        "user_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ai_preferences", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("memory_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("theme", sa.String(length=24), nullable=False, server_default="system"),
        sa.Column("dev_api_keys", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        *_timestamps(),
    )
    op.create_index("ix_user_settings_user_id", "user_settings", ["user_id"], unique=True)

    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False, server_default="New conversation"),
        *_timestamps(),
    )
    op.create_index("ix_conversations_user_id", "conversations", ["user_id"])

    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(length=24), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])

    op.create_table(
        "memories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", memory_type, nullable=False, server_default="important_fact"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("importance", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("source", sa.String(length=120), nullable=False, server_default="assistant"),
        sa.Column("vector_id", sa.String(length=80), nullable=True),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        *_timestamps(),
    )
    op.create_index("ix_memories_user_id", "memories", ["user_id"])
    op.create_index("ix_memories_vector_id", "memories", ["vector_id"], unique=True)

    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=220), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", task_status, nullable=False, server_default="todo"),
        sa.Column("priority", sa.String(length=16), nullable=False, server_default="medium"),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
    )
    op.create_index("ix_tasks_user_id", "tasks", ["user_id"])

    op.create_table(
        "goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=220), nullable=False),
        sa.Column("why", sa.Text(), nullable=False, server_default=""),
        sa.Column("metric", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", goal_status, nullable=False, server_default="active"),
        sa.Column("target_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
    )
    op.create_index("ix_goals_user_id", "goals", ["user_id"])

    op.create_table(
        "goal_milestones",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("goal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("goals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=220), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("target_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        *_timestamps(),
    )
    op.create_index("ix_goal_milestones_user_id", "goal_milestones", ["user_id"])
    op.create_index("ix_goal_milestones_goal_id", "goal_milestones", ["goal_id"])
    op.add_column("tasks", sa.Column("goal_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_tasks_goal_id_goals", "tasks", "goals", ["goal_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_tasks_goal_id", "tasks", ["goal_id"])

    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=220), nullable=False),
        sa.Column("file_name", sa.String(length=260), nullable=False, server_default=""),
        sa.Column("mime_type", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("storage_url", sa.Text(), nullable=False, server_default=""),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("extracted_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", document_status, nullable=False, server_default="uploaded"),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        *_timestamps(),
    )
    op.create_index("ix_documents_user_id", "documents", ["user_id"])

    op.create_table(
        "job_matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company", sa.String(length=180), nullable=False),
        sa.Column("title", sa.String(length=220), nullable=False),
        sa.Column("location", sa.String(length=180), nullable=False, server_default=""),
        sa.Column("url", sa.Text(), nullable=False, server_default=""),
        sa.Column("match_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=80), nullable=False, server_default="saved"),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        *_timestamps(),
    )
    op.create_index("ix_job_matches_user_id", "job_matches", ["user_id"])

    op.create_table(
        "resume_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=220), nullable=False),
        sa.Column("target_role", sa.String(length=180), nullable=False, server_default=""),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        *_timestamps(),
    )
    op.create_index("ix_resume_versions_user_id", "resume_versions", ["user_id"])

    op.create_table(
        "agents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", agent_status, nullable=False, server_default="idle"),
        sa.Column("instructions", sa.Text(), nullable=False, server_default=""),
        sa.Column("tools", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("schedule", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
    )
    op.create_index("ix_agents_user_id", "agents", ["user_id"])

    op.create_table(
        "daily_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("focus", sa.String(length=220), nullable=False, server_default=""),
        sa.Column("agenda", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("reflection", sa.Text(), nullable=False, server_default=""),
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
        *_timestamps(),
    )
    op.create_index("ix_daily_plans_user_id", "daily_plans", ["user_id"])
    op.create_index("ix_daily_plans_plan_date", "daily_plans", ["plan_date"])

    op.create_table(
        "career_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("current_role", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("target_role", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("strengths", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("growth_areas", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("roadmap", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_career_profiles_user_id", "career_profiles", ["user_id"], unique=True)


def downgrade() -> None:
    for table in [
        "career_profiles",
        "daily_plans",
        "agents",
        "resume_versions",
        "job_matches",
        "documents",
        "goals",
        "tasks",
        "memories",
        "messages",
        "conversations",
        "user_settings",
        "users",
    ]:
        op.drop_table(table)

    for enum_name in ["agentstatus", "documentstatus", "memorytype", "goalstatus", "taskstatus"]:
        postgresql.ENUM(name=enum_name).drop(op.get_bind(), checkfirst=True)
