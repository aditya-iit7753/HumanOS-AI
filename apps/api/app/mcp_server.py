from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai import build_context, generate_answer
from app.config import get_settings
from app.database import get_db
from app.models import Conversation, Goal, HumanOSApiKey, Memory, Message, Task, TaskPriority, User

router = APIRouter(tags=["mcp"])


def _extract_key(request: Request) -> str:
    authorization = request.headers.get("authorization", "")
    scheme, _, bearer_token = authorization.partition(" ")
    return request.headers.get("x-mcp-api-key") or (bearer_token if scheme.lower() == "bearer" else "")


def _hash_api_key(api_key: str) -> str:
    return sha256(api_key.encode("utf-8")).hexdigest()


def _authorize_mcp(request: Request, db: Session) -> User | None:
    provided = _extract_key(request)
    settings = get_settings()

    if settings.mcp_api_key and provided == settings.mcp_api_key:
        return None

    if provided.startswith("hos_"):
        key_hash = _hash_api_key(provided)
        api_key = db.scalar(select(HumanOSApiKey).where(HumanOSApiKey.key_hash == key_hash, HumanOSApiKey.revoked_at.is_(None)))
        if api_key is not None:
            api_key.last_used_at = datetime.now(timezone.utc)
            db.flush()
            return api_key.user

    if not settings.mcp_api_key:
        raise HTTPException(status_code=503, detail="MCP server is not configured")
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MCP API key")


