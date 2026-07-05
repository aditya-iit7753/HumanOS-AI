import json
import logging
from openai import OpenAI

from app.config import get_settings
from app.models import Memory, Task, Goal


logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are HumanOS AI, a private life and career copilot.
Be concise, emotionally intelligent, practical, and action-oriented.
Use the user's long-term memory, tasks, and goals when helpful.
Never claim you performed real-world actions outside the app."""


def build_context(memories: list[Memory], tasks: list[Task], goals: list[Goal]) -> str:
    memory_lines = [f"- [{getattr(m.category, 'value', m.category)}] {m.content}" for m in memories[:8]]
    task_lines = [f"- {t.title} ({t.status.value}, priority {t.priority})" for t in tasks[:8]]
    goal_lines = [f"- {g.title}: {g.progress}% ({g.status.value})" for g in goals[:8]]
    return "\n".join(
        [
            "Long-term memory:",
            *memory_lines,
            "Open tasks:",
            *task_lines,
            "Goals:",
            *goal_lines,
        ]
    )


def _chat_fallback(user_message: str) -> str:
    return (
        "I can help with that. Your AI provider is currently unavailable or out of quota, "
        "so I am using HumanOS fallback mode. Here is a practical next step: clarify the outcome, "
        "choose the smallest visible action, and schedule it today. "
        f"Based on your note: {user_message}"
    )



def _chat_models(settings) -> list[str]:
    candidates = [
        settings.openai_chat_model,
        "gpt-4.1-mini",
        "gpt-4.1-nano",
        "gpt-4o-mini",
    ]
    models: list[str] = []
    for model in candidates:
        if model and model not in models:
            models.append(model)
    return models
def generate_answer(user_message: str, context: str) -> str:
    settings = get_settings()
    if not settings.openai_api_key or settings.openai_api_key == "replace-me":
        return _chat_fallback(user_message)

    client = OpenAI(api_key=settings.openai_api_key)
    for model in _chat_models(settings):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "system", "content": context},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.5,
            )
            return response.choices[0].message.content or _chat_fallback(user_message)
        except Exception:
            logger.exception("OpenAI chat completion failed for model %s", model)
    return _chat_fallback(user_message)

def maybe_extract_memory(user_message: str) -> str | None:
    lowered = user_message.lower()
    markers = ["remember that", "my goal is", "i want to become", "i prefer", "i am working on"]
    if any(marker in lowered for marker in markers):
        return user_message.strip()
    return None



def stream_answer(user_message: str, context: str):
    settings = get_settings()
    if not settings.openai_api_key or settings.openai_api_key == "replace-me":
        for word in _chat_fallback(user_message).split(" "):
            yield word + " "
        return

    client = OpenAI(api_key=settings.openai_api_key)
    for model in _chat_models(settings):
        try:
            stream = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "system", "content": context},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.5,
                stream=True,
            )
            for chunk in stream:
                token = chunk.choices[0].delta.content
                if token:
                    yield token
            return
        except Exception:
            logger.exception("OpenAI streaming chat failed for model %s", model)
    for word in _chat_fallback(user_message).split(" "):
        yield word + " "

def suggest_tasks(goals: list[Goal], existing_tasks: list[Task], focus: str = "") -> list[dict]:
    settings = get_settings()
    open_goal_titles = [goal.title for goal in goals[:6]]
    existing_titles = [task.title for task in existing_tasks[:12]]

    if not settings.openai_api_key or settings.openai_api_key in {"replace-me", "sk-xxxxxxxx"}:
        if open_goal_titles:
            return [
                {
                    "title": f"Move forward: {title}",
                    "notes": "Pick one concrete next action and finish it in a focused work block.",
                    "priority": "high" if index == 0 else "medium",
                    "goal_title": title,
                }
                for index, title in enumerate(open_goal_titles[:3])
            ]
        return [
            {"title": "Choose today's highest leverage outcome", "notes": "Write the result that would make today feel successful.", "priority": "high"},
            {"title": "Clear one small open loop", "notes": "Finish a task that takes less than 20 minutes.", "priority": "medium"},
            {"title": "Plan tomorrow's first work block", "notes": "Define the first action before the day starts.", "priority": "low"},
        ]

    client = OpenAI(api_key=settings.openai_api_key)
    prompt = {
        "focus": focus,
        "goals": open_goal_titles,
        "existing_tasks": existing_titles,
        "instructions": "Suggest 3 practical tasks. Return JSON with a suggestions array. Each item: title, notes, priority low|medium|high, optional goal_title matching one provided goal.",
    }
    try:
        response = client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=[
                {"role": "system", "content": "You create concise, useful task suggestions for a life and career copilot."},
                {"role": "user", "content": json.dumps(prompt)},
            ],
            temperature=0.4,
            response_format={"type": "json_object"},
        )
        payload = json.loads(response.choices[0].message.content or "{}")
        suggestions = payload.get("suggestions", [])
        if isinstance(suggestions, list):
            return suggestions[:5]
    except Exception:
        pass
    return []

def generate_goal_roadmap(title: str, timeframe: str = "6 months", current_level: str = "beginner", target_outcome: str = "") -> list[dict]:
    settings = get_settings()
    fallback = [
        {"title": "Month 1: Python and developer foundations", "description": "Build fluency with Python, Git, terminal workflows, APIs, and basic software design.", "offset_weeks": 4},
        {"title": "Month 2: Machine learning fundamentals", "description": "Learn supervised learning, evaluation, data preparation, notebooks, and core ML libraries.", "offset_weeks": 8},
        {"title": "Month 3: Deep learning and LLM basics", "description": "Study neural networks, transformers, embeddings, prompting, and model limitations.", "offset_weeks": 12},
        {"title": "Month 4: Build AI portfolio projects", "description": "Ship two practical projects: an AI assistant and a document or workflow copilot.", "offset_weeks": 16},
        {"title": "Month 5: Production AI engineering", "description": "Practice FastAPI, vector databases, auth, observability, evals, deployment, and cost control.", "offset_weeks": 20},
        {"title": "Month 6: Career launch", "description": "Polish resume, case studies, GitHub, interview stories, and apply to targeted AI engineer roles.", "offset_weeks": 24},
    ]
    if not settings.openai_api_key or settings.openai_api_key in {"replace-me", "sk-xxxxxxxx"}:
        return fallback

    client = OpenAI(api_key=settings.openai_api_key)
    prompt = {
        "goal": title,
        "timeframe": timeframe,
        "current_level": current_level,
        "target_outcome": target_outcome,
        "instructions": "Create 4-8 milestone roadmap items. Return JSON with milestones array. Each item: title, description, offset_weeks integer.",
    }
    try:
        response = client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=[
                {"role": "system", "content": "You create practical milestone roadmaps for long-term life and career goals."},
                {"role": "user", "content": json.dumps(prompt)},
            ],
            temperature=0.35,
            response_format={"type": "json_object"},
        )
        payload = json.loads(response.choices[0].message.content or "{}")
        milestones = payload.get("milestones", [])
        if isinstance(milestones, list) and milestones:
            return milestones[:8]
    except Exception:
        pass
    return fallback

def generate_career_copilot(tool: str, context: dict) -> dict:
    profile = context.get("profile") or {}
    target_role = context.get("target_role") or profile.get("target_role") or "AI Engineer"
    skills = profile.get("strengths") or []
    gaps = profile.get("growth_areas") or ["model evaluation", "vector databases", "production deployment"]
    goals = context.get("goals") or []
    memories = context.get("memories") or []
    resume_text = context.get("resume_text") or ""
    resume_data = context.get("resume_data") or {}
    job_description = context.get("job_description") or ""

    def _clean_lines(value) -> list[str]:
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        return [line.strip() for line in str(value or "").replace(";", "\n").splitlines() if line.strip()]

    def _ats_resume() -> str:
        name = resume_data.get("name") or "Your Name"
        headline = resume_data.get("headline") or target_role
        contact = resume_data.get("contact") or "email@example.com | LinkedIn | GitHub | Portfolio"
        education = _clean_lines(resume_data.get("education"))
        skills_input = _clean_lines(resume_data.get("skills")) or skills
        projects_input = _clean_lines(resume_data.get("projects"))
        experience = _clean_lines(resume_data.get("experience"))
        summary = resume_data.get("summary") or f"{target_role} candidate with hands-on experience building AI-enabled products, backend APIs, data workflows, and user-facing software. Strong foundation in {', '.join(skills_input[:6]) if skills_input else 'Python, TypeScript, APIs, and AI systems'}."
        sections = [
            str(name).upper(),
            f"{headline}",
            str(contact),
            "",
            "SUMMARY",
            str(summary),
            "",
            "SKILLS",
            ", ".join(skills_input[:18]) if skills_input else "Python, TypeScript, FastAPI, Next.js, PostgreSQL, OpenAI APIs, Vector Search, Docker",
        ]
        if experience:
            sections += ["", "EXPERIENCE"] + [f"- {item}" for item in experience[:6]]
        if projects_input:
            sections += ["", "PROJECTS"] + [f"- {item}" for item in projects_input[:6]]
        if education:
            sections += ["", "EDUCATION"] + [f"- {item}" for item in education[:4]]
        sections += ["", "TARGET ROLE KEYWORDS", f"{target_role}, LLM applications, RAG, model evaluation, API integration, production deployment, collaboration, problem solving"]
        return "\n".join(sections)

    def fallback() -> dict:
        base_items = [
            {"title": "Ship an AI assistant", "description": "Build a full-stack assistant with auth, chat history, memory, and streaming responses."},
            {"title": "Learn production RAG", "description": "Practice embeddings, Qdrant retrieval, chunking, evals, and source-grounded answers."},
            {"title": "Prepare interview stories", "description": "Write STAR stories for debugging, model tradeoffs, deployment, and product judgment."},
        ]
        if tool == "resume_builder":
            content = _ats_resume()
            return {"tool": tool, "title": "ATS resume builder", "summary": f"Generated a one-page ATS resume for {target_role}.", "content": content, "items": base_items}
        if tool == "ats_score":
            score = 72 + min(15, len(resume_text) // 600) + (8 if job_description else 0)
            return {"tool": tool, "title": "ATS score checker", "summary": "Resume is directionally aligned but needs more job-specific keywords and measurable outcomes.", "score": min(score, 95), "items": [{"title": "Add keywords", "description": f"Mirror terms for {target_role}: LLMs, APIs, evaluation, deployment, RAG, observability."}, {"title": "Quantify impact", "description": "Add numbers for latency, users, cost, accuracy, or shipped features."}]}
        if tool == "skill_gap":
            return {"tool": tool, "title": "Skill gap analyzer", "summary": f"To reach {target_role}, close the highest leverage gaps first.", "items": [{"title": gap, "description": "Create a small project or proof point that demonstrates this skill."} for gap in gaps[:6]]}
        if tool == "role_recommender":
            return {"tool": tool, "title": "AI/ML role recommender", "summary": "Best-fit roles based on your current HumanOS profile.", "items": [{"title": "AI Engineer", "description": "Strong fit for full-stack AI product building and API integration."}, {"title": "LLM Application Engineer", "description": "Good match for RAG, agents, prompt workflows, and productized AI features."}, {"title": "ML Platform Engineer", "description": "Stretch role if you deepen infra, evals, and model deployment."}]}
        if tool == "interview_questions":
            return {"tool": tool, "title": "Interview question generator", "summary": f"Practice questions for {target_role} interviews.", "items": [{"title": "System design", "description": "Design a RAG assistant for private documents with auth, memory, and evaluation."}, {"title": "LLM tradeoffs", "description": "When would you use fine-tuning versus retrieval versus prompt engineering?"}, {"title": "Debugging", "description": "A streaming chat endpoint is slow and occasionally drops messages. How do you investigate?"}]}
        if tool == "project_recommender":
            return {"tool": tool, "title": "Project recommendation engine", "summary": "Portfolio projects that prove readiness.", "items": base_items}
        return {"tool": tool, "title": "Career roadmap generator", "summary": f"Roadmap toward {target_role} personalized from goals and memory.", "items": [{"title": "Weeks 1-4", "description": "Strengthen Python, APIs, data handling, and one polished GitHub project."}, {"title": "Weeks 5-8", "description": "Build RAG with Qdrant, evals, and document ingestion."}, {"title": "Weeks 9-12", "description": "Ship a deployable AI app and write a case study."}, {"title": "Weeks 13-24", "description": "Apply, interview, and iterate resume/portfolio weekly."}]}

    settings = get_settings()
    if not settings.openai_api_key or settings.openai_api_key in {"replace-me", "sk-xxxxxxxx"}:
        return fallback()

    client = OpenAI(api_key=settings.openai_api_key)
    prompt = {
        "tool": tool,
        "target_role": target_role,
        "profile": profile,
        "skills": skills,
        "goals": goals,
        "memories": memories,
        "resume_text": resume_text[:5000],
        "job_description": job_description[:5000],
        "instructions": "Return JSON with title, summary, optional score 0-100, items array of title/description, and optional content for resume text. Be specific and practical.",
    }
    try:
        response = client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=[
                {"role": "system", "content": "You are HumanOS AI Career Copilot. Give concrete, personalized, career-useful output as JSON."},
                {"role": "user", "content": json.dumps(prompt)},
            ],
            temperature=0.35,
            response_format={"type": "json_object"},
        )
        payload = json.loads(response.choices[0].message.content or "{}")
        return {"tool": tool, "title": payload.get("title", tool), "summary": payload.get("summary", ""), "score": payload.get("score"), "items": payload.get("items", []), "content": payload.get("content", "")}
    except Exception:
        return fallback()



def generate_daily_schedule(context: dict) -> dict:
    settings = get_settings()
    daily_goals = [str(goal).strip() for goal in context.get("daily_goals", []) if str(goal).strip()]
    tasks = context.get("tasks") or []
    goals = context.get("goals") or []
    start_time = context.get("start_time") or "09:00"
    end_time = context.get("end_time") or "18:00"
    energy = context.get("energy") or "balanced"

    def fallback() -> dict:
        focus = daily_goals[0] if daily_goals else (goals[0].get("title") if goals else "Protect the highest leverage outcome")
        task_blocks = tasks[:4]
        agenda = [
            {"start": start_time, "end": "09:20", "title": "Morning plan", "type": "planning", "description": "Review goals, pick the main win, and clear friction before starting.", "priority": "high"},
            {"start": "09:20", "end": "11:00", "title": focus, "type": "deep_work", "description": "Work on the most important daily goal with notifications off.", "priority": "high", "goal_id": goals[0].get("id") if goals else None},
            {"start": "11:15", "end": "12:15", "title": task_blocks[0].get("title") if task_blocks else "Complete one open task", "type": "task", "description": task_blocks[0].get("notes", "Close one visible loop before lunch.") if task_blocks else "Close one visible loop before lunch.", "priority": task_blocks[0].get("priority", "medium") if task_blocks else "medium", "task_id": task_blocks[0].get("id") if task_blocks else None},
            {"start": "13:30", "end": "15:00", "title": task_blocks[1].get("title") if len(task_blocks) > 1 else "Build career or study momentum", "type": "focus", "description": task_blocks[1].get("notes", "Advance one meaningful project, portfolio item, or study block.") if len(task_blocks) > 1 else "Advance one meaningful project, portfolio item, or study block.", "priority": task_blocks[1].get("priority", "medium") if len(task_blocks) > 1 else "medium", "task_id": task_blocks[1].get("id") if len(task_blocks) > 1 else None},
            {"start": "15:20", "end": "16:20", "title": task_blocks[2].get("title") if len(task_blocks) > 2 else "Admin and communication", "type": "task", "description": task_blocks[2].get("notes", "Handle messages, logistics, and short tasks in one contained block.") if len(task_blocks) > 2 else "Handle messages, logistics, and short tasks in one contained block.", "priority": task_blocks[2].get("priority", "low") if len(task_blocks) > 2 else "low", "task_id": task_blocks[2].get("id") if len(task_blocks) > 2 else None},
            {"start": "17:15", "end": end_time, "title": "Evening review", "type": "review", "description": "Record wins, blockers, carryovers, and tomorrow's first move.", "priority": "medium"},
        ]
        return {
            "focus": focus,
            "agenda": agenda,
            "morning_plan": f"Start with one clear win: {focus}. Keep the day {energy}, protect deep work, and leave an honest evening review.",
            "score": 72,
        }

    if not settings.openai_api_key or settings.openai_api_key in {"replace-me", "sk-xxxxxxxx"}:
        return fallback()

    client = OpenAI(api_key=settings.openai_api_key)
    prompt = {
        "daily_goals": daily_goals,
        "tasks": tasks[:12],
        "goals": goals[:8],
        "start_time": start_time,
        "end_time": end_time,
        "energy": energy,
        "instructions": "Create a practical time-blocked daily schedule. Return JSON: focus string, morning_plan string, score integer 0-100, agenda array. Agenda items: start, end, title, type, description, priority low|medium|high, optional task_id, optional goal_id.",
    }
    try:
        response = client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=[
                {"role": "system", "content": "You are HumanOS Daily Planner. Build realistic, humane time-blocked plans connected to tasks and goals."},
                {"role": "user", "content": json.dumps(prompt)},
            ],
            temperature=0.35,
            response_format={"type": "json_object"},
        )
        payload = json.loads(response.choices[0].message.content or "{}")
        agenda = payload.get("agenda", [])
        if isinstance(agenda, list) and agenda:
            return {
                "focus": str(payload.get("focus") or fallback()["focus"]),
                "agenda": agenda[:12],
                "morning_plan": str(payload.get("morning_plan") or ""),
                "score": max(0, min(100, int(payload.get("score") or 75))),
            }
    except Exception:
        pass
    return fallback()


def generate_evening_review(plan: dict, review: dict) -> dict:
    settings = get_settings()
    accomplished = review.get("accomplished", "")
    blockers = review.get("blockers", "")
    completed_count = len(review.get("completed_task_ids") or [])
    agenda_count = len(plan.get("agenda") or [])
    base_score = min(100, 45 + completed_count * 12 + (15 if accomplished else 0) - (8 if blockers else 0))

    def fallback() -> dict:
        wins = [item.strip() for item in accomplished.replace(";", "\n").splitlines() if item.strip()][:4]
        improvements = [item.strip() for item in blockers.replace(";", "\n").splitlines() if item.strip()][:4]
        if not wins:
            wins = ["Completed an honest review and preserved learning from the day."]
        if not improvements:
            improvements = ["Choose tomorrow's first block before starting reactive work."]
        reflection = "Wins: " + "; ".join(wins) + "\nNext improvement: " + improvements[0]
        return {"reflection": reflection, "score": base_score, "wins": wins, "improvements": improvements}

    if not settings.openai_api_key or settings.openai_api_key in {"replace-me", "sk-xxxxxxxx"}:
        return fallback()

    client = OpenAI(api_key=settings.openai_api_key)
    prompt = {"plan": plan, "review": review, "agenda_count": agenda_count, "instructions": "Generate a concise evening review. Return JSON: reflection, score 0-100, wins array, improvements array."}
    try:
        response = client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=[
                {"role": "system", "content": "You write practical evening reviews that are honest, kind, and action-oriented."},
                {"role": "user", "content": json.dumps(prompt)},
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        payload = json.loads(response.choices[0].message.content or "{}")
        return {
            "reflection": str(payload.get("reflection") or fallback()["reflection"]),
            "score": max(0, min(100, int(payload.get("score") or base_score))),
            "wins": [str(item) for item in payload.get("wins", [])][:6] if isinstance(payload.get("wins"), list) else [],
            "improvements": [str(item) for item in payload.get("improvements", [])][:6] if isinstance(payload.get("improvements"), list) else [],
        }
    except Exception:
        return fallback()



def generate_agent_action_plan(agent_type: str, context: dict) -> dict:
    settings = get_settings()
    objective = context.get("objective") or "Create an action plan"
    memories = context.get("memories") or []
    tasks = context.get("tasks") or []
    goals = context.get("goals") or []
    documents = context.get("documents") or []
    tool_preferences = context.get("tool_preferences") or []

    definitions = {
        "career": {"name": "Career Agent", "tools": ["resume_analysis", "skill_gap", "roadmap", "interview_prep"], "focus": "career progress, role targeting, portfolio proof, and applications"},
        "study": {"name": "Study Agent", "tools": ["study_plan", "notes", "quiz", "spaced_review"], "focus": "learning plans, study blocks, review loops, and comprehension"},
        "research": {"name": "Research Agent", "tools": ["research_brief", "source_synthesis", "questions", "decision_memo"], "focus": "research briefs, comparison, synthesis, and next questions"},
        "productivity": {"name": "Productivity Agent", "tools": ["task_triage", "daily_plan", "prioritization", "habit_loop"], "focus": "execution, prioritization, task cleanup, and daily momentum"},
        "document": {"name": "Document Agent", "tools": ["document_summary", "qa", "notes", "action_items"], "focus": "document analysis, notes, Q&A, and action extraction"},
    }
    definition = definitions.get(agent_type, definitions["productivity"])

    def fallback() -> dict:
        tools = tool_preferences or definition["tools"][:3]
        related_goal = goals[0].get("title") if goals else "HumanOS operating rhythm"
        steps = [
            {"title": "Clarify the target outcome", "description": f"Define what success looks like for: {objective}", "tool": tools[0] if tools else "planning", "priority": "high"},
            {"title": "Use saved context", "description": f"Apply relevant memories, goals, and open work to keep the plan personalized around {related_goal}.", "tool": tools[1] if len(tools) > 1 else "memory", "priority": "high"},
            {"title": "Create the next concrete artifact", "description": "Produce a draft, checklist, roadmap, summary, or schedule that can be acted on today.", "tool": tools[2] if len(tools) > 2 else "execution", "priority": "medium"},
            {"title": "Close the loop", "description": "Turn the highest leverage next step into a task, then review progress at the end of the day.", "tool": "tasks", "priority": "medium"},
        ]
        return {
            "agent_type": agent_type,
            "title": f"{definition['name']} action plan",
            "summary": f"A focused plan for {definition['focus']} using your HumanOS memory, tasks, goals, and documents.",
            "tools_used": tools,
            "action_plan": steps,
            "next_task": steps[0]["title"],
            "confidence": 78,
        }

    if not settings.openai_api_key or settings.openai_api_key in {"replace-me", "sk-xxxxxxxx"}:
        return fallback()

    client = OpenAI(api_key=settings.openai_api_key)
    prompt = {
        "agent_type": agent_type,
        "agent_definition": definition,
        "objective": objective,
        "user_context": context.get("context", ""),
        "tool_preferences": tool_preferences,
        "memories": memories[:12],
        "tasks": tasks[:12],
        "goals": goals[:8],
        "documents": documents[:8],
        "instructions": "Generate a personalized action plan. Return JSON with agent_type, title, summary, tools_used array, action_plan array of {title, description, tool, priority}, next_task, confidence 0-100.",
    }
    try:
        response = client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=[
                {"role": "system", "content": "You are a specialized HumanOS AI agent. Be practical, personalized, and action-oriented. Use the provided user memory and app context."},
                {"role": "user", "content": json.dumps(prompt)},
            ],
            temperature=0.35,
            response_format={"type": "json_object"},
        )
        payload = json.loads(response.choices[0].message.content or "{}")
        plan = payload.get("action_plan", [])
        if isinstance(plan, list) and plan:
            return {
                "agent_type": agent_type,
                "title": str(payload.get("title") or f"{definition['name']} action plan"),
                "summary": str(payload.get("summary") or ""),
                "tools_used": [str(tool) for tool in payload.get("tools_used", [])][:8] if isinstance(payload.get("tools_used"), list) else definition["tools"],
                "action_plan": plan[:10],
                "next_task": str(payload.get("next_task") or plan[0].get("title", "Start the first action")),
                "confidence": max(0, min(100, int(payload.get("confidence") or 80))),
            }
    except Exception:
        pass
    return fallback()



def generate_research_result(topic: str, context: dict) -> dict:
    settings = get_settings()
    memories = context.get("memories") or []
    documents = context.get("documents") or []
    user_context = context.get("context") or ""
    depth = context.get("depth") or "practical"

    def fallback() -> dict:
        key_points = [
            f"Define the core concepts and vocabulary around {topic}.",
            "Identify the strongest use cases, tradeoffs, and constraints before choosing a direction.",
            "Compare practical implementation options against cost, risk, time, and learning value.",
            "Turn the research into one visible artifact: notes, a decision memo, or a small project plan.",
        ]
        roadmap = [
            {"title": "Foundation", "description": f"Learn the basics, terms, and mental models for {topic}."},
            {"title": "Compare approaches", "description": "Map major options, strengths, weaknesses, and where each works best."},
            {"title": "Apply", "description": "Build a tiny proof of concept or write a one-page decision brief."},
            {"title": "Review", "description": "Create notes, questions, and next tasks from what changed your mind."},
        ]
        tasks = [
            {"title": f"Write a one-page research brief on {topic}", "notes": "Include summary, key points, pros/cons, and open questions.", "priority": "high"},
            {"title": f"Create a learning map for {topic}", "notes": "Break the topic into foundation, examples, practice, and review.", "priority": "medium"},
            {"title": f"Build or inspect one practical example of {topic}", "notes": "Use the example to test assumptions from the research.", "priority": "medium"},
        ]
        summary = f"{topic} is best approached by separating fundamentals, practical use cases, tradeoffs, and a small application step. For HumanOS, the most useful research output is one that becomes notes and tasks, not just reading material."
        return {
            "topic": topic,
            "title": f"Research brief: {topic}",
            "summary": summary,
            "key_points": key_points,
            "pros": ["Creates clearer decisions", "Surfaces implementation tradeoffs", "Can become tasks and study notes quickly"],
            "cons": ["May require source verification", "Can sprawl without a tight question", "Needs follow-up practice to become usable skill"],
            "learning_roadmap": roadmap,
            "suggested_tasks": tasks,
            "notes": f"# {topic}\n\n## Summary\n{summary}\n\n## Key points\n" + "\n".join(f"- {point}" for point in key_points),
        }

    if not settings.openai_api_key or settings.openai_api_key in {"replace-me", "sk-xxxxxxxx"}:
        return fallback()

    client = OpenAI(api_key=settings.openai_api_key)
    prompt = {
        "topic": topic,
        "depth": depth,
        "user_context": user_context,
        "memories": memories[:12],
        "documents": documents[:8],
        "instructions": "Create a research result. Return JSON with topic, title, summary, key_points array, pros array, cons array, learning_roadmap array of {title, description}, suggested_tasks array of {title, notes, priority}, and notes markdown. Do not invent citations or claim web browsing.",
    }
    try:
        response = client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=[
                {"role": "system", "content": "You are HumanOS Research Agent. Create concise, grounded research summaries from provided user context, memory, and documents. Be explicit about uncertainty."},
                {"role": "user", "content": json.dumps(prompt)},
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        payload = json.loads(response.choices[0].message.content or "{}")
        result = fallback()
        result.update({key: payload[key] for key in result.keys() if key in payload})
        result["topic"] = topic
        return result
    except Exception:
        return fallback()



def generate_study_result(topic: str, context: dict) -> dict:
    settings = get_settings()
    level = context.get("level") or "beginner"
    goal = context.get("goal") or f"Understand {topic} well enough to explain it and apply it."
    time_available = context.get("time_available") or "45 minutes per day"
    memories = context.get("memories") or []
    documents = context.get("documents") or []
    user_context = context.get("context") or ""

    def fallback() -> dict:
        explanation = f"{topic} is best learned by first understanding the plain-language idea, then practicing small examples, then checking what still feels fuzzy. At a {level} level, focus on vocabulary, mental models, and one practical use case before adding complexity."
        plan = [
            {"day": "Day 1", "title": "Build the foundation", "description": f"Learn the core terms and write a simple explanation of {topic}."},
            {"day": "Day 2", "title": "Work examples", "description": "Study 2-3 examples and mark where the logic changes."},
            {"day": "Day 3", "title": "Practice retrieval", "description": "Answer quiz questions without looking, then review mistakes."},
            {"day": "Day 4", "title": "Apply", "description": "Create a tiny project, diagram, or teaching note using the concept."},
            {"day": "Day 5", "title": "Review weak areas", "description": "Focus only on confusing parts and turn them into flashcards."},
        ]
        quiz = [
            {"question": f"What is the main idea behind {topic}?", "answer": "Explain the core concept in your own words.", "difficulty": "easy"},
            {"question": f"Where would {topic} be useful in a real project?", "answer": "Name a use case and why the concept helps.", "difficulty": "medium"},
            {"question": f"What is one common mistake when learning {topic}?", "answer": "Confusing vocabulary with understanding; practice with examples.", "difficulty": "medium"},
        ]
        flashcards = [
            {"front": f"What is {topic}?", "back": explanation[:260]},
            {"front": "How should I practice it?", "back": "Use examples, retrieve from memory, then build a tiny artifact."},
            {"front": "How do I know I understand it?", "back": "You can explain it simply, solve a small problem, and name tradeoffs."},
        ]
        weak = [
            {"area": "Core vocabulary", "fix": "Make flashcards for terms that feel vague."},
            {"area": "Application", "fix": "Build one small example instead of rereading notes."},
            {"area": "Recall", "fix": "Use short quizzes before reviewing the answer."},
        ]
        tasks = [
            {"title": f"Study {topic} for {time_available}", "notes": "Complete the next study block and write 3 takeaways.", "priority": "high"},
            {"title": f"Quiz yourself on {topic}", "notes": "Answer the generated quiz without notes, then review weak areas.", "priority": "medium"},
            {"title": f"Create flashcards for {topic}", "notes": "Add cards for definitions, examples, and common mistakes.", "priority": "medium"},
        ]
        return {
            "topic": topic,
            "title": f"Study plan: {topic}",
            "simple_explanation": explanation,
            "study_plan": plan,
            "quiz": quiz,
            "flashcards": flashcards,
            "weak_areas": weak,
            "daily_tasks": tasks,
            "notes": f"# {topic}\n\n## Simple explanation\n{explanation}\n\n## Goal\n{goal}\n\n## Study plan\n" + "\n".join(f"- {item['day']}: {item['title']} - {item['description']}" for item in plan),
        }

    if not settings.openai_api_key or settings.openai_api_key in {"replace-me", "sk-xxxxxxxx"}:
        return fallback()

    client = OpenAI(api_key=settings.openai_api_key)
    prompt = {
        "topic": topic,
        "level": level,
        "goal": goal,
        "time_available": time_available,
        "user_context": user_context,
        "memories": memories[:12],
        "documents": documents[:8],
        "instructions": "Create a personalized study result. Return JSON with topic, title, simple_explanation, study_plan array of {day,title,description}, quiz array of {question,answer,difficulty}, flashcards array of {front,back}, weak_areas array of {area,fix}, daily_tasks array of {title,notes,priority}, notes markdown.",
    }
    try:
        response = client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=[
                {"role": "system", "content": "You are HumanOS Study Agent. Teach simply, plan practically, and personalize using memory and documents."},
                {"role": "user", "content": json.dumps(prompt)},
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        payload = json.loads(response.choices[0].message.content or "{}")
        result = fallback()
        result.update({key: payload[key] for key in result.keys() if key in payload})
        result["topic"] = topic
        return result
    except Exception:
        return fallback()



def generate_productivity_result(context: dict) -> dict:
    settings = get_settings()
    focus = context.get("focus") or "Improve execution today"
    timeframe = context.get("timeframe") or "today"
    tasks = context.get("tasks") or []
    goals = context.get("goals") or []
    daily_plans = context.get("daily_plans") or []
    memories = context.get("memories") or []
    user_context = context.get("context") or ""

    incomplete = [task for task in tasks if task.get("status") != "done"]
    high = [task for task in incomplete if task.get("priority") == "high"]
    overdue_or_due = [task for task in incomplete if task.get("due_at")]

    def fallback() -> dict:
        top_tasks = high[:3] or incomplete[:3]
        priorities = [
            {
                "title": task.get("title", "Priority task"),
                "reason": task.get("notes") or "This task has the highest current leverage.",
                "priority": task.get("priority", "medium"),
                "task_id": task.get("id"),
            }
            for task in top_tasks
        ]
        if not priorities:
            priorities = [{"title": "Choose one visible outcome", "reason": "No incomplete tasks were found, so define a concrete win for today.", "priority": "high"}]
        focus_list = [
            {"title": item["title"], "time_block": block, "success_marker": "Finished or reduced to a clear next step."}
            for item, block in zip(priorities, ["First deep-work block", "Midday execution block", "Final cleanup block"])
        ]
        patterns = []
        if len(incomplete) >= 8:
            patterns.append({"pattern": "Too many open loops", "evidence": f"{len(incomplete)} incomplete tasks are active.", "fix": "Limit today to 3 priority tasks and defer the rest."})
        if overdue_or_due:
            patterns.append({"pattern": "Deadline clustering", "evidence": f"{len(overdue_or_due)} tasks have due dates attached.", "fix": "Handle due-date tasks before adding new work."})
        if not patterns:
            patterns.append({"pattern": "Context switching risk", "evidence": "Execution can drift when priorities are not explicitly time-blocked.", "fix": "Work from a short focus list and review it at day end."})
        improvement = [
            {"title": "Reduce the active list", "description": "Keep only the top 3 tasks visible until one is complete."},
            {"title": "Use a start ritual", "description": "Before work, write the next physical action and set a 45-minute timer."},
            {"title": "Close the loop", "description": "End the day by marking complete, deferring, or rewriting every active task."},
        ]
        done_count = len([task for task in tasks if task.get("status") == "done"])
        weekly = {
            "completed_tasks": done_count,
            "open_tasks": len(incomplete),
            "active_goals": len([goal for goal in goals if goal.get("status") == "active"]),
            "readout": f"This week shows {done_count} completed tasks and {len(incomplete)} open tasks. The next improvement is narrowing active work before starting new work.",
        }
        suggested = [
            {"title": f"Focus block: {priorities[0]['title']}", "notes": priorities[0].get("reason", "Complete the highest leverage task."), "priority": "high"},
            {"title": "Review and defer low-priority tasks", "notes": "Move anything nonessential out of today's active list.", "priority": "medium"},
            {"title": "Write evening productivity review", "notes": "Capture wins, blockers, and tomorrow's first task.", "priority": "low"},
        ]
        summary = f"Productivity focus for {timeframe}: protect a small priority list, complete one high-leverage item, and reduce open-loop pressure."
        return {
            "title": "Productivity Agent analysis",
            "summary": summary,
            "priorities": priorities,
            "daily_focus_list": focus_list,
            "procrastination_patterns": patterns,
            "improvement_plan": improvement,
            "weekly_summary": weekly,
            "suggested_tasks": suggested,
            "notes": f"# Productivity Review\n\n## Summary\n{summary}\n\n## Focus\n{focus}\n\n## Weekly readout\n{weekly['readout']}",
        }

    if not settings.openai_api_key or settings.openai_api_key in {"replace-me", "sk-xxxxxxxx"}:
        return fallback()

    client = OpenAI(api_key=settings.openai_api_key)
    prompt = {
        "focus": focus,
        "timeframe": timeframe,
        "user_context": user_context,
        "tasks": tasks[:30],
        "goals": goals[:10],
        "daily_plans": daily_plans[:7],
        "memories": memories[:12],
        "instructions": "Analyze productivity. Return JSON with title, summary, priorities array, daily_focus_list array, procrastination_patterns array of {pattern,evidence,fix}, improvement_plan array of {title,description}, weekly_summary object, suggested_tasks array of {title,notes,priority}, notes markdown. Priorities should reference task_id when possible.",
    }
    try:
        response = client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=[
                {"role": "system", "content": "You are HumanOS Productivity Agent. Diagnose execution patterns and create a practical plan from tasks, goals, plans, and memory."},
                {"role": "user", "content": json.dumps(prompt)},
            ],
            temperature=0.25,
            response_format={"type": "json_object"},
        )
        payload = json.loads(response.choices[0].message.content or "{}")
        result = fallback()
        result.update({key: payload[key] for key in result.keys() if key in payload})
        return result
    except Exception:
        return fallback()
