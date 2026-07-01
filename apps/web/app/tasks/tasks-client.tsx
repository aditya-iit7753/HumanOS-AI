"use client";

import Link from "next/link";
import { UserButton, useAuth } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Loader2,
  Moon,
  Pencil,
  Plus,
  Sparkles,
  Sun,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Priority = "low" | "medium" | "high";
type Status = "todo" | "in_progress" | "done";

type TaskUser = { firstName: string; fullName: string; email: string };

type Goal = { id: string; title: string; status: string; progress: number; created_at: string };

type Task = {
  id: string;
  title: string;
  notes: string;
  status: Status;
  priority: Priority;
  due_at?: string | null;
  goal_id?: string | null;
  goal_title?: string | null;
  created_at: string;
  updated_at: string;
};

type TaskDraft = {
  title: string;
  notes: string;
  priority: Priority;
  due_at: string;
  goal_id: string;
};

type Suggestion = {
  title: string;
  notes: string;
  priority: Priority;
  due_at?: string | null;
  goal_id?: string | null;
  goal_title?: string | null;
};

const emptyDraft: TaskDraft = { title: "", notes: "", priority: "medium", due_at: "", goal_id: "" };

const priorityStyles: Record<Priority, string> = {
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  high: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export function TasksClient({ user, clerkReady }: { user: TaskUser; clerkReady: boolean }) {
  if (!clerkReady) return <TasksSetup user={user} />;
  return <AuthenticatedTasksClient user={user} />;
}

function AuthenticatedTasksClient({ user }: { user: TaskUser }) {
  const { getToken } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<TaskDraft>(emptyDraft);
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function authHeaders() {
    const token = await getToken();
    if (!token) throw new Error("Missing Clerk session token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  async function request<T>(path: string, options: RequestInit = {}) {
    const headers = await authHeaders();
    const response = await fetch(`${API_URL}${path}`, { ...options, headers: { ...headers, ...options.headers } });
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as T;
  }

  async function loadData() {
    setError("");
    setIsLoading(true);
    try {
      const [taskData, goalData] = await Promise.all([request<Task[]>("/tasks"), request<Goal[]>("/goals")]);
      setTasks(taskData);
      setGoals(goalData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tasks");
    } finally {
      setIsLoading(false);
    }
  }

  function payloadFromDraft(value: TaskDraft) {
    return {
      title: value.title.trim(),
      notes: value.notes.trim(),
      priority: value.priority,
      due_at: value.due_at ? new Date(value.due_at).toISOString() : null,
      goal_id: value.goal_id || null,
    };
  }

  async function createTask(event?: FormEvent, suggestion?: Suggestion) {
    event?.preventDefault();
    const source = suggestion
      ? { title: suggestion.title, notes: suggestion.notes, priority: suggestion.priority, due_at: suggestion.due_at ? toInputDate(suggestion.due_at) : "", goal_id: suggestion.goal_id ?? "" }
      : draft;
    if (!source.title.trim()) return;
    setIsSaving(true);
    setError("");
    try {
      const task = await request<Task>("/tasks", { method: "POST", body: JSON.stringify(payloadFromDraft(source)) });
      setTasks((current) => [task, ...current]);
      if (!suggestion) setDraft(emptyDraft);
      if (suggestion) setSuggestions((current) => current.filter((item) => item.title !== suggestion.title));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create task");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveEdit(taskId: string) {
    if (!editingDraft.title.trim()) return;
    setIsSaving(true);
    setError("");
    try {
      const updated = await request<Task>(`/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(payloadFromDraft(editingDraft)) });
      setTasks((current) => current.map((task) => (task.id === updated.id ? updated : task)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update task");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateStatus(task: Task, status: Status) {
    setError("");
    try {
      const updated = status === "done"
        ? await request<Task>(`/tasks/${task.id}/complete`, { method: "POST" })
        : await request<Task>(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update task status");
    }
  }

  async function deleteTask(taskId: string) {
    setError("");
    try {
      await request(`/tasks/${taskId}`, { method: "DELETE" });
      setTasks((current) => current.filter((task) => task.id !== taskId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete task");
    }
  }

  async function loadSuggestions() {
    setIsSuggesting(true);
    setError("");
    try {
      const response = await request<{ suggestions: Suggestion[] }>("/tasks/suggestions");
      setSuggestions(response.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate suggestions");
    } finally {
      setIsSuggesting(false);
    }
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditingDraft({
      title: task.title,
      notes: task.notes,
      priority: task.priority,
      due_at: task.due_at ? toInputDate(task.due_at) : "",
      goal_id: task.goal_id ?? "",
    });
  }

  const summary = useMemo(() => {
    const open = tasks.filter((task) => task.status !== "done");
    const dueToday = open.filter((task) => isToday(task.due_at)).length;
    const high = open.filter((task) => task.priority === "high").length;
    return { open: open.length, done: tasks.length - open.length, dueToday, high };
  }, [tasks]);

  const visibleTasks = tasks.filter((task) => statusFilter === "all" || task.status === statusFilter);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Dashboard</Link></Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground"><CheckCircle2 className="h-5 w-5" /></div>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">Task management</p><p className="text-xs text-muted-foreground">Plan and close loops for {user.firstName}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" title="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
            <UserButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[380px_1fr] lg:px-8">
        <aside className="space-y-4">
          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4 text-primary" />Create task</CardTitle></CardHeader>
            <CardContent><TaskForm draft={draft} goals={goals} onChange={setDraft} onSubmit={createTask} isSaving={isSaving} /></CardContent>
          </Card>

          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><WandSparkles className="h-4 w-4 text-secondary" />AI suggestions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full" onClick={() => void loadSuggestions()} disabled={isSuggesting}>{isSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}Generate suggestions</Button>
              {suggestions.map((suggestion) => (
                <div key={suggestion.title} className="rounded-lg border bg-background/65 p-3">
                  <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold leading-6">{suggestion.title}</p><PriorityPill priority={suggestion.priority} /></div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{suggestion.notes}</p>
                  {suggestion.goal_title && <p className="mt-2 text-xs text-primary">Goal: {suggestion.goal_title}</p>}
                  <Button size="sm" className="mt-3 w-full" onClick={() => void createTask(undefined, suggestion)}><Plus className="h-4 w-4" />Add task</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-4">
          <div className="rounded-[1.5rem] border bg-card/65 p-5 shadow-soft backdrop-blur-2xl sm:p-7">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" />Task operating system</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Turn goals into visible progress.</h1>
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <Metric label="Open" value={summary.open} />
              <Metric label="Done" value={summary.done} />
              <Metric label="Due today" value={summary.dueToday} />
              <Metric label="High priority" value={summary.high} />
            </div>
          </div>

          {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}

          <div className="flex flex-wrap gap-2">
            {(["all", "todo", "in_progress", "done"] as const).map((status) => (
              <Button key={status} variant={statusFilter === status ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(status)}>{statusLabel(status)}</Button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 rounded-lg border bg-card/70 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading tasks</div>
          ) : visibleTasks.length === 0 ? (
            <div className="rounded-lg border bg-card/70 p-8 text-center text-sm text-muted-foreground">No tasks in this view yet.</div>
          ) : (
            <div className="space-y-3">
              {visibleTasks.map((task) => (
                <TaskCard key={task.id} task={task} goals={goals} editing={editingId === task.id ? editingDraft : null} onEdit={() => startEdit(task)} onCancel={() => setEditingId(null)} onDraftChange={setEditingDraft} onSave={() => void saveEdit(task.id)} onDelete={() => void deleteTask(task.id)} onStatus={(status) => void updateStatus(task, status)} isSaving={isSaving} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function TaskForm({ draft, goals, onChange, onSubmit, isSaving }: { draft: TaskDraft; goals: Goal[]; onChange: (draft: TaskDraft) => void; onSubmit: (event: FormEvent) => void; isSaving: boolean }) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} placeholder="Task title" />
      <Textarea value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} placeholder="Notes" className="min-h-24" />
      <div className="grid grid-cols-2 gap-2">
        <select value={draft.priority} onChange={(event) => onChange({ ...draft, priority: event.target.value as Priority })} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
        <Input type="date" value={draft.due_at} onChange={(event) => onChange({ ...draft, due_at: event.target.value })} />
      </div>
      <select value={draft.goal_id} onChange={(event) => onChange({ ...draft, goal_id: event.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">No linked goal</option>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select>
      <Button className="w-full" disabled={!draft.title.trim() || isSaving}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create task</Button>
    </form>
  );
}

function TaskCard({ task, goals, editing, onEdit, onCancel, onDraftChange, onSave, onDelete, onStatus, isSaving }: { task: Task; goals: Goal[]; editing: TaskDraft | null; onEdit: () => void; onCancel: () => void; onDraftChange: (draft: TaskDraft) => void; onSave: () => void; onDelete: () => void; onStatus: (status: Status) => void; isSaving: boolean }) {
  return (
    <Card className="bg-card/70 backdrop-blur-2xl"><CardContent className="p-4">
      {editing ? (
        <div className="space-y-3"><TaskForm draft={editing} goals={goals} onChange={onDraftChange} onSubmit={(event) => { event.preventDefault(); onSave(); }} isSaving={isSaving} /><div className="flex justify-end"><Button variant="outline" size="sm" onClick={onCancel}><X className="h-4 w-4" />Cancel</Button></div></div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <button title="Mark complete" onClick={() => onStatus(task.status === "done" ? "todo" : "done")} className={cn("mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border", task.status === "done" && "bg-primary text-primary-foreground")}><Check className="h-4 w-4" /></button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 className={cn("text-base font-semibold", task.status === "done" && "text-muted-foreground line-through")}>{task.title}</h2><PriorityPill priority={task.priority} /><span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{statusLabel(task.status)}</span></div>
            {task.notes && <p className="mt-2 text-sm leading-6 text-muted-foreground">{task.notes}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">{task.due_at && <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Date(task.due_at).toLocaleDateString()}</span>}{task.goal_title && <span>Goal: {task.goal_title}</span>}</div>
          </div>
          <div className="flex gap-1 self-end sm:self-start"><Button variant="ghost" size="icon" title="Edit task" onClick={onEdit}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Delete task" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button></div>
        </div>
      )}
    </CardContent></Card>
  );
}

function PriorityPill({ priority }: { priority: Priority }) {
  return <span className={cn("rounded-md border px-2 py-1 text-xs font-medium capitalize", priorityStyles[priority])}>{priority}</span>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border bg-background/65 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>;
}

function statusLabel(status: Status | "all") {
  return status === "in_progress" ? "In progress" : status === "todo" ? "To do" : status === "done" ? "Done" : "All";
}

function toInputDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function isToday(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

function TasksSetup({ user }: { user: TaskUser }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="absolute right-4 top-4 flex gap-2"><Button variant="outline" size="icon" title="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button><Button asChild><Link href="/sign-in">Login</Link></Button></div>
      <section className="mx-auto max-w-2xl rounded-[1.5rem] border bg-card/70 p-8 text-center shadow-soft backdrop-blur-2xl"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><CheckCircle2 className="h-7 w-7" /></div><h1 className="mt-5 text-3xl font-semibold">Tasks are ready, {user.firstName}.</h1><p className="mt-3 text-muted-foreground">Add Clerk keys to enable authenticated task management.</p></section>
    </main>
  );
}