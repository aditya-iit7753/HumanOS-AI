"use client";

import Link from "next/link";
import { SafeUserButton, useSafeAuth } from "@/components/clerk-safe";
import { useTheme } from "next-themes";
import { CalendarDays, CheckCircle2, ChevronLeft, Clock3, Goal, LayoutDashboard, Loader2, Moon, Sparkles, Sun, Target, TimerReset } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type AppUser = { firstName: string; fullName: string; email: string };
type Task = { id: string; title: string; notes: string; status: "todo" | "in_progress" | "done"; priority: "low" | "medium" | "high"; due_at?: string | null; goal_title?: string | null };
type GoalItem = { id: string; title: string; progress: number; status: string; target_at?: string | null };
type AgendaBlock = { start: string; end: string; title: string; type: string; description: string; priority?: "low" | "medium" | "high"; task_id?: string | null; goal_id?: string | null };
type DailyPlan = { id: string; plan_date: string; focus: string; agenda: AgendaBlock[]; reflection: string; score: number; created_at: string; updated_at: string };
type Dashboard = { today: DailyPlan | null; tasks: { open: number; done: number; due_today: number; planned: number; completed_planned: number }; goals: { active: number; average_progress: number }; productivity_score: number };

export function PlannerClient({ user, clerkReady }: { user: AppUser; clerkReady: boolean }) {
  if (!clerkReady) return <PlannerPreview user={user} />;
  return <AuthenticatedPlanner user={user} />;
}

