"use client";

import Link from "next/link";
import { SafeUserButton, useSafeAuth } from "@/components/clerk-safe";
import { useTheme } from "next-themes";
import { ArrowLeft, CalendarDays, Check, Flag, Goal, Loader2, Moon, Plus, Sparkles, Sun, Trash2, WandSparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type GoalStatus = "active" | "paused" | "complete";
type GoalUser = { firstName: string; fullName: string; email: string };
type GoalItem = { id: string; title: string; why: string; metric: string; progress: number; status: GoalStatus; target_at?: string | null; created_at: string };
type Milestone = { id: string; goal_id: string; title: string; description: string; target_at?: string | null; completed_at?: string | null; is_complete: boolean; sort_order: number; created_at: string; updated_at: string };

type GoalForm = { title: string; why: string; metric: string; target_at: string };
const emptyGoal: GoalForm = { title: "", why: "", metric: "", target_at: "" };

export function GoalsClient({ user, clerkReady }: { user: GoalUser; clerkReady: boolean }) {
  if (!clerkReady) return <GoalsSetup user={user} />;
  return <AuthenticatedGoalsClient user={user} />;
}

function AuthenticatedGoalsClient({ user }: { user: GoalUser }) {
  const { getToken } = useSafeAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [milestones, setMilestones] = useState<Record<string, Milestone[]>>({});
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [form, setForm] = useState<GoalForm>(emptyGoal);
  const [roadmapTitle, setRoadmapTitle] = useState("Become AI Engineer in 6 months");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadGoals();
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

  async function loadGoals() {
    setIsLoading(true);
    setError("");
    try {
      const data = await request<GoalItem[]>("/goals");
      setGoals(data);
      setActiveGoalId((current) => current ?? data[0]?.id ?? null);
      await Promise.all(data.map((goal) => loadMilestones(goal.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load goals");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMilestones(goalId: string) {
    const data = await request<Milestone[]>(`/goals/${goalId}/milestones`);
    setMilestones((current) => ({ ...current, [goalId]: data }));
  }

  async function createGoal(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return;
    setIsSaving(true);
    try {
      const goal = await request<GoalItem>("/goals", { method: "POST", body: JSON.stringify({ title: form.title.trim(), why: form.why, metric: form.metric, target_at: form.target_at ? new Date(form.target_at).toISOString() : null }) });
      setGoals((current) => [goal, ...current]);
      setActiveGoalId(goal.id);
      setForm(emptyGoal);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to create goal"); }
    finally { setIsSaving(false); }
  }

  async function generateRoadmap() {
    if (!roadmapTitle.trim()) return;
    setIsSaving(true);
    setError("");
    try {
      const response = await request<{ goal: GoalItem; milestones: Milestone[] }>("/goals/roadmap", { method: "POST", body: JSON.stringify({ title: roadmapTitle, timeframe: "6 months", current_level: "beginner", target_outcome: "Become job-ready for AI engineer roles" }) });
      setGoals((current) => [response.goal, ...current]);
      setMilestones((current) => ({ ...current, [response.goal.id]: response.milestones }));
      setActiveGoalId(response.goal.id);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to generate roadmap"); }
    finally { setIsSaving(false); }
  }

  async function completeMilestone(milestone: Milestone) {
    const updated = await request<Milestone>(`/goals/${milestone.goal_id}/milestones/${milestone.id}/complete`, { method: "POST" });
    setMilestones((current) => ({ ...current, [milestone.goal_id]: current[milestone.goal_id].map((item) => item.id === updated.id ? updated : item) }));
    await loadGoals();
  }

  async function convertToTask(milestone: Milestone) {
    await request(`/goals/${milestone.goal_id}/milestones/${milestone.id}/task`, { method: "POST" });
  }

  async function deleteGoal(goalId: string) {
    await request(`/goals/${goalId}`, { method: "DELETE" });
    setGoals((current) => current.filter((goal) => goal.id !== goalId));
    setActiveGoalId(null);
  }

  const activeGoal = goals.find((goal) => goal.id === activeGoalId) ?? goals[0];
  const activeMilestones = activeGoal ? milestones[activeGoal.id] ?? [] : [];
  const summary = useMemo(() => ({ active: goals.filter((goal) => goal.status === "active").length, complete: goals.filter((goal) => goal.status === "complete").length, average: Math.round(goals.reduce((sum, goal) => sum + goal.progress, 0) / Math.max(goals.length, 1)) }), [goals]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/75 backdrop-blur-2xl"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"><div className="flex items-center gap-3"><Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Dashboard</Link></Button><div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground"><Goal className="h-5 w-5" /></div><div><p className="text-sm font-semibold">Goal tracking</p><p className="text-xs text-muted-foreground">Long-term roadmap for {user.firstName}</p></div></div><div className="flex gap-2"><Button variant="outline" size="icon" title="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button><SafeUserButton /></div></div></header>
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[380px_1fr] lg:px-8">
        <aside className="space-y-4">
          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4 text-primary" />Create goal</CardTitle></CardHeader><CardContent><form onSubmit={createGoal} className="space-y-3"><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Long-term goal" /><Textarea value={form.why} onChange={(event) => setForm({ ...form, why: event.target.value })} placeholder="Why this matters" /><Input value={form.metric} onChange={(event) => setForm({ ...form, metric: event.target.value })} placeholder="Success metric" /><Input type="date" value={form.target_at} onChange={(event) => setForm({ ...form, target_at: event.target.value })} /><Button className="w-full" disabled={!form.title.trim() || isSaving}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create goal</Button></form></CardContent></Card>
          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><WandSparkles className="h-4 w-4 text-secondary" />AI roadmap</CardTitle></CardHeader><CardContent className="space-y-3"><Input value={roadmapTitle} onChange={(event) => setRoadmapTitle(event.target.value)} /><Button className="w-full" variant="outline" onClick={() => void generateRoadmap()} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}Generate roadmap</Button></CardContent></Card>
          <Card className="bg-card/70 backdrop-blur-2xl"><CardContent className="grid grid-cols-3 gap-2 p-4"><Metric label="Active" value={summary.active} /><Metric label="Done" value={summary.complete} /><Metric label="Avg" value={summary.average} suffix="%" /></CardContent></Card>
        </aside>
        <section className="space-y-4">
          <div className="rounded-[1.5rem] border bg-card/65 p-5 shadow-soft backdrop-blur-2xl sm:p-7"><p className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" />Long-term goal system</p><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Milestones make ambition operational.</h1></div>
          {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
          {isLoading ? <div className="rounded-lg border bg-card/70 p-4 text-sm text-muted-foreground">Loading goals...</div> : goals.length === 0 ? <div className="rounded-lg border bg-card/70 p-8 text-center text-sm text-muted-foreground">Create a goal or generate the AI Engineer roadmap.</div> : (
            <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
              <div className="space-y-2">{goals.map((goal) => <button key={goal.id} onClick={() => setActiveGoalId(goal.id)} className={cn("w-full rounded-lg border bg-card/70 p-3 text-left transition hover:bg-muted", activeGoal?.id === goal.id && "border-primary")}><div className="flex items-center justify-between gap-2"><p className="font-semibold leading-6">{goal.title}</p><span className="text-xs text-muted-foreground">{goal.progress}%</span></div><Progress value={goal.progress} /></button>)}</div>
              {activeGoal && <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center justify-between gap-3"><span>{activeGoal.title}</span><Button variant="ghost" size="icon" title="Delete goal" onClick={() => void deleteGoal(activeGoal.id)}><Trash2 className="h-4 w-4" /></Button></CardTitle></CardHeader><CardContent className="space-y-5"><div><p className="text-sm leading-6 text-muted-foreground">{activeGoal.why || activeGoal.metric}</p><Progress value={activeGoal.progress} /></div><div className="space-y-3">{activeMilestones.map((milestone, index) => <MilestoneRow key={milestone.id} milestone={milestone} index={index} onComplete={() => void completeMilestone(milestone)} onTask={() => void convertToTask(milestone)} />)}</div></CardContent></Card>}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function MilestoneRow({ milestone, index, onComplete, onTask }: { milestone: Milestone; index: number; onComplete: () => void; onTask: () => void }) {
  return <div className="grid grid-cols-[32px_1fr] gap-3"><div className={cn("flex h-8 w-8 items-center justify-center rounded-md border", milestone.is_complete && "bg-primary text-primary-foreground")}><Check className="h-4 w-4" /></div><div className="rounded-lg border bg-background/65 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold">{index + 1}. {milestone.title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{milestone.description}</p></div><div className="flex gap-1"><Button size="sm" variant="outline" onClick={onTask}><Flag className="h-4 w-4" />Task</Button><Button size="sm" onClick={onComplete} disabled={milestone.is_complete}><Check className="h-4 w-4" />Done</Button></div></div>{milestone.target_at && <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{new Date(milestone.target_at).toLocaleDateString()}</p>}</div></div>;
}
function Progress({ value }: { value: number }) { return <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>; }
function Metric({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) { return <div className="rounded-lg border bg-background/65 p-3 text-center"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}{suffix}</p></div>; }
function GoalsSetup({ user }: { user: GoalUser }) { const { resolvedTheme, setTheme } = useTheme(); return <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground"><div className="absolute right-4 top-4 flex gap-2"><Button variant="outline" size="icon" title="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button><Button asChild><Link href="/sign-in">Login</Link></Button></div><section className="mx-auto max-w-2xl rounded-[1.5rem] border bg-card/70 p-8 text-center shadow-soft backdrop-blur-2xl"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Goal className="h-7 w-7" /></div><h1 className="mt-5 text-3xl font-semibold">Goals are ready, {user.firstName}.</h1><p className="mt-3 text-muted-foreground">Add Clerk keys to enable authenticated goal tracking.</p></section></main>; }

