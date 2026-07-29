"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { SafeUserButton, useSafeAuth } from "@/components/clerk-safe";
import { useTheme } from "next-themes";
import {
  AlertCircle,
  Bot,
  Brain,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  FolderKanban,
  Goal,
  LayoutDashboard,
  Loader2,
  Menu,
  MessageSquareText,
  Moon,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type SearchResult = { title: string; href: string; detail: string; icon: LucideIcon };

type DashboardTask = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  due_at?: string | null;
  goal_title?: string | null;
};
type DashboardUser = {
  firstName: string;
  fullName: string;
  email: string;
  imageUrl: string;
};

type DashboardStats = {
  memories: number;
  goals: number;
  documents: number;
  agents: number;
  plannerScore: number;
};

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", active: true },
  { label: "AI Chat", icon: MessageSquareText, href: "/chat" },
  { label: "Memory", icon: Brain, href: "/memory" },
  { label: "Tasks", icon: CheckCircle2, href: "/tasks" },
  { label: "Goals", icon: Goal, href: "/goals" },
  { label: "Career", icon: BriefcaseBusiness, href: "/career" },
  { label: "Documents", icon: FileText, href: "/documents" },
  { label: "Agents", icon: Bot, href: "/agents" },
  { label: "AI Labs", icon: Sparkles, href: "/ai-labs" },
  { label: "Planner", icon: CalendarDays, href: "/planner" },
  { label: "Settings", icon: SettingsIcon, href: "/settings" },
];

const searchablePages = [
  { title: "AI Chat", href: "/chat", keywords: "chat assistant conversation history streaming ai ask question" },
  { title: "Memory", href: "/memory", keywords: "memory facts preferences skills projects important context" },
  { title: "Tasks", href: "/tasks", keywords: "task create edit delete complete priority due date" },
  { title: "Goals", href: "/goals", keywords: "goal milestones roadmap progress timeline ai engineer" },
  { title: "Career Copilot", href: "/career", keywords: "resume ats career job interview skill gap roadmap" },
  { title: "Document Copilot", href: "/documents", keywords: "pdf docx txt upload summarize notes action items question" },
  { title: "Agents", href: "/agents", keywords: "career study research productivity document agent action plan" },
  { title: "AI Labs", href: "/ai-labs", keywords: "voice meeting lecture multimodal automation extension whatsapp future" },
  { title: "Daily Planner", href: "/planner", keywords: "daily plan schedule morning evening productivity score" },
  { title: "Pricing", href: "/pricing", keywords: "plan subscription starter pro premium enterprise payment razorpay" },
  { title: "Settings", href: "/settings", keywords: "profile ai preference theme export delete account api key" },
  { title: "Contact Support", href: "/contact", keywords: "support help contact sales billing refund enterprise" },
];

const dashboardCards = [
  {
    id: "ai-chat",
    title: "AI Chat",
    icon: MessageSquareText,
    metric: "24 threads",
    status: "Ready to reason across your work and life context.",
    action: "Open chat",
    href: "/chat",
    tint: "text-primary",
  },
  {
    id: "memory",
    title: "Memory",
    icon: Brain,
    metric: "94% context health",
    status: "Preferences, goals, and decisions are organized.",
    action: "Review memory",
    href: "/memory",
    tint: "text-secondary",
  },
  {
    id: "tasks",
    title: "Tasks",
    icon: CheckCircle2,
    metric: "12 open",
    status: "Four high-priority tasks need attention today.",
    action: "Triage tasks",
    href: "/tasks",
    tint: "text-primary",
  },
  {
    id: "goals",
    title: "Goals",
    icon: Goal,
    metric: "5 active",
    status: "Weekly progress is tracking ahead of baseline.",
    action: "Update goals",
    href: "/goals",
    tint: "text-accent",
  },
  {
    id: "career",
    title: "Career Copilot",
    icon: BriefcaseBusiness,
    metric: "3 focus moves",
    status: "Portfolio proof points and target role narrative are next.",
    action: "View roadmap",
    href: "/career",
    tint: "text-secondary",
  },
  {
    id: "documents",
    title: "Document Copilot",
    icon: FileText,
    metric: "12 insights",
    status: "Recent documents have summaries and action items ready.",
    action: "Open docs",
    href: "/documents",
    tint: "text-primary",
  },
  {
    id: "agents",
    title: "Agents",
    icon: Bot,
    metric: "6 available",
    status: "Research, planning, writing, and execution agents are idle.",
    action: "Launch agent",
    href: "/agents",
    tint: "text-accent",
  },
  {
    id: "ai-labs",
    title: "AI Labs",
    icon: Sparkles,
    metric: "10 future tools",
    status: "Voice, audio notes, multimodal AI, automations, browser capture, and AI twin previews.",
    action: "Explore labs",
    href: "/ai-labs",
    tint: "text-primary",
  },
  {
    id: "planner",
    title: "Daily Planner",
    icon: CalendarDays,
    metric: "82% protected",
    status: "Your deep-work blocks are reserved and balanced.",
    action: "Plan today",
    href: "/planner",
    tint: "text-secondary",
  },
];