function AuthenticatedPlanner({ user }: { user: AppUser }) {
  const { getToken } = useSafeAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [dailyGoals, setDailyGoals] = useState("Ship one meaningful HumanOS improvement\nProtect a deep work block");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [energy, setEnergy] = useState("balanced");
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [accomplished, setAccomplished] = useState("");
  const [blockers, setBlockers] = useState("");
  const [mood, setMood] = useState("steady");
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadPlanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openTasks = useMemo(() => tasks.filter((task) => task.status !== "done"), [tasks]);
  const today = new Date().toISOString();

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await getToken();
    if (!token) throw new Error("Missing Clerk session token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  async function loadPlanner() {
    setError("");
    try {
      const headers = await authHeaders();
      const [tasksResponse, goalsResponse, todayResponse, dashboardResponse] = await Promise.all([
        fetch(`${API_URL}/tasks`, { headers }),
        fetch(`${API_URL}/goals`, { headers }),
        fetch(`${API_URL}/daily-plans/today`, { headers }),
        fetch(`${API_URL}/daily-plans/dashboard`, { headers }),
      ]);
      if (!tasksResponse.ok) throw new Error(await tasksResponse.text());
      if (!goalsResponse.ok) throw new Error(await goalsResponse.text());
      if (!todayResponse.ok) throw new Error(await todayResponse.text());
      if (!dashboardResponse.ok) throw new Error(await dashboardResponse.text());
      const loadedTasks = (await tasksResponse.json()) as Task[];
      const loadedGoals = (await goalsResponse.json()) as GoalItem[];
      const loadedPlan = (await todayResponse.json()) as DailyPlan | null;
      const loadedDashboard = (await dashboardResponse.json()) as Dashboard;
      setTasks(loadedTasks);
      setGoals(loadedGoals);
      setPlan(loadedPlan);
      setDashboard(loadedDashboard);
      setSelectedTasks(loadedTasks.filter((task) => task.status !== "done").slice(0, 4).map((task) => task.id));
      setSelectedGoals(loadedGoals.filter((goal) => goal.status === "active").slice(0, 2).map((goal) => goal.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load planner");
    }
  }

  async function generatePlan(event: FormEvent) {
    event.preventDefault();
    setIsGenerating(true);
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/daily-plans/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          plan_date: today,
          daily_goals: dailyGoals.split("\n").map((item) => item.trim()).filter(Boolean),
          start_time: startTime,
          end_time: endTime,
          energy,
          include_task_ids: selectedTasks,
          include_goal_ids: selectedGoals,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as DailyPlan;
      setPlan(data);
      await loadDashboardOnly();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate plan");
    } finally {
      setIsGenerating(false);
    }
  }

  async function loadDashboardOnly() {
    const headers = await authHeaders();
    const response = await fetch(`${API_URL}/daily-plans/dashboard`, { headers });
    if (response.ok) setDashboard((await response.json()) as Dashboard);
  }

  async function reviewPlan(event: FormEvent) {
    event.preventDefault();
    if (!plan) return;
    setIsReviewing(true);
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/daily-plans/${plan.id}/review`, {
        method: "POST",
        headers,
        body: JSON.stringify({ accomplished, blockers, mood, notes: "", completed_task_ids: completedTaskIds }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as DailyPlan;
      setPlan(data);
      setAccomplished("");
      setBlockers("");
      setCompletedTaskIds([]);
      await loadPlanner();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save review");
    } finally {
      setIsReviewing(false);
    }
  }

  function toggle(list: string[], value: string, setter: (value: string[]) => void) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="sm"><Link href="/dashboard"><ChevronLeft className="h-4 w-4" />Dashboard</Link></Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">AI Daily Planner</p>
              <p className="text-xs text-muted-foreground">{user.firstName}, plan the day with tasks, goals, and review</p>
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

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
        <section className="flex flex-col gap-4">
          <ProgressDashboard dashboard={dashboard} plan={plan} />
          <form onSubmit={generatePlan} className="flex flex-col gap-4">
            <Card className="bg-card/70 backdrop-blur-2xl">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-5 w-5 text-primary" /> Morning plan</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Textarea value={dailyGoals} onChange={(event) => setDailyGoals(event.target.value)} className="min-h-28" placeholder="Enter today's goals, one per line" />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input value={startTime} onChange={(event) => setStartTime(event.target.value)} placeholder="Start" />
                  <Input value={endTime} onChange={(event) => setEndTime(event.target.value)} placeholder="End" />
                  <select value={energy} onChange={(event) => setEnergy(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
                    <option value="balanced">Balanced</option>
                    <option value="deep-work">Deep work</option>
                    <option value="light">Light day</option>
                    <option value="recovery">Recovery</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            <SelectorPanel title="Connect tasks" icon={CheckCircle2} items={openTasks.map((task) => ({ id: task.id, title: task.title, detail: `${task.priority} priority${task.goal_title ? ` ? ${task.goal_title}` : ""}` }))} selected={selectedTasks} onToggle={(id) => toggle(selectedTasks, id, setSelectedTasks)} />
            <SelectorPanel title="Connect goals" icon={Goal} items={goals.map((goal) => ({ id: goal.id, title: goal.title, detail: `${goal.progress}% progress ? ${goal.status}` }))} selected={selectedGoals} onToggle={(id) => toggle(selectedGoals, id, setSelectedGoals)} />

            {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
            <Button disabled={isGenerating} className="h-11">{isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}Create time-blocked schedule</Button>
          </form>
        </section>

        <section className="flex flex-col gap-4">
          <SchedulePanel plan={plan} tasks={tasks} goals={goals} />
          <EveningReview plan={plan} tasks={tasks} accomplished={accomplished} blockers={blockers} mood={mood} completedTaskIds={completedTaskIds} isReviewing={isReviewing} onAccomplished={setAccomplished} onBlockers={setBlockers} onMood={setMood} onToggleTask={(id) => toggle(completedTaskIds, id, setCompletedTaskIds)} onSubmit={(event) => void reviewPlan(event)} />
        </section>
      </div>
    </main>
  );
}

function ProgressDashboard({ dashboard, plan }: { dashboard: Dashboard | null; plan: DailyPlan | null }) {
  return (
    <Card className="bg-card/70 backdrop-blur-2xl">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><LayoutDashboard className="h-5 w-5 text-secondary" /> Daily progress</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Metric label="Productivity" value={`${dashboard?.productivity_score ?? plan?.score ?? 0}%`} />
        <Metric label="Open tasks" value={String(dashboard?.tasks.open ?? 0)} />
        <Metric label="Due today" value={String(dashboard?.tasks.due_today ?? 0)} />
        <Metric label="Goal progress" value={`${dashboard?.goals.average_progress ?? 0}%`} />
      </CardContent>
    </Card>
  );
}

function SelectorPanel({ title, icon: Icon, items, selected, onToggle }: { title: string; icon: typeof Goal; items: { id: string; title: string; detail: string }[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <Card className="bg-card/70 backdrop-blur-2xl">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-5 w-5 text-primary" /> {title}</CardTitle></CardHeader>
      <CardContent className="max-h-64 space-y-2 overflow-y-auto">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">Nothing to connect yet.</p> : items.map((item) => (
          <button key={item.id} type="button" onClick={() => onToggle(item.id)} className={cn("w-full rounded-lg border p-3 text-left transition hover:bg-muted", selected.includes(item.id) ? "border-primary bg-primary/10" : "bg-background/65")}>
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function SchedulePanel({ plan, tasks, goals }: { plan: DailyPlan | null; tasks: Task[]; goals: GoalItem[] }) {
  return (
    <Card className="bg-card/70 backdrop-blur-2xl">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-5 w-5 text-primary" /> Time-blocked schedule</CardTitle></CardHeader>
      <CardContent>
        {!plan ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border bg-background/60 p-8 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground" />
            <p className="mt-4 text-lg font-semibold">No plan for today yet</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Enter daily goals, connect tasks and goals, then let HumanOS create a schedule.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border bg-background/65 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4 text-secondary" /> {plan.focus}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{plan.reflection}</p>
            </div>
            <div className="space-y-3">
              {plan.agenda.map((block, index) => {
                const task = tasks.find((item) => item.id === block.task_id);
                const goal = goals.find((item) => item.id === block.goal_id);
                return (
                  <div key={`${block.start}-${index}`} className="grid gap-3 rounded-xl border bg-background/65 p-4 sm:grid-cols-[7rem_1fr]">
                    <div className="text-sm font-semibold text-primary">{block.start} - {block.end}</div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{block.title}</p>
                        <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">{block.type}</span>
                        {block.priority && <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{block.priority}</span>}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{block.description}</p>
                      {(task || goal) && <p className="mt-2 text-xs text-muted-foreground">Connected: {task?.title ?? goal?.title}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EveningReview({ plan, tasks, accomplished, blockers, mood, completedTaskIds, isReviewing, onAccomplished, onBlockers, onMood, onToggleTask, onSubmit }: { plan: DailyPlan | null; tasks: Task[]; accomplished: string; blockers: string; mood: string; completedTaskIds: string[]; isReviewing: boolean; onAccomplished: (value: string) => void; onBlockers: (value: string) => void; onMood: (value: string) => void; onToggleTask: (id: string) => void; onSubmit: (event: FormEvent) => void }) {
  const plannedTaskIds = new Set((plan?.agenda ?? []).map((block) => block.task_id).filter(Boolean));
  const plannedTasks = tasks.filter((task) => plannedTaskIds.has(task.id));
  return (
    <Card className="bg-card/70 backdrop-blur-2xl">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TimerReset className="h-5 w-5 text-secondary" /> Evening review</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <Textarea value={accomplished} onChange={(event) => onAccomplished(event.target.value)} placeholder="What got done?" className="min-h-20" disabled={!plan} />
          <Textarea value={blockers} onChange={(event) => onBlockers(event.target.value)} placeholder="What blocked momentum?" className="min-h-20" disabled={!plan} />
          <select value={mood} onChange={(event) => onMood(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm" disabled={!plan}>
            <option value="energized">Energized</option>
            <option value="steady">Steady</option>
            <option value="scattered">Scattered</option>
            <option value="tired">Tired</option>
          </select>
          {plannedTasks.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Mark planned tasks complete</p>
              {plannedTasks.map((task) => (
                <button key={task.id} type="button" onClick={() => onToggleTask(task.id)} className={cn("flex w-full items-center gap-2 rounded-lg border p-3 text-left text-sm", completedTaskIds.includes(task.id) ? "border-primary bg-primary/10" : "bg-background/65")}>
                  <CheckCircle2 className="h-4 w-4" /> {task.title}
                </button>
              ))}
            </div>
          )}
          <Button disabled={!plan || isReviewing}>{isReviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TimerReset className="h-4 w-4" />}Save evening review</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-background/65 p-4"><p className="text-xs font-medium uppercase text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>;
}

function PlannerPreview({ user }: { user: AppUser }) {
  return <main className="min-h-screen bg-background px-4 py-8 text-foreground"><div className="mx-auto max-w-3xl rounded-[1.5rem] border bg-card/70 p-8 shadow-soft backdrop-blur-2xl"><p className="flex items-center gap-2 text-sm font-semibold text-primary"><CalendarDays className="h-4 w-4" /> AI Daily Planner</p><h1 className="mt-4 text-3xl font-semibold">Welcome, {user.firstName}</h1><p className="mt-3 text-sm leading-7 text-muted-foreground">Connect Clerk to generate time-blocked daily plans from your HumanOS tasks and goals.</p><Button asChild className="mt-6"><Link href="/sign-in">Sign in</Link></Button></div></main>;
}

