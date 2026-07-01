from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from typing import Any

from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, FieldCondition, Filter, MatchValue, PointStruct, VectorParams
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Memory, User

MEMORY_TYPES = {
    "career_goal",
    "personal_preference",
    "project",
    "skill",
    "task",
    "document",
    "important_fact",
}

EMBEDDING_SIZE = 1536


@dataclass
class ExtractedMemory:
    memory_type: str
    content: str
    importance: int = 3
    meta: dict[str, Any] | None = None


def normalize_memory_type(value: str | None) -> str:
    if value in MEMORY_TYPES:
        return value
    return "important_fact"


def _openai_client() -> OpenAI | None:
    settings = get_settings()
    if not settings.openai_api_key or settings.openai_api_key in {"replace-me", "sk-xxxxxxxx"}:
        return None
    return OpenAI(api_key=settings.openai_api_key)


def _qdrant_client() -> QdrantClient | None:
    settings = get_settings()
    if not settings.qdrant_url:
        return None
    return QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None, timeout=3)


def _ensure_collection(client: QdrantClient) -> None:
    settings = get_settings()
    collections = client.get_collections().collections
    if any(collection.name == settings.qdrant_collection for collection in collections):
        return
    client.create_collection(
        collection_name=settings.qdrant_collection,
        vectors_config=VectorParams(size=EMBEDDING_SIZE, distance=Distance.COSINE),
    )


def embed_text(text: str) -> list[float] | None:
    client = _openai_client()
    if client is None:
        return None
    response = client.embeddings.create(model=get_settings().openai_embedding_model, input=text[:8000])
    return response.data[0].embedding


def extract_memories_from_chat(user_message: str) -> list[ExtractedMemory]:
    client = _openai_client()
    if client is None:
        return _heuristic_extract(user_message)

    prompt = (
        "Extract durable long-term memories from this user message. "
        "Only save stable facts, preferences, projects, skills, tasks, documents, or career goals that will help future assistance. "
        "Do not save temporary small talk. Return JSON with a top-level memories array. "
        "Each item must include memory_type, content, importance from 1 to 5. "
        f"Allowed memory_type values: {', '.join(sorted(MEMORY_TYPES))}.\n\n"
        f"User message: {user_message}"
    )
    try:
        response = client.chat.completions.create(
            model=get_settings().openai_memory_model,
            messages=[
                {"role": "system", "content": "You extract private user memory as compact, factual JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0,
            response_format={"type": "json_object"},
        )
        payload = json.loads(response.choices[0].message.content or "{}")
    except Exception:
        return _heuristic_extract(user_message)

    memories: list[ExtractedMemory] = []
    for item in payload.get("memories", []):
        content = str(item.get("content", "")).strip()
        if not content:
            continue
        importance = item.get("importance", 3)
        try:
            importance_int = max(1, min(5, int(importance)))
        except (TypeError, ValueError):
            importance_int = 3
        memories.append(
            ExtractedMemory(
                memory_type=normalize_memory_type(item.get("memory_type")),
                content=content[:1200],
                importance=importance_int,
                meta={"extractor": "openai"},
            )
        )
    return memories[:5]


def _heuristic_extract(user_message: str) -> list[ExtractedMemory]:
    text = user_message.strip()
    lowered = text.lower()
    if len(text) < 12:
        return []

    rules = [
        ("career_goal", ["my goal is", "i want to become", "career goal", "target role"]),
        ("personal_preference", ["i prefer", "i like", "i don't like", "i work best"]),
        ("project", ["i am working on", "my project", "building", "launching"]),
        ("skill", ["i know", "i can", "i'm learning", "learning", "skill"]),
        ("task", ["remember to", "i need to", "todo", "to do"]),
        ("document", ["resume", "document", "pdf", "report", "notes"]),
        ("important_fact", ["remember that", "important", "my name is", "i live in"]),
    ]
    for memory_type, markers in rules:
        if any(marker in lowered for marker in markers):
            return [ExtractedMemory(memory_type=memory_type, content=text[:1200], importance=4, meta={"extractor": "heuristic"})]
    return []


def save_memory(
    db: Session,
    user: User,
    content: str,
    memory_type: str = "important_fact",
    importance: int = 3,
    source: str = "chat",
    meta: dict[str, Any] | None = None,
) -> Memory:
    vector_id = str(uuid.uuid4())
    memory = Memory(
        user_id=user.id,
        category=normalize_memory_type(memory_type),
        content=content,
        importance=max(1, min(5, importance)),
        source=source,
        vector_id=vector_id,
        meta=meta or {},
    )
    db.add(memory)
    db.flush()
    upsert_memory_vector(memory)
    return memory


def upsert_memory_vector(memory: Memory) -> None:
    vector = embed_text(memory.content)
    if vector is None:
        return
    try:
        client = _qdrant_client()
        if client is None:
            return
        _ensure_collection(client)
        client.upsert(
            collection_name=get_settings().qdrant_collection,
            points=[
                PointStruct(
                    id=memory.vector_id or str(memory.id),
                    vector=vector,
                    payload={
                        "memory_id": str(memory.id),
                        "user_id": str(memory.user_id),
                        "category": memory.category,
                        "importance": memory.importance,
                        "source": memory.source,
                    },
                )
            ],
        )
    except Exception:
        return


def delete_memory_vector(memory: Memory) -> None:
    try:
        client = _qdrant_client()
        if client is None or not memory.vector_id:
            return
        client.delete(collection_name=get_settings().qdrant_collection, points_selector=[memory.vector_id])
    except Exception:
        return


def retrieve_relevant_memories(db: Session, user: User, query: str, limit: int = 8) -> list[Memory]:
    vector = embed_text(query)
    if vector is not None:
        try:
            client = _qdrant_client()
            if client is not None:
                _ensure_collection(client)
                hits = client.search(
                    collection_name=get_settings().qdrant_collection,
                    query_vector=vector,
                    query_filter=Filter(must=[FieldCondition(key="user_id", match=MatchValue(value=str(user.id)))]),
                    limit=limit,
                )
                ids = [uuid.UUID(str(hit.payload["memory_id"])) for hit in hits if hit.payload and hit.payload.get("memory_id")]
                if ids:
                    memories = list(db.scalars(select(Memory).where(Memory.user_id == user.id, Memory.id.in_(ids))))
                    by_id = {memory.id: memory for memory in memories}
                    return [by_id[memory_id] for memory_id in ids if memory_id in by_id]
        except Exception:
            pass

    return list(
        db.scalars(
            select(Memory)
            .where(Memory.user_id == user.id)
            .order_by(Memory.importance.desc(), Memory.updated_at.desc())
            .limit(limit)
        )
    )


def auto_save_memories_from_chat(db: Session, user: User, user_message: str) -> list[Memory]:
    saved: list[Memory] = []
    for extracted in extract_memories_from_chat(user_message):
        duplicate = db.scalar(
            select(Memory).where(
                Memory.user_id == user.id,
                Memory.category == extracted.memory_type,
                Memory.content == extracted.content,
            )
        )
        if duplicate is not None:
            continue
        saved.append(
            save_memory(
                db=db,
                user=user,
                content=extracted.content,
                memory_type=extracted.memory_type,
                importance=extracted.importance,
                source="chat",
                meta=extracted.meta,
            )
        )
    return saved