from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models import AgentStatus, DocumentStatus, GoalStatus, MemoryType, TaskPriority, TaskStatus


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=160)
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=160)
    role: str | None = None


class UserRead(BaseModel):
    id: UUID
    email: EmailStr
    clerk_user_id: str | None = None
    full_name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ClerkProfileSync(BaseModel):
    clerk_user_id: str
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=160)
    image_url: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserSettingsUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=160)
    ai_preferences: dict[str, Any] | None = None
    memory_enabled: bool | None = None
    theme: str | None = Field(default=None, pattern="^(light|dark|system)$")
    dev_api_keys: dict[str, str] | None = None


class UserSettingsRead(BaseModel):
    user: UserRead
    ai_preferences: dict[str, Any] = Field(default_factory=dict)
    memory_enabled: bool = True
    theme: str = "system"
    dev_api_keys: dict[str, str] = Field(default_factory=dict)
    updated_at: datetime


class DeleteAccountRequest(BaseModel):
    confirmation: str

class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    conversation_id: UUID | None = None


class ConversationCreate(BaseModel):
    title: str = "New conversation"


class ConversationUpdate(BaseModel):
    title: str | None = None


class ConversationRead(BaseModel):
    id: UUID
    title: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    conversation_id: UUID
    role: str
    content: str
    meta: dict[str, Any] = Field(default_factory=dict)


class MessageUpdate(BaseModel):
    content: str | None = None
    meta: dict[str, Any] | None = None


class MessageRead(BaseModel):
    id: UUID
    role: str
    content: str
    meta: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatResponse(BaseModel):
    conversation_id: UUID
    answer: str
    messages: list[MessageRead]


class MemoryCreate(BaseModel):
    category: MemoryType = MemoryType.important_fact
    content: str
    importance: int = Field(default=3, ge=1, le=5)
    source: str = "manual"
    meta: dict[str, Any] = Field(default_factory=dict)


class MemoryUpdate(BaseModel):
    category: MemoryType | None = None
    content: str | None = None
    importance: int | None = Field(default=None, ge=1, le=5)
    source: str | None = None
    meta: dict[str, Any] | None = None


class MemoryRead(MemoryCreate):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=220)
    notes: str = ""
    priority: TaskPriority = TaskPriority.medium
    due_at: datetime | None = None
    goal_id: UUID | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=220)
    notes: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_at: datetime | None = None
    goal_id: UUID | None = None


class TaskRead(TaskCreate):
    id: UUID
    status: TaskStatus
    goal_title: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskSuggestion(BaseModel):
    title: str
    notes: str = ""
    priority: TaskPriority = TaskPriority.medium
    due_at: datetime | None = None
    goal_id: UUID | None = None
    goal_title: str | None = None


class TaskSuggestionsResponse(BaseModel):
    suggestions: list[TaskSuggestion]


class GoalCreate(BaseModel):
    title: str
    why: str = ""
    metric: str = ""
    target_at: datetime | None = None


class GoalUpdate(BaseModel):
    title: str | None = None
    why: str | None = None
    metric: str | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    status: GoalStatus | None = None
    target_at: datetime | None = None


class GoalRead(GoalCreate):
    id: UUID
    progress: int
    status: GoalStatus
    created_at: datetime

    model_config = {"from_attributes": True}



class GoalMilestoneCreate(BaseModel):
    title: str = Field(min_length=1, max_length=220)
    description: str = ""
    target_at: datetime | None = None
    sort_order: int = 0


class GoalMilestoneUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=220)
    description: str | None = None
    target_at: datetime | None = None
    completed_at: datetime | None = None
    sort_order: int | None = None


class GoalMilestoneRead(GoalMilestoneCreate):
    id: UUID
    goal_id: UUID
    completed_at: datetime | None = None
    is_complete: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GoalRoadmapRequest(BaseModel):
    title: str = Field(min_length=1, max_length=220)
    timeframe: str = "6 months"
    current_level: str = "beginner"
    target_outcome: str = ""


class GoalRoadmapResponse(BaseModel):
    goal: GoalRead
    milestones: list[GoalMilestoneRead]


class MilestoneTaskResponse(BaseModel):
    task: TaskRead