function enrichDashboardCards(cards: typeof dashboardCards, summary: { open: number; done: number; high: number; next: string }, stats: DashboardStats) {
  return cards.map((card) => {
    if (card.id === "tasks") return { ...card, metric: `${summary.open} open`, status: summary.high ? `${summary.high} high-priority tasks need attention.` : "Your task list is calm right now." };
    if (card.id === "goals") return { ...card, metric: `${stats.goals} active`, status: stats.goals ? "Long-term outcomes are ready for a progress update." : "Create a goal to begin tracking momentum." };
    if (card.id === "memory") return { ...card, metric: `${stats.memories} saved`, status: stats.memories ? "Your context layer is growing and searchable." : "Save your first durable preference or fact." };
    if (card.id === "documents") return { ...card, metric: `${stats.documents} files`, status: stats.documents ? "Documents are indexed for summary, notes, and actions." : "Upload a PDF, DOCX, or TXT to start." };
    if (card.id === "agents") return { ...card, metric: `${stats.agents || 5} ready`, status: "Career, Study, Research, Productivity, and Document agents are available." };
    if (card.id === "planner") return { ...card, metric: `${stats.plannerScore}% score`, status: stats.plannerScore ? "Today's plan has a productivity score ready." : "Generate a plan to protect your focus." };
    return card;
  });
}