def _jsonrpc_result(request_id: Any, result: dict[str, Any]) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _jsonrpc_error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def _content(text: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": text}]}


def _get_or_create_user(db: Session, arguments: dict[str, Any], authenticated_user: User | None = None) -> User:
    if authenticated_user is not None:
        return authenticated_user
    email = str(arguments.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Tool argument 'email' is required")
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, full_name=str(arguments.get("full_name") or "MCP User"), hashed_password="mcp_managed")
        db.add(user)
        db.flush()
    return user


def _tool_schema() -> list[dict[str, Any]]:
    user_fields = {
        "email": {"type": "string", "description": "HumanOS user email."},
        "full_name": {"type": "string", "description": "Optional name when creating a new integration user."},
    }
    return [
        {
            "name": "humanos_health",
            "description": "Check whether the HumanOS MCP gateway is online.",
            "inputSchema": {"type": "object", "properties": {}},
        },
        {
            "name": "humanos_chat",
            "description": "Ask the HumanOS AI copilot with user memory, tasks, and goals as context.",
            "inputSchema": {"type": "object", "required": ["email", "message"], "properties": {**user_fields, "message": {"type": "string"}}},
        },
        {
            "name": "humanos_list_tasks",
            "description": "List a user task queue.",
            "inputSchema": {"type": "object", "required": ["email"], "properties": user_fields},
        },
        {
            "name": "humanos_create_task",
            "description": "Create a HumanOS task for a user.",
            "inputSchema": {
                "type": "object",
                "required": ["email", "title"],
                "properties": {**user_fields, "title": {"type": "string"}, "notes": {"type": "string"}, "priority": {"type": "string", "enum": ["low", "medium", "high"]}},
            },
        },
        {
            "name": "humanos_list_memories",
            "description": "List saved long-term memories for a user.",
            "inputSchema": {"type": "object", "required": ["email"], "properties": user_fields},
        },
        {
            "name": "humanos_save_memory",
            "description": "Save an important memory/fact for a user.",
            "inputSchema": {"type": "object", "required": ["email", "content"], "properties": {**user_fields, "content": {"type": "string"}, "category": {"type": "string"}}},
        },
        {
            "name": "humanos_create_goal",
            "description": "Create a long-term goal for a user.",
            "inputSchema": {"type": "object", "required": ["email", "title"], "properties": {**user_fields, "title": {"type": "string"}, "why": {"type": "string"}, "metric": {"type": "string"}}},
        },
    ]


def _call_tool(name: str, arguments: dict[str, Any], db: Session, authenticated_user: User | None = None) -> dict[str, Any]:
    if name == "humanos_health":
        return _content("HumanOS MCP server is online.")

    user = _get_or_create_user(db, arguments, authenticated_user)

    if name == "humanos_list_tasks":
        tasks = db.scalars(select(Task).where(Task.user_id == user.id).order_by(Task.created_at.desc()).limit(20)).all()
        if not tasks:
            return _content("No tasks found.")
        lines = [f"- {task.title} [{getattr(task.status, 'value', task.status)} | {task.priority}]" for task in tasks]
        return _content("\n".join(lines))

    if name == "humanos_create_task":
        task = Task(
            user_id=user.id,
            title=str(arguments.get("title") or "New MCP task")[:220],
            notes=str(arguments.get("notes") or ""),
            priority=str(arguments.get("priority") or TaskPriority.medium.value),
        )
        db.add(task)
        db.commit()
        return _content(f"Task created: {task.title}")

    if name == "humanos_list_memories":
        memories = db.scalars(select(Memory).where(Memory.user_id == user.id).order_by(Memory.created_at.desc()).limit(20)).all()
        if not memories:
            return _content("No memories found.")
        lines = [f"- [{memory.category}] {memory.content}" for memory in memories]
        return _content("\n".join(lines))

    if name == "humanos_save_memory":
        memory = Memory(user_id=user.id, content=str(arguments.get("content") or "")[:4000], category=str(arguments.get("category") or "important_fact"), source="mcp", importance=4)
        db.add(memory)
        db.commit()
        return _content("Memory saved.")

    if name == "humanos_create_goal":
        goal = Goal(user_id=user.id, title=str(arguments.get("title") or "New MCP goal")[:220], why=str(arguments.get("why") or ""), metric=str(arguments.get("metric") or ""))
        db.add(goal)
        db.commit()
        return _content(f"Goal created: {goal.title}")

    if name == "humanos_chat":
        message = str(arguments.get("message") or "").strip()
        if not message:
            raise HTTPException(status_code=400, detail="Tool argument 'message' is required")
        memories = db.scalars(select(Memory).where(Memory.user_id == user.id).order_by(Memory.created_at.desc()).limit(8)).all()
        tasks = db.scalars(select(Task).where(Task.user_id == user.id).order_by(Task.created_at.desc()).limit(8)).all()
        goals = db.scalars(select(Goal).where(Goal.user_id == user.id).order_by(Goal.created_at.desc()).limit(8)).all()
        answer = generate_answer(message, build_context(memories, tasks, goals))
        conversation = Conversation(user_id=user.id, title=message[:80] or "MCP conversation")
        db.add(conversation)
        db.flush()
        db.add(Message(conversation_id=conversation.id, role="user", content=message, meta={"source": "mcp"}))
        db.add(Message(conversation_id=conversation.id, role="assistant", content=answer, meta={"source": "mcp"}))
        db.commit()
        return _content(answer)

    raise HTTPException(status_code=404, detail=f"Unknown MCP tool: {name}")


@router.get("/mcp")
def mcp_info(request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    _authorize_mcp(request, db)
    return {"name": "HumanOS AI MCP", "endpoint": "/mcp", "transport": "http-jsonrpc", "tools": [tool["name"] for tool in _tool_schema()]}


@router.post("/mcp")
async def mcp_jsonrpc(payload: dict[str, Any], request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    authenticated_user = _authorize_mcp(request, db)
    request_id = payload.get("id")
    method = str(payload.get("method") or "")
    params = payload.get("params") if isinstance(payload.get("params"), dict) else {}

    try:
        if method == "initialize":
            return _jsonrpc_result(request_id, {"protocolVersion": "2025-06-18", "serverInfo": {"name": "HumanOS AI", "version": "1.0.0"}, "capabilities": {"tools": {}}})
        if method == "tools/list":
            return _jsonrpc_result(request_id, {"tools": _tool_schema()})
        if method == "tools/call":
            name = str(params.get("name") or "")
            arguments = params.get("arguments") if isinstance(params.get("arguments"), dict) else {}
            return _jsonrpc_result(request_id, _call_tool(name, arguments, db, authenticated_user))
        return _jsonrpc_error(request_id, -32601, f"Unknown MCP method: {method}")
    except HTTPException as exc:
        return _jsonrpc_error(request_id, -32000, str(exc.detail))
    except Exception as exc:
        return _jsonrpc_error(request_id, -32603, f"Internal MCP error: {exc}")