class DocumentCreate(BaseModel):
    title: str
    file_name: str = ""
    mime_type: str = ""
    storage_url: str = ""
    summary: str = ""
    extracted_text: str = ""
    status: DocumentStatus = DocumentStatus.uploaded
    meta: dict[str, Any] = Field(default_factory=dict)


class DocumentUpdate(BaseModel):
    title: str | None = None
    file_name: str | None = None
    mime_type: str | None = None
    storage_url: str | None = None
    summary: str | None = None
    extracted_text: str | None = None
    status: DocumentStatus | None = None
    meta: dict[str, Any] | None = None


class DocumentRead(DocumentCreate):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentCopilotRequest(BaseModel):
    action: str = Field(pattern="^(summary|question|notes|action_items)$")
    question: str = ""


class DocumentCopilotResponse(BaseModel):
    action: str
    title: str
    answer: str = ""
    items: list[dict[str, str]] = Field(default_factory=list)

class JobMatchCreate(BaseModel):
    company: str
    title: str
    location: str = ""
    url: str = ""
    match_score: int = Field(default=0, ge=0, le=100)
    status: str = "saved"
    notes: str = ""
    meta: dict[str, Any] = Field(default_factory=dict)


class JobMatchUpdate(BaseModel):
    company: str | None = None
    title: str | None = None
    location: str | None = None
    url: str | None = None
    match_score: int | None = Field(default=None, ge=0, le=100)
    status: str | None = None
    notes: str | None = None
    meta: dict[str, Any] | None = None


class JobMatchRead(JobMatchCreate):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ResumeVersionCreate(BaseModel):
    title: str
    target_role: str = ""
    content: str = ""
    version: int = Field(default=1, ge=1)
    is_active: bool = False
    meta: dict[str, Any] = Field(default_factory=dict)


class ResumeVersionUpdate(BaseModel):
    title: str | None = None
    target_role: str | None = None
    content: str | None = None
    version: int | None = Field(default=None, ge=1)
    is_active: bool | None = None
    meta: dict[str, Any] | None = None


class ResumeVersionRead(ResumeVersionCreate):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgentCreate(BaseModel):
    name: str
    purpose: str = ""
    status: AgentStatus = AgentStatus.idle
    instructions: str = ""
    tools: list[str] = Field(default_factory=list)
    schedule: dict[str, Any] = Field(default_factory=dict)
    last_run_at: datetime | None = None


class AgentUpdate(BaseModel):
    name: str | None = None
    purpose: str | None = None
    status: AgentStatus | None = None
    instructions: str | None = None
    tools: list[str] | None = None
    schedule: dict[str, Any] | None = None
    last_run_at: datetime | None = None


class AgentRead(AgentCreate):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductivityAgentRequest(BaseModel):
    focus: str = ""
    timeframe: str = "today"
    context: str = ""


class ProductivityAgentResult(BaseModel):
    title: str
    summary: str
    priorities: list[dict[str, Any]] = Field(default_factory=list)
    daily_focus_list: list[dict[str, Any]] = Field(default_factory=list)
    procrastination_patterns: list[dict[str, str]] = Field(default_factory=list)
    improvement_plan: list[dict[str, str]] = Field(default_factory=list)
    weekly_summary: dict[str, Any] = Field(default_factory=dict)
    suggested_tasks: list[dict[str, str]] = Field(default_factory=list)
    notes: str = ""


class ProductivityAgentResponse(BaseModel):
    agent: AgentRead
    result: ProductivityAgentResult


class ProductivityConvertRequest(BaseModel):
    mode: str = Field(pattern="^(notes|tasks)$")
    result: ProductivityAgentResult

class StudyAgentRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=300)
    level: str = "beginner"
    goal: str = ""
    time_available: str = "45 minutes per day"
    context: str = ""


class StudyAgentResult(BaseModel):
    topic: str
    title: str
    simple_explanation: str
    study_plan: list[dict[str, str]] = Field(default_factory=list)
    quiz: list[dict[str, Any]] = Field(default_factory=list)
    flashcards: list[dict[str, str]] = Field(default_factory=list)
    weak_areas: list[dict[str, str]] = Field(default_factory=list)
    daily_tasks: list[dict[str, str]] = Field(default_factory=list)
    notes: str = ""