export function DashboardClient({ user, clerkReady }: { user: DashboardUser; clerkReady: boolean }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ memories: 0, goals: 0, documents: 0, agents: 0, plannerScore: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { getToken } = useSafeAuth();
  const { resolvedTheme, setTheme } = useTheme();


  useEffect(() => {
    if (!clerkReady) return;
    async function loadDashboardData() {
      setIsLoading(true);
      setError("");
      try {
        const token = await getToken();
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };
        const [tasksResult, goalsResult, memoriesResult, documentsResult, agentsResult, plannerResult] = await Promise.allSettled([
          fetch(`${API_URL}/tasks`, { headers }),
          fetch(`${API_URL}/goals`, { headers }),
          fetch(`${API_URL}/memories`, { headers }),
          fetch(`${API_URL}/documents`, { headers }),
          fetch(`${API_URL}/agents`, { headers }),
          fetch(`${API_URL}/daily-plans/dashboard`, { headers }),
        ]);

        async function readArray(result: PromiseSettledResult<Response>) {
          if (result.status !== "fulfilled" || !result.value.ok) return [];
          return (await result.value.json()) as unknown[];
        }

        const loadedTasks = (await readArray(tasksResult)) as DashboardTask[];
        const goals = await readArray(goalsResult);
        const memories = await readArray(memoriesResult);
        const documents = await readArray(documentsResult);
        const agents = await readArray(agentsResult);
        let plannerScore = 0;
        if (plannerResult.status === "fulfilled" && plannerResult.value.ok) {
          const planner = (await plannerResult.value.json()) as { productivity_score?: number };
          plannerScore = planner.productivity_score ?? 0;
        }
        setTasks(loadedTasks);
        setStats({ goals: goals.length, memories: memories.length, documents: documents.length, agents: agents.length, plannerScore });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load dashboard data");
      } finally {
        setIsLoading(false);
      }
    }
    void loadDashboardData();
  }, [clerkReady, getToken]);

  const taskSummary = useMemo(() => {
    const open = tasks.filter((task) => task.status !== "done");
    return {
      open: open.length,
      done: tasks.length - open.length,
      high: open.filter((task) => task.priority === "high").length,
      next: open.find((task) => task.due_at)?.title ?? open[0]?.title ?? "No open tasks",
    };
  }, [tasks]);
  const cards = useMemo(() => enrichDashboardCards(dashboardCards, taskSummary, stats), [taskSummary, stats]);
  const searchResults = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return [];
    const pageResults = searchablePages
      .filter((item) => `${item.title} ${item.keywords}`.toLowerCase().includes(normalized))
      .map((item) => ({ title: item.title, href: item.href, detail: "Open page", icon: Search }));
    const cardResults = cards
      .filter((card) => `${card.title} ${card.metric} ${card.status} ${card.action}`.toLowerCase().includes(normalized))
      .map((card) => ({ title: card.title, href: card.href ?? "/dashboard", detail: card.status, icon: card.icon }));
    const taskResults = tasks
      .filter((task) => `${task.title} ${task.priority} ${task.status} ${task.goal_title ?? ""}`.toLowerCase().includes(normalized))
      .slice(0, 4)
      .map((task) => ({ title: task.title, href: "/tasks", detail: `${task.priority} priority task`, icon: CheckCircle2 }));
    const byResult = new Map<string, SearchResult>();
    [...pageResults, ...cardResults, ...taskResults].forEach((result) => {
      if (!byResult.has(`${result.href}-${result.title}`)) byResult.set(`${result.href}-${result.title}`, result);
    });
    return Array.from(byResult.values()).slice(0, 8);
  }, [cards, searchQuery, tasks]);
  const sidebar = <Sidebar onNavigate={() => setSidebarOpen(false)} />;

  return (
    <main className="min-h-screen bg-background/80">
      <div className="lg:hidden">
        <div
          className={cn(
            "fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm transition-opacity",
            sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setSidebarOpen(false)}
        />
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-80 max-w-[86vw] flex-col border-r bg-card/95 p-4 shadow-soft backdrop-blur-2xl transition-transform",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <Brand />
            <Button variant="ghost" size="icon" title="Close navigation" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">{sidebar}</div>
        </aside>
      </div>

      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r bg-card/65 p-4 backdrop-blur-2xl lg:flex">
        <Brand />
        <div className="mt-8 min-h-0 flex-1 overflow-y-auto pr-1">{sidebar}</div>
      </aside>

      <section className="lg:pl-72">
        <TopBar
          user={user}
          onOpenSidebar={() => setSidebarOpen(true)}
          onToggleTheme={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          isDark={resolvedTheme === "dark"}
          clerkReady={clerkReady}
          searchQuery={searchQuery}
          searchResults={searchResults}
          onSearchChange={setSearchQuery}
          onClearSearch={() => setSearchQuery("")}
        />

        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
          <Hero user={user} stats={stats} taskSummary={taskSummary} isLoading={isLoading} />

          {error && <DashboardNotice message={error} />}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <DashboardCard key={card.title} {...card} />
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
            <CommandPanel />
            <TaskSummaryPanel summary={taskSummary} isLoading={isLoading} />
          </section>
        </div>
      </section>
    </main>
  );
}


function DashboardNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500 animate-soft-in">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 font-semibold">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Sparkles className="h-5 w-5" />
      </span>
      <span>
        <span className="block leading-5">HumanOS AI</span>
        <span className="block text-xs font-normal text-muted-foreground">Personal operating system</span>
      </span>
    </Link>
  );
}

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          onClick={onNavigate}
          className={cn(
            "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
            item.active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      ))}

      <div className="mt-6 rounded-lg border bg-background/65 p-4">
        <p className="text-sm font-semibold">Today focus</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Protect one career sprint, clear two task loops, and save one durable memory.</p>
      </div>
    </nav>
  );
}

