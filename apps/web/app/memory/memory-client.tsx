"use client";

import Link from "next/link";
import { SafeUserButton, useSafeAuth } from "@/components/clerk-safe";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  Brain,
  Check,
  Loader2,
  Moon,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const memoryTypes = [
  "career_goal",
  "personal_preference",
  "project",
  "skill",
  "task",
  "document",
  "important_fact",
] as const;

type MemoryType = (typeof memoryTypes)[number];

type MemoryUser = {
  firstName: string;
  fullName: string;
  email: string;
};

type Memory = {
  id: string;
  category: MemoryType;
  content: string;
  importance: number;
  source: string;
  vector_id?: string | null;
  created_at: string;
};

type EditingMemory = {
  id: string;
  category: MemoryType;
  content: string;
  importance: number;
};

const labels: Record<MemoryType, string> = {
  career_goal: "Career goal",
  personal_preference: "Preference",
  project: "Project",
  skill: "Skill",
  task: "Task",
  document: "Document",
  important_fact: "Important fact",
};

const tint: Record<MemoryType, string> = {
  career_goal: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  personal_preference: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  project: "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
  skill: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  task: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300",
  document: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300",
  important_fact: "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

export function MemoryClient({ user, clerkReady }: { user: MemoryUser; clerkReady: boolean }) {
  if (!clerkReady) {
    return <MemorySetup user={user} />;
  }
  return <AuthenticatedMemoryClient user={user} />;
}

function AuthenticatedMemoryClient({ user }: { user: MemoryUser }) {
  const { getToken } = useSafeAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<MemoryType | "all">("all");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<MemoryType>("important_fact");
  const [importance, setImportance] = useState(3);
  const [editing, setEditing] = useState<EditingMemory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadMemories();
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
    if (response.status === 204) return null as T;
    return (await response.json()) as T;
  }

  async function loadMemories() {
    setError("");
    setIsLoading(true);
    try {
      setMemories(await request<Memory[]>("/memories"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load memories");
    } finally {
      setIsLoading(false);
    }
  }

  async function createMemory(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    setIsSaving(true);
    setError("");
    try {
      const memory = await request<Memory>("/memories", {
        method: "POST",
        body: JSON.stringify({ content: content.trim(), category, importance, source: "manual" }),
      });
      setMemories((current) => [memory, ...current]);
      setContent("");
      setImportance(3);
      setCategory("important_fact");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save memory");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateMemory() {
    if (!editing || !editing.content.trim()) return;
    setIsSaving(true);
    setError("");
    try {
      const updated = await request<Memory>(`/memories/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ content: editing.content.trim(), category: editing.category, importance: editing.importance }),
      });
      setMemories((current) => current.map((memory) => (memory.id === updated.id ? updated : memory)));
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update memory");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteMemory(memoryId: string) {
    setError("");
    try {
      await request(`/memories/${memoryId}`, { method: "DELETE" });
      setMemories((current) => current.filter((memory) => memory.id !== memoryId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete memory");
    }
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return memories.filter((memory) => {
      const matchesType = activeType === "all" || memory.category === activeType;
      const matchesQuery = !normalized || memory.content.toLowerCase().includes(normalized) || labels[memory.category].toLowerCase().includes(normalized);
      return matchesType && matchesQuery;
    });
  }, [activeType, memories, query]);

  const counts = useMemo(
    () => memoryTypes.reduce((acc, type) => ({ ...acc, [type]: memories.filter((memory) => memory.category === type).length }), {} as Record<MemoryType, number>),
    [memories],
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Brain className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Long-term memory</p>
              <p className="text-xs text-muted-foreground">Saved context for {user.firstName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" title="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <SafeUserButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[360px_1fr] lg:px-8">
        <aside className="space-y-4">
          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4 text-primary" />Add memory</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={createMemory} className="space-y-3">
                <Textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Save a durable fact, preference, goal, project, skill, task, or document note..." className="min-h-28" />
                <div className="grid grid-cols-[1fr_96px] gap-2">
                  <select value={category} onChange={(event) => setCategory(event.target.value as MemoryType)} className="h-10 rounded-md border bg-background px-3 text-sm">
                    {memoryTypes.map((type) => <option key={type} value={type}>{labels[type]}</option>)}
                  </select>
                  <Input type="number" min={1} max={5} value={importance} onChange={(event) => setImportance(Number(event.target.value))} />
                </div>
                <Button className="w-full" disabled={!content.trim() || isSaving}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Save memory</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Search className="h-4 w-4 text-secondary" />Filter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search memories" />
              <div className="grid grid-cols-2 gap-2">
                <FilterButton active={activeType === "all"} onClick={() => setActiveType("all")} label="All" count={memories.length} />
                {memoryTypes.map((type) => <FilterButton key={type} active={activeType === type} onClick={() => setActiveType(type)} label={labels[type]} count={counts[type]} />)}
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-4">
          <div className="rounded-[1.5rem] border bg-card/65 p-5 shadow-soft backdrop-blur-2xl sm:p-7">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" />Vector memory system</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Your copilot remembers what matters.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Chat facts are extracted automatically, stored in PostgreSQL, indexed in Qdrant, and retrieved before AI responses.
            </p>
          </div>

          {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}

          {isLoading ? (
            <div className="flex items-center gap-2 rounded-lg border bg-card/70 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading memories</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border bg-card/70 p-8 text-center text-sm text-muted-foreground">No memories match this view yet.</div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {filtered.map((memory) => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  editing={editing?.id === memory.id ? editing : null}
                  onEdit={() => setEditing({ id: memory.id, category: memory.category, content: memory.content, importance: memory.importance })}
                  onCancel={() => setEditing(null)}
                  onEditingChange={setEditing}
                  onSave={updateMemory}
                  onDelete={() => void deleteMemory(memory.id)}
                  isSaving={isSaving}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function FilterButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button onClick={onClick} className={cn("flex min-h-10 items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition hover:bg-muted", active && "border-primary bg-primary text-primary-foreground hover:bg-primary")}>
      <span className="truncate">{label}</span>
      <span className="ml-2 rounded bg-background/40 px-1.5 py-0.5">{count}</span>
    </button>
  );
}

function MemoryCard({ memory, editing, onEdit, onCancel, onEditingChange, onSave, onDelete, isSaving }: {
  memory: Memory;
  editing: EditingMemory | null;
  onEdit: () => void;
  onCancel: () => void;
  onEditingChange: (memory: EditingMemory) => void;
  onSave: () => void;
  onDelete: () => void;
  isSaving: boolean;
}) {
  return (
    <Card className="bg-card/70 backdrop-blur-2xl">
      <CardContent className="p-4">
        {editing ? (
          <div className="space-y-3">
            <Textarea value={editing.content} onChange={(event) => onEditingChange({ ...editing, content: event.target.value })} className="min-h-28" />
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <select value={editing.category} onChange={(event) => onEditingChange({ ...editing, category: event.target.value as MemoryType })} className="h-10 rounded-md border bg-background px-3 text-sm">
                {memoryTypes.map((type) => <option key={type} value={type}>{labels[type]}</option>)}
              </select>
              <Input type="number" min={1} max={5} value={editing.importance} onChange={(event) => onEditingChange({ ...editing, importance: Number(event.target.value) })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onCancel}><X className="h-4 w-4" />Cancel</Button>
              <Button size="sm" onClick={onSave} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Save</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <span className={cn("rounded-md border px-2 py-1 text-xs font-medium", tint[memory.category])}>{labels[memory.category]}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" title="Edit memory" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" title="Delete memory" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <p className="text-sm leading-7">{memory.content}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Importance {memory.importance}/5</span>
              <span>Source {memory.source}</span>
              <span>{new Date(memory.created_at).toLocaleDateString()}</span>
              {memory.vector_id && <span>Vector indexed</span>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MemorySetup({ user }: { user: MemoryUser }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="absolute right-4 top-4 flex gap-2">
        <Button variant="outline" size="icon" title="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
          {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button asChild><Link href="/sign-in">Login</Link></Button>
      </div>
      <section className="mx-auto max-w-2xl rounded-[1.5rem] border bg-card/70 p-8 text-center shadow-soft backdrop-blur-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Brain className="h-7 w-7" /></div>
        <h1 className="mt-5 text-3xl font-semibold">Memory is ready, {user.firstName}.</h1>
        <p className="mt-3 text-muted-foreground">Add Clerk keys to enable authenticated memory retrieval, editing, and deletion.</p>
      </section>
    </main>
  );
}