class StudyAgentResponse(BaseModel):
    agent: AgentRead
    result: StudyAgentResult


class StudyConvertRequest(BaseModel):
    mode: str = Field(pattern="^(notes|tasks)$")
    result: StudyAgentResult

class ResearchAgentRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=300)
    depth: str = "practical"
    context: str = ""


class ResearchAgentResult(BaseModel):
    topic: str
    title: str
    summary: str
    key_points: list[str] = Field(default_factory=list)
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)
    learning_roadmap: list[dict[str, str]] = Field(default_factory=list)
    suggested_tasks: list[dict[str, str]] = Field(default_factory=list)
    notes: str = ""


class ResearchAgentResponse(BaseModel):
    agent: AgentRead
    result: ResearchAgentResult


class ResearchConvertRequest(BaseModel):
    mode: str = Field(pattern="^(notes|tasks)$")
    result: ResearchAgentResult

class AgentRunRequest(BaseModel):
    agent_type: str = Field(pattern="^(career|study|research|productivity|document)$")
    objective: str = Field(min_length=1, max_length=1200)
    context: str = ""
    tool_preferences: list[str] = Field(default_factory=list)


class AgentRunResponse(BaseModel):
    agent: AgentRead
    output: dict[str, Any]

class DailyPlanGenerateRequest(BaseModel):
    plan_date: datetime
    daily_goals: list[str] = Field(default_factory=list)
    start_time: str = "09:00"
    end_time: str = "18:00"
    energy: str = "balanced"
    include_task_ids: list[UUID] = Field(default_factory=list)
    include_goal_ids: list[UUID] = Field(default_factory=list)


class DailyPlanReviewRequest(BaseModel):
    accomplished: str = ""
    blockers: str = ""
    mood: str = "steady"
    notes: str = ""
    completed_task_ids: list[UUID] = Field(default_factory=list)


class DailyPlanGenerateResponse(BaseModel):
    focus: str
    agenda: list[dict[str, Any]] = Field(default_factory=list)
    morning_plan: str = ""
    score: int = Field(default=0, ge=0, le=100)


class DailyPlanReviewResponse(BaseModel):
    reflection: str
    score: int = Field(default=0, ge=0, le=100)
    wins: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)

class DailyPlanCreate(BaseModel):
    plan_date: datetime
    focus: str = ""
    agenda: list[dict[str, Any]] = Field(default_factory=list)
    reflection: str = ""
    score: int = Field(default=0, ge=0, le=100)


class DailyPlanUpdate(BaseModel):
    plan_date: datetime | None = None
    focus: str | None = None
    agenda: list[dict[str, Any]] | None = None
    reflection: str | None = None
    score: int | None = Field(default=None, ge=0, le=100)


class DailyPlanRead(DailyPlanCreate):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}



class CareerCopilotRequest(BaseModel):
    tool: str
    target_role: str = "AI Engineer"
    resume_text: str = ""
    resume_data: dict[str, Any] = Field(default_factory=dict)
    job_description: str = ""
    focus: str = ""


class CareerCopilotResponse(BaseModel):
    tool: str
    title: str
    summary: str
    score: int | None = None
    items: list[dict[str, Any]] = Field(default_factory=list)
    content: str = ""

class CareerProfileUpsert(BaseModel):
    current_role: str = ""
    target_role: str = ""
    strengths: list[str] = Field(default_factory=list)
    growth_areas: list[str] = Field(default_factory=list)
    roadmap: list[str] = Field(default_factory=list)


class CareerProfileRead(CareerProfileUpsert):
    id: UUID
    updated_at: datetime

    model_config = {"from_attributes": True}


class BillingCheckoutRequest(BaseModel):
    plan: str = Field(pattern="^(pro|premium|enterprise)$")


class BillingCheckoutResponse(BaseModel):
    url: str


class BillingPortalResponse(BaseModel):
    url: str


class SubscriptionRead(BaseModel):
    plan: str
    status: str
    limits: dict[str, Any]
    current_period_end: datetime | None = None
    cancel_at_period_end: bool = False
    stripe_customer_id: str | None = None


class UsageRead(BaseModel):
    plan: str
    usage: dict[str, int]
    limits: dict[str, Any]