function TopBar({
  user,
  onOpenSidebar,
  onToggleTheme,
  isDark,
  clerkReady,
  searchQuery,
  searchResults,
  onSearchChange,
  onClearSearch,
}: {
  user: DashboardUser;
  onOpenSidebar: () => void;
  onToggleTheme: () => void;
  isDark: boolean;
  clerkReady: boolean;
  searchQuery: string;
  searchResults: SearchResult[];
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/70 backdrop-blur-2xl">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" title="Open navigation" onClick={onOpenSidebar}>
            <Menu className="h-5 w-5" />
          </Button>
          <GlobalSearch query={searchQuery} results={searchResults} onChange={onSearchChange} onClear={onClearSearch} />
          <div className="sm:hidden">
            <p className="text-sm font-semibold">Dashboard</p>
            <p className="text-xs text-muted-foreground">Welcome, {user.firstName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" title="Toggle dark mode" onClick={onToggleTheme}>
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button asChild variant="outline" className="hidden sm:inline-flex">
            <Link href="/settings"><SettingsIcon className="h-4 w-4" />Settings</Link>
          </Button>
          {clerkReady ? <SafeUserButton /> : <Button asChild><Link href="/sign-in">Login</Link></Button>}
        </div>
      </div>
    </header>
  );
}


function GlobalSearch({
  query,
  results,
  onChange,
  onClear,
}: {
  query: string;
  results: SearchResult[];
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="relative hidden w-[min(42vw,420px)] sm:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search HumanOS"
        className="h-10 w-full rounded-md border bg-card/70 px-9 text-sm outline-none shadow-soft transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {query && (
        <button type="button" onClick={onClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground" title="Clear search">
          <X className="h-4 w-4" />
        </button>
      )}
      {query && (
        <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-lg border bg-card shadow-soft backdrop-blur-2xl">
          {results.length ? (
            <div className="max-h-96 overflow-auto p-2">
              {results.map((result) => (
                <Link key={`${result.href}-${result.title}`} href={result.href} onClick={onClear} className="flex items-start gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-muted">
                  <result.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block font-medium">{result.title}</span>
                    <span className="line-clamp-1 text-xs text-muted-foreground">{result.detail}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              No results found. Try chat, tasks, resume, documents, pricing, or settings.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Hero({ user, stats, taskSummary, isLoading }: { user: DashboardUser; stats: DashboardStats; taskSummary: { open: number; done: number; high: number; next: string }; isLoading: boolean }) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
      <div className="rounded-[1.5rem] border bg-card/65 p-6 shadow-soft backdrop-blur-2xl sm:p-8">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary">
          <LayoutDashboard className="h-4 w-4" /> Main dashboard
        </p>
        <h1 className="mt-4 max-w-4xl text-3xl font-semibold sm:text-5xl">Good to see you, {user.firstName}. Your day has a shape now.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          HumanOS is coordinating your chat, memory, tasks, goals, career moves, documents, agents, and daily plan from one protected workspace.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Focus score" value={isLoading ? "..." : `${stats.plannerScore || Math.max(0, 100 - taskSummary.open * 4)}%`} />
        <Metric label="Open loops" value={isLoading ? "..." : String(taskSummary.open)} />
        <Metric label="Memories" value={isLoading ? "..." : String(stats.memories)} />
        <Metric label="Agents ready" value={isLoading ? "..." : String(stats.agents || 5)} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card/65 p-4 shadow-soft backdrop-blur-2xl animate-soft-in">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function DashboardCard({
  id,
  title,
  icon: Icon,
  metric,
  status,
  action,
  tint,
  href,
}: {
  id: string;
  title: string;
  icon: typeof Brain;
  metric: string;
  status: string;
  action: string;
  tint: string;
  href?: string;
}) {
  return (
    <Card id={id} className="group bg-card/65 backdrop-blur-2xl polished-card animate-soft-in hover:bg-card/85">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2"><Icon className={cn("h-5 w-5", tint)} />{title}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{metric}</p>
        <p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">{status}</p>
        <Button asChild={Boolean(href)} variant="outline" size="sm" className="mt-5 w-full justify-between bg-background/50">
          {href ? (
            <Link href={href} className="flex w-full items-center justify-between">{action}<ChevronRight className="h-4 w-4" /></Link>
          ) : (
            <span className="flex w-full items-center justify-between">{action}<ChevronRight className="h-4 w-4" /></span>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function CommandPanel() {
  return (
    <Card className="bg-card/65 backdrop-blur-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FolderKanban className="h-5 w-5 text-primary" /> Operating queue</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        {[
          ["Next best action", "Draft the career proof-point case study."],
          ["Memory prompt", "Save the decision behind today's priority."],
          ["Agent handoff", "Ask Research Agent for market examples."],
        ].map(([label, text]) => (
          <div key={label} className="rounded-lg border bg-background/65 p-4">
            <p className="text-sm font-semibold">{label}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}


function TaskSummaryPanel({ summary, isLoading }: { summary: { open: number; done: number; high: number; next: string }; isLoading: boolean }) {
  return (
    <Card className="bg-card/65 backdrop-blur-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Task summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading task summary</p>}
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Open" value={String(summary.open)} />
          <Metric label="Done" value={String(summary.done)} />
          <Metric label="High" value={String(summary.high)} />
        </div>
        <div className="rounded-lg border bg-background/65 p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">Next task</p>
          <p className="mt-2 text-sm font-semibold leading-6">{summary.next}</p>
        </div>
        <Button asChild variant="outline" className="w-full justify-between bg-background/50">
          <Link href="/tasks">Open tasks<ChevronRight className="h-4 w-4" /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}
