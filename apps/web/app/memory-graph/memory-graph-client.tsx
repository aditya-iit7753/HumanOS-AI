"use client";

import Link from "next/link";
import { SafeUserButton, useSafeAuth } from "@/components/clerk-safe";
import { UpgradeNotice } from "@/components/upgrade-notice";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  FileText,
  Goal,
  Loader2,
  Moon,
  Network,
  Sparkles,
  Sun,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type MemoryGraphUser = { firstName: string; fullName: string; email: string };
type Memory = { id: string; category: string; content: string; importance: number; source: string; created_at: string };
type Task = { id: string; title: string; status: string; priority: string; due_at?: string | null; goal_title?: string | null };
type GoalRecord = { id: string; title: string; progress?: number; status?: string; target_at?: string | null };
type DocumentRecord = { id: string; title?: string; filename?: string; name?: string };
type CareerRecord = { target_role?: string; current_role?: string; strengths?: string[]; growth_areas?: string[]; roadmap?: string[] };
type NodeKind = "goal" | "memory" | "task" | "document" | "career" | "planner";
type GraphNode = { id: string; label: string; kind: NodeKind; detail: string; x: number; y: number; strength: number };

const kindStyles: Record<NodeKind, { label: string; className: string; icon: typeof BrainCircuit }> = {
  goal: { label: "Goals", className: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-200", icon: Goal },
  memory: { label: "Memories", className: "border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-200", icon: BrainCircuit },
  task: { label: "Tasks", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-200", icon: CheckCircle2 },
  document: { label: "Documents", className: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-200", icon: FileText },
  career: { label: "Career", className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200", icon: BriefcaseBusiness },
  planner: { label: "Planner", className: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-200", icon: CalendarDays },
};

const fallbackNodes: GraphNode[] = [
  { id: "fg-1", label: "Become AI Engineer", kind: "goal", detail: "Long-term goal", x: 18, y: 22, strength: 92 },
  { id: "fm-1", label: "Project-based learning", kind: "memory", detail: "Preference", x: 46, y: 15, strength: 78 },
  { id: "ft-1", label: "Build GenAI portfolio", kind: "task", detail: "Priority task", x: 72, y: 30, strength: 72 },
  { id: "fd-1", label: "Resume.pdf", kind: "document", detail: "Document insight", x: 26, y: 70, strength: 64 },
  { id: "fc-1", label: "AI/ML roadmap", kind: "career", detail: "Career engine", x: 58, y: 62, strength: 88 },
  { id: "fp-1", label: "Morning deep work", kind: "planner", detail: "Daily plan", x: 82, y: 76, strength: 69 },
];

export function MemoryGraphClient({ user, clerkReady }: { user: MemoryGraphUser; clerkReady: boolean }) {
  if (!clerkReady) return <MemoryGraphShell user={user} nodes={fallbackNodes} isDemo />;
  return <AuthenticatedMemoryGraph user={user} />;
}

function AuthenticatedMemoryGraph({ user }: { user: MemoryGraphUser }) {
  const { getToken } = useSafeAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<GoalRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [career, setCareer] = useState<CareerRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadGraph() {
      setIsLoading(true);
      setError("");
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing Clerk session token");
        const headers = { Authorization: `Bearer ${token}` };
        const results = await Promise.allSettled([
          fetch(`${API_URL}/memories`, { headers }),
          fetch(`${API_URL}/tasks`, { headers }),
          fetch(`${API_URL}/goals`, { headers }),
          fetch(`${API_URL}/documents`, { headers }),
          fetch(`${API_URL}/career`, { headers }),
        ]);

        async function readArray<T>(index: number): Promise<T[]> {
          const result = results[index];
          if (result.status !== "fulfilled" || !result.value.ok) return [];
          return (await result.value.json()) as T[];
        }

        setMemories(await readArray<Memory>(0));
        setTasks(await readArray<Task>(1));
        setGoals(await readArray<GoalRecord>(2));
        setDocuments(await readArray<DocumentRecord>(3));

        const careerResult = results[4];
        if (careerResult.status === "fulfilled" && careerResult.value.ok) {
          setCareer((await careerResult.value.json()) as CareerRecord | null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load Memory Graph");
      } finally {
        setIsLoading(false);
      }
    }
    void loadGraph();
  }, [getToken]);

  const nodes = useMemo(() => buildNodes({ memories, tasks, goals, documents, career }), [career, documents, goals, memories, tasks]);

  return (
    <MemoryGraphShell
      user={user}
      nodes={nodes.length ? nodes : fallbackNodes}
      isLoading={isLoading}
      isDemo={!nodes.length}
      error={error}
      stats={{ memories: memories.length, tasks: tasks.filter((task) => task.status !== "done").length, goals: goals.length, documents: documents.length }}
    />
  );
}

function buildNodes({ memories, tasks, goals, documents, career }: { memories: Memory[]; tasks: Task[]; goals: GoalRecord[]; documents: DocumentRecord[]; career: CareerRecord | null }) {
  const nodes: GraphNode[] = [];
  const positions = [[14, 24], [38, 14], [65, 22], [82, 48], [66, 76], [34, 78], [18, 55], [50, 48]];

  goals.slice(0, 2).forEach((goal, index) => nodes.push({ id: `goal-${goal.id}`, label: goal.title, kind: "goal", detail: `${goal.progress ?? 0}% progress`, x: positions[index][0], y: positions[index][1], strength: Math.max(45, goal.progress ?? 55) }));
  memories.slice(0, 3).forEach((memory, index) => nodes.push({ id: `memory-${memory.id}`, label: memory.content, kind: "memory", detail: memory.category.replaceAll("_", " "), x: positions[index + 2][0], y: positions[index + 2][1], strength: Math.min(100, 42 + memory.importance * 11) }));
  tasks.filter((task) => task.status !== "done").slice(0, 2).forEach((task, index) => nodes.push({ id: `task-${task.id}`, label: task.title, kind: "task", detail: `${task.priority} priority`, x: positions[index + 5][0], y: positions[index + 5][1], strength: task.priority === "high" ? 88 : task.priority === "medium" ? 68 : 52 }));
  documents.slice(0, 1).forEach((document, index) => nodes.push({ id: `document-${document.id}`, label: document.title ?? document.filename ?? document.name ?? "Uploaded document", kind: "document", detail: "Indexed document", x: positions[index + 7][0], y: positions[index + 7][1], strength: 66 }));

  if (career?.target_role || career?.current_role) {
    nodes.push({ id: "career-profile", label: career.target_role ?? career.current_role ?? "Career profile", kind: "career", detail: "Career intelligence", x: 52, y: 48, strength: 84 });
  }

  return nodes.slice(0, 8);
}

function MemoryGraphShell({ user, nodes, isLoading = false, isDemo = false, error = "", stats = { memories: 0, tasks: 0, goals: 0, documents: 0 } }: { user: MemoryGraphUser; nodes: GraphNode[]; isLoading?: boolean; isDemo?: boolean; error?: string; stats?: { memories: number; tasks: number; goals: number; documents: number } }) {
  const { resolvedTheme, setTheme } = useTheme();
  const counts = useMemo(() => nodes.reduce((acc, node) => ({ ...acc, [node.kind]: (acc[node.kind] ?? 0) + 1 }), {} as Record<NodeKind, number>), [nodes]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Dashboard</Link></Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground"><Network className="h-5 w-5" /></div>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">HumanOS Memory Graph</p><p className="text-xs text-muted-foreground">Personal intelligence layer for {user.firstName}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" title="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
            <SafeUserButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:px-8">
        <section className="space-y-5">
          <div className="rounded-[1.5rem] border bg-card/65 p-5 shadow-soft backdrop-blur-2xl sm:p-7">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" /> Proprietary context system</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-5xl">The user&apos;s AI memory becomes a graph.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">HumanOS connects durable memories, goals, tasks, documents, career plans, and daily planning into one reusable intelligence layer.</p>
          </div>

          {error && <UpgradeNotice message={error} />}

          <Card className="overflow-hidden bg-card/70 backdrop-blur-2xl">
            <CardContent className="p-0">
              <div className="relative min-h-[520px] overflow-hidden bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.18),transparent_34%),radial-gradient(circle_at_80%_22%,hsl(var(--secondary)/0.16),transparent_30%)]">
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  {nodes.map((node, index) => {
                    const next = nodes[(index + 1) % nodes.length];
                    return <line key={`${node.id}-${next.id}`} x1={node.x} y1={node.y} x2={next.x} y2={next.y} stroke="currentColor" strokeOpacity="0.16" strokeWidth="0.4" />;
                  })}
                  {nodes.slice(0, 4).map((node, index) => {
                    const next = nodes[(index + 3) % nodes.length];
                    return <line key={`${node.id}-cross-${next.id}`} x1={node.x} y1={node.y} x2={next.x} y2={next.y} stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.35" />;
                  })}
                </svg>

                <div className="absolute left-1/2 top-1/2 z-10 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-background/80 text-center shadow-soft backdrop-blur-2xl"><span className="px-3 text-sm font-semibold leading-5">HumanOS Memory Graph</span></div>

                {nodes.map((node) => {
                  const Icon = kindStyles[node.kind].icon;
                  return (
                    <div key={node.id} className={cn("absolute z-20 w-44 -translate-x-1/2 -translate-y-1/2 rounded-lg border p-3 shadow-soft backdrop-blur-2xl animate-soft-in", kindStyles[node.kind].className)} style={{ left: `${node.x}%`, top: `${node.y}%` }}>
                      <div className="flex items-center gap-2"><Icon className="h-4 w-4 shrink-0" /><p className="line-clamp-1 text-sm font-semibold">{node.label}</p></div>
                      <p className="mt-2 line-clamp-1 text-xs opacity-80">{node.detail}</p>
                      <div className="mt-3 h-1.5 rounded-full bg-background/40"><div className="h-full rounded-full bg-current" style={{ width: `${node.strength}%` }} /></div>
                    </div>
                  );
                })}

                {isLoading && <div className="absolute inset-x-4 bottom-4 z-30 flex items-center gap-2 rounded-lg border bg-background/80 p-3 text-sm text-muted-foreground backdrop-blur-xl"><Loader2 className="h-4 w-4 animate-spin" />Loading live graph data</div>}
              </div>
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-5">
          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Target className="h-5 w-5 text-primary" />Why this is defensible</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>The graph turns normal app data into reusable user context. Each chat, document, goal, task, and career action makes the assistant more personal.</p>
              <p>For buyers, this creates a stronger AI SaaS story: proprietary workflow data, connected user context, and a branded intelligence layer.</p>
              {isDemo && <p className="rounded-md border bg-background/60 p-3 text-xs">Showing demo nodes until the user has enough live memories, goals, tasks, and documents.</p>}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Metric label="Memories" value={String(stats.memories || counts.memory || 0)} />
            <Metric label="Goals" value={String(stats.goals || counts.goal || 0)} />
            <Metric label="Open tasks" value={String(stats.tasks || counts.task || 0)} />
            <Metric label="Documents" value={String(stats.documents || counts.document || 0)} />
          </div>

          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BrainCircuit className="h-5 w-5 text-secondary" />Intelligence engines</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {["Personal Memory Engine", "Career Intelligence Engine", "Document Intelligence Engine", "Productivity Intelligence Engine", "Study Intelligence Engine"].map((item) => <div key={item} className="flex items-center justify-between rounded-md border bg-background/60 px-3 py-2 text-sm"><span>{item}</span><span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">active</span></div>)}
            </CardContent>
          </Card>

          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="text-base">Next actions</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              <Button asChild variant="outline" className="justify-between"><Link href="/memory">Add memories <BrainCircuit className="h-4 w-4" /></Link></Button>
              <Button asChild variant="outline" className="justify-between"><Link href="/goals">Create goals <Goal className="h-4 w-4" /></Link></Button>
              <Button asChild variant="outline" className="justify-between"><Link href="/documents">Upload documents <FileText className="h-4 w-4" /></Link></Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-card/65 p-4 shadow-soft backdrop-blur-2xl"><p className="text-xs font-medium uppercase text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-semibold">{value}</p></div>;
}

