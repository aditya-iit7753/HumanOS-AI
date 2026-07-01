"use client";

import Link from "next/link";
import { UserButton, useAuth } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { Bot, BriefcaseBusiness, CheckCircle2, ChevronLeft, FileText, GraduationCap, Loader2, Moon, Search, Sparkles, Sun, TimerReset, Zap } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type AppUser = { firstName: string; fullName: string; email: string };
type AgentType = "career" | "study" | "research" | "productivity" | "document";
type AgentRecord = { id: string; name: string; purpose: string; status: string; instructions: string; tools: string[]; schedule: { agent_type?: AgentType; latest_output?: AgentOutput; outputs?: AgentOutput[]; latest_research?: ResearchResult; research_results?: ResearchResult[]; latest_study?: StudyResult; study_results?: StudyResult[]; latest_productivity?: ProductivityResult; productivity_results?: ProductivityResult[] }; last_run_at?: string | null; created_at: string; updated_at: string };
type CatalogItem = { agent_type: AgentType; name: string; purpose: string; instructions: string; tools: string[]; agent: AgentRecord };
type AgentOutput = { agent_type: AgentType; title: string; summary: string; tools_used: string[]; action_plan: { title: string; description: string; tool?: string; priority?: string }[]; next_task: string; confidence: number; objective?: string; created_at?: string };
type ResearchResult = { topic: string; title: string; summary: string; key_points: string[]; pros: string[]; cons: string[]; learning_roadmap: { title: string; description: string }[]; suggested_tasks: { title: string; notes: string; priority: string }[]; notes: string; created_at?: string };
type StudyResult = { topic: string; title: string; simple_explanation: string; study_plan: { day: string; title: string; description: string }[]; quiz: { question: string; answer: string; difficulty: string }[]; flashcards: { front: string; back: string }[]; weak_areas: { area: string; fix: string }[]; daily_tasks: { title: string; notes: string; priority: string }[]; notes: string; created_at?: string };
type ProductivityResult = { title: string; summary: string; priorities: { title: string; reason?: string; priority?: string; task_id?: string }[]; daily_focus_list: { title: string; time_block?: string; success_marker?: string }[]; procrastination_patterns: { pattern: string; evidence: string; fix: string }[]; improvement_plan: { title: string; description: string }[]; weekly_summary: { completed_tasks?: number; open_tasks?: number; active_goals?: number; readout?: string }; suggested_tasks: { title: string; notes: string; priority: string }[]; notes: string; created_at?: string };

const localAgents: Record<AgentType, { label: string; icon: typeof Bot; objective: string; tone: string }> = {
  career: { label: "Career Agent", icon: BriefcaseBusiness, objective: "Create a career action plan for the next 7 days", tone: "Role targeting, resume strength, interview prep, and portfolio proof." },
  study: { label: "Study Agent", icon: GraduationCap, objective: "Build a study plan for my most important learning goal", tone: "Learning blocks, notes, review loops, and comprehension checks." },
  research: { label: "Research Agent", icon: Search, objective: "Create a research brief and next-question plan", tone: "Synthesis, comparison, open questions, and decision memos." },
  productivity: { label: "Productivity Agent", icon: TimerReset, objective: "Triage my tasks and create an execution plan", tone: "Task cleanup, priorities, momentum, and daily follow-through." },
  document: { label: "Document Agent", icon: FileText, objective: "Analyze my recent documents and extract action items", tone: "Summaries, notes, document Q&A, and concrete next actions." },
};

const agentOrder: AgentType[] = ["career", "study", "research", "productivity", "document"];

export function AgentsClient({ user, clerkReady, activeAgentType }: { user: AppUser; clerkReady: boolean; activeAgentType?: string }) {
  if (!clerkReady) return <AgentsPreview user={user} />;
  return <AuthenticatedAgents user={user} initialAgentType={(activeAgentType as AgentType | undefined) ?? "career"} />;
}

function AuthenticatedAgents({ user, initialAgentType }: { user: AppUser; initialAgentType: AgentType }) {
  const { getToken } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [activeAgentType, setActiveAgentType] = useState<AgentType>(initialAgentType);
  const [objective, setObjective] = useState(localAgents[initialAgentType].objective);
  const [context, setContext] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [output, setOutput] = useState<AgentOutput | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [researchTopic, setResearchTopic] = useState("AI agents for personal productivity");
  const [researchDepth, setResearchDepth] = useState("practical");
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [convertStatus, setConvertStatus] = useState("");
  const [studyTopic, setStudyTopic] = useState("Machine learning fundamentals");
  const [studyLevel, setStudyLevel] = useState("beginner");
  const [studyGoal, setStudyGoal] = useState("Understand the topic well enough to explain it and complete practice problems");
  const [studyTime, setStudyTime] = useState("45 minutes per day");
  const [studyResult, setStudyResult] = useState<StudyResult | null>(null);
  const [isStudying, setIsStudying] = useState(false);
  const [productivityFocus, setProductivityFocus] = useState("Prioritize my incomplete tasks and protect focus today");
  const [productivityTimeframe, setProductivityTimeframe] = useState("today");
  const [productivityResult, setProductivityResult] = useState<ProductivityResult | null>(null);
  const [isAnalyzingProductivity, setIsAnalyzingProductivity] = useState(false);

  const activeCatalog = useMemo(() => catalog.find((item) => item.agent_type === activeAgentType), [activeAgentType, catalog]);
  const activeAgent = activeCatalog?.agent;
  const activeLocal = localAgents[activeAgentType];
  const latestOutput = output ?? activeAgent?.schedule?.latest_output ?? null;
  const history = activeAgent?.schedule?.outputs ?? [];
  const researchHistory = activeAgent?.schedule?.research_results ?? [];
  const studyHistory = activeAgent?.schedule?.study_results ?? [];
  const productivityHistory = activeAgent?.schedule?.productivity_results ?? [];
  const tools = activeCatalog?.tools ?? activeAgent?.tools ?? [];

  useEffect(() => {
    void loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setActiveAgentType(initialAgentType);
    setObjective(localAgents[initialAgentType].objective);
  }, [initialAgentType]);

  useEffect(() => {
    setSelectedTools(tools.slice(0, 3));
    setOutput(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAgentType, catalog.length]);

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await getToken();
    if (!token) throw new Error("Missing Clerk session token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  async function loadCatalog() {
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/agents/catalog`, { headers });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as CatalogItem[];
      setCatalog(data);
      const researchAgent = data.find((item) => item.agent_type === "research")?.agent;
      const studyAgent = data.find((item) => item.agent_type === "study")?.agent;
      const productivityAgent = data.find((item) => item.agent_type === "productivity")?.agent;
      setResearchResult((researchAgent?.schedule?.latest_research as ResearchResult | undefined) ?? null);
      setStudyResult((studyAgent?.schedule?.latest_study as StudyResult | undefined) ?? null);
      setProductivityResult((productivityAgent?.schedule?.latest_productivity as ProductivityResult | undefined) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load agents");
    }
  }

  async function runAgent(event: FormEvent) {
    event.preventDefault();
    if (!objective.trim()) return;
    setIsRunning(true);
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/agents/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({ agent_type: activeAgentType, objective: objective.trim(), context, tool_preferences: selectedTools }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as { agent: AgentRecord; output: AgentOutput };
      setOutput(data.output);
      setCatalog((current) => current.map((item) => (item.agent_type === activeAgentType ? { ...item, agent: data.agent } : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent run failed");
    } finally {
      setIsRunning(false);
    }
  }


  async function runProductivity(event: FormEvent) {
    event.preventDefault();
    setIsAnalyzingProductivity(true);
    setConvertStatus("");
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/agents/productivity/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({ focus: productivityFocus, timeframe: productivityTimeframe, context }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as { agent: AgentRecord; result: ProductivityResult };
      setProductivityResult(data.result);
      setCatalog((current) => current.map((item) => (item.agent_type === "productivity" ? { ...item, agent: data.agent } : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Productivity Agent failed");
    } finally {
      setIsAnalyzingProductivity(false);
    }
  }

  async function convertProductivity(mode: "notes" | "tasks") {
    if (!productivityResult) return;
    setConvertStatus("");
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/agents/productivity/convert`, {
        method: "POST",
        headers,
        body: JSON.stringify({ mode, result: productivityResult }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as { created: unknown[] };
      setConvertStatus(mode === "notes" ? "Productivity review saved to Memory." : `${data.created.length} productivity tasks created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to convert productivity result");
    }
  }


  async function runStudy(event: FormEvent) {
    event.preventDefault();
    if (!studyTopic.trim()) return;
    setIsStudying(true);
    setConvertStatus("");
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/agents/study/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({ topic: studyTopic.trim(), level: studyLevel, goal: studyGoal, time_available: studyTime, context }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as { agent: AgentRecord; result: StudyResult };
      setStudyResult(data.result);
      setCatalog((current) => current.map((item) => (item.agent_type === "study" ? { ...item, agent: data.agent } : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Study Agent failed");
    } finally {
      setIsStudying(false);
    }
  }

  async function convertStudy(mode: "notes" | "tasks") {
    if (!studyResult) return;
    setConvertStatus("");
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/agents/study/convert`, {
        method: "POST",
        headers,
        body: JSON.stringify({ mode, result: studyResult }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as { created: unknown[] };
      setConvertStatus(mode === "notes" ? "Study notes saved to Memory." : `${data.created.length} study tasks created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to convert study result");
    }
  }


  async function runResearch(event: FormEvent) {
    event.preventDefault();
    if (!researchTopic.trim()) return;
    setIsResearching(true);
    setConvertStatus("");
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/agents/research/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({ topic: researchTopic.trim(), depth: researchDepth, context }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as { agent: AgentRecord; result: ResearchResult };
      setResearchResult(data.result);
      setCatalog((current) => current.map((item) => (item.agent_type === "research" ? { ...item, agent: data.agent } : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research Agent failed");
    } finally {
      setIsResearching(false);
    }
  }

  async function convertResearch(mode: "notes" | "tasks") {
    if (!researchResult) return;
    setConvertStatus("");
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/agents/research/convert`, {
        method: "POST",
        headers,
        body: JSON.stringify({ mode, result: researchResult }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as { created: unknown[] };
      setConvertStatus(mode === "notes" ? "Research notes saved to Memory." : `${data.created.length} research tasks created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to convert research");
    }
  }

  function toggleTool(tool: string) {
    setSelectedTools((current) => (current.includes(tool) ? current.filter((item) => item !== tool) : [...current, tool]));
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="sm"><Link href="/dashboard"><ChevronLeft className="h-4 w-4" />Dashboard</Link></Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">HumanOS Agents</p>
              <p className="text-xs text-muted-foreground">{user.firstName}, run specialized copilots with your memory and workspace context</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" title="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <UserButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[20rem_1fr] lg:px-8">
        <aside className="flex flex-col gap-3">
          {agentOrder.map((agentType) => {
            const meta = localAgents[agentType];
            const Icon = meta.icon;
            const item = catalog.find((entry) => entry.agent_type === agentType);
            return (
              <Link key={agentType} href={`/agents/${agentType}`} onClick={() => setActiveAgentType(agentType)} className={cn("rounded-xl border bg-card/70 p-4 backdrop-blur-2xl transition hover:bg-muted", activeAgentType === agentType && "border-primary bg-primary/10")}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <p className="font-semibold">{meta.label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item?.purpose ?? meta.tone}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </aside>

        {activeAgentType === "productivity" ? (
          <ProductivityWorkspace
            agent={activeAgent}
            context={context}
            convertStatus={convertStatus}
            error={error}
            focus={productivityFocus}
            history={productivityHistory as ProductivityResult[]}
            isAnalyzing={isAnalyzingProductivity}
            onContext={setContext}
            onConvert={(mode) => void convertProductivity(mode)}
            onFocus={setProductivityFocus}
            onRun={(event) => void runProductivity(event)}
            onTimeframe={setProductivityTimeframe}
            result={productivityResult}
            timeframe={productivityTimeframe}
          />
        ) : activeAgentType === "study" ? (
          <StudyWorkspace
            agent={activeAgent}
            context={context}
            convertStatus={convertStatus}
            error={error}
            goal={studyGoal}
            history={studyHistory as StudyResult[]}
            isStudying={isStudying}
            level={studyLevel}
            onContext={setContext}
            onConvert={(mode) => void convertStudy(mode)}
            onGoal={setStudyGoal}
            onLevel={setStudyLevel}
            onRun={(event) => void runStudy(event)}
            onTime={setStudyTime}
            onTopic={setStudyTopic}
            result={studyResult}
            timeAvailable={studyTime}
            topic={studyTopic}
          />
        ) : activeAgentType === "research" ? (
          <ResearchWorkspace
            agent={activeAgent}
            context={context}
            convertStatus={convertStatus}
            error={error}
            history={researchHistory as ResearchResult[]}
            isResearching={isResearching}
            onContext={setContext}
            onConvert={(mode) => void convertResearch(mode)}
            onDepth={setResearchDepth}
            onRun={(event) => void runResearch(event)}
            onTopic={setResearchTopic}
            result={researchResult}
            topic={researchTopic}
            depth={researchDepth}
          />
        ) : (
        <section className="grid gap-4 xl:grid-cols-[1fr_.9fr]">
          <div className="flex flex-col gap-4">
            <Card className="bg-card/70 backdrop-blur-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><activeLocal.icon className="h-5 w-5 text-primary" /> {activeLocal.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">{activeCatalog?.purpose ?? activeLocal.tone}</p>
                <form onSubmit={runAgent} className="mt-5 space-y-4">
                  <Textarea value={objective} onChange={(event) => setObjective(event.target.value)} className="min-h-24" placeholder="What should this agent produce?" />
                  <Textarea value={context} onChange={(event) => setContext(event.target.value)} className="min-h-20" placeholder="Optional context, constraints, links, or preferences" />
                  <div className="flex flex-wrap gap-2">
                    {tools.map((tool) => (
                      <button key={tool} type="button" onClick={() => toggleTool(tool)} className={cn("rounded-md border px-3 py-1.5 text-xs transition hover:bg-muted", selectedTools.includes(tool) ? "border-primary bg-primary/10 text-primary" : "bg-background/70 text-muted-foreground")}>
                        {tool.replaceAll("_", " ")}
                      </button>
                    ))}
                  </div>
                  {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
                  <Button disabled={isRunning || !objective.trim()}>{isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}Run agent</Button>
                </form>
              </CardContent>
            </Card>

            <OutputPanel output={latestOutput} isRunning={isRunning} />
          </div>

          <div className="flex flex-col gap-4">
            <AgentStatusPanel agent={activeAgent} tools={tools} />
            <HistoryPanel history={history} />
          </div>
        </section>
        )}
      </div>
    </main>
  );
}




function ProductivityWorkspace({ agent, context, convertStatus, error, focus, history, isAnalyzing, onContext, onConvert, onFocus, onRun, onTimeframe, result, timeframe }: { agent?: AgentRecord; context: string; convertStatus: string; error: string; focus: string; history: ProductivityResult[]; isAnalyzing: boolean; onContext: (value: string) => void; onConvert: (mode: "notes" | "tasks") => void; onFocus: (value: string) => void; onRun: (event: FormEvent) => void; onTimeframe: (value: string) => void; result: ProductivityResult | null; timeframe: string }) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_.9fr]">
      <div className="flex flex-col gap-4">
        <Card className="bg-card/70 backdrop-blur-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TimerReset className="h-5 w-5 text-primary" /> Productivity Agent</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">Analyze incomplete tasks, detect procrastination patterns, prioritize work, create a daily focus list, and produce a weekly productivity summary.</p>
            <form onSubmit={onRun} className="mt-5 space-y-4">
              <Textarea value={focus} onChange={(event) => onFocus(event.target.value)} className="min-h-20" placeholder="What should productivity improve?" />
              <Textarea value={context} onChange={(event) => onContext(event.target.value)} className="min-h-16" placeholder="Optional blockers, energy, schedule constraints, or work context" />
              <select value={timeframe} onChange={(event) => onTimeframe(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="today">Today</option><option value="this week">This week</option><option value="next 7 days">Next 7 days</option></select>
              {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
              <Button disabled={isAnalyzing}>{isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TimerReset className="h-4 w-4" />}Analyze productivity</Button>
            </form>
          </CardContent>
        </Card>
        <ProductivityResultPanel result={result} isAnalyzing={isAnalyzing} onConvert={onConvert} convertStatus={convertStatus} />
      </div>
      <div className="flex flex-col gap-4">
        <AgentStatusPanel agent={agent} tools={["tasks", "goals", "daily_plans", "memories", "priority_analysis", "weekly_summary"]} />
        <ProductivityHistoryPanel history={history} />
      </div>
    </section>
  );
}

function ProductivityResultPanel({ result, isAnalyzing, onConvert, convertStatus }: { result: ProductivityResult | null; isAnalyzing: boolean; onConvert: (mode: "notes" | "tasks") => void; convertStatus: string }) {
  return (
    <Card className="bg-card/70 backdrop-blur-2xl">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-5 w-5 text-secondary" /> Productivity analysis</CardTitle></CardHeader>
      <CardContent>
        {isAnalyzing && !result ? <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Productivity Agent is reading your task system</div> : result ? (
          <div className="space-y-5">
            <div><p className="text-xl font-semibold">{result.title}</p><p className="mt-2 text-sm leading-7 text-muted-foreground">{result.summary}</p></div>
            <div className="grid gap-3 sm:grid-cols-3"><Metric label="Completed" value={String(result.weekly_summary.completed_tasks ?? 0)} /><Metric label="Open" value={String(result.weekly_summary.open_tasks ?? 0)} /><Metric label="Goals" value={String(result.weekly_summary.active_goals ?? 0)} /></div>
            <ProductivityList title="Suggested priorities" items={result.priorities.map((item) => ({ title: item.title, body: item.reason ?? item.priority ?? "Priority" }))} />
            <ProductivityList title="Daily focus list" items={result.daily_focus_list.map((item) => ({ title: item.title, body: `${item.time_block ?? "Focus block"}: ${item.success_marker ?? "Complete or clarify next step."}` }))} />
            <ProductivityList title="Procrastination patterns" items={result.procrastination_patterns.map((item) => ({ title: item.pattern, body: `${item.evidence} Fix: ${item.fix}` }))} />
            <ProductivityList title="Improvement plan" items={result.improvement_plan.map((item) => ({ title: item.title, body: item.description }))} />
            {result.weekly_summary.readout && <div className="rounded-lg border bg-background/65 p-4 text-sm leading-6 text-muted-foreground">{result.weekly_summary.readout}</div>}
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => onConvert("notes")}>Save review notes</Button><Button variant="outline" onClick={() => onConvert("tasks")}>Create improvement tasks</Button></div>
            {convertStatus && <p className="rounded-lg border bg-primary/10 p-3 text-sm text-primary">{convertStatus}</p>}
          </div>
        ) : <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border bg-background/60 p-8 text-center"><TimerReset className="h-10 w-10 text-muted-foreground" /><p className="mt-4 text-lg font-semibold">Analyze execution</p><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Your priorities, focus list, patterns, and weekly summary will appear here.</p></div>}
      </CardContent>
    </Card>
  );
}

function ProductivityList({ title, items }: { title: string; items: { title: string; body: string }[] }) {
  return <div><p className="text-sm font-semibold">{title}</p><div className="mt-2 space-y-2">{items.map((item, index) => <div key={`${title}-${index}`} className="rounded-lg border bg-background/65 p-3"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.body}</p></div>)}</div></div>;
}

function ProductivityHistoryPanel({ history }: { history: ProductivityResult[] }) {
  return <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-5 w-5 text-secondary" /> Productivity history</CardTitle></CardHeader><CardContent className="space-y-2">{history.length === 0 ? <p className="text-sm text-muted-foreground">No saved productivity reviews yet.</p> : history.slice(0, 8).map((item, index) => <div key={`${item.created_at}-${index}`} className="rounded-lg border bg-background/65 p-3"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.summary}</p></div>)}</CardContent></Card>;
}

function StudyWorkspace({
  agent,
  context,
  convertStatus,
  error,
  goal,
  history,
  isStudying,
  level,
  onContext,
  onConvert,
  onGoal,
  onLevel,
  onRun,
  onTime,
  onTopic,
  result,
  timeAvailable,
  topic,
}: {
  agent?: AgentRecord;
  context: string;
  convertStatus: string;
  error: string;
  goal: string;
  history: StudyResult[];
  isStudying: boolean;
  level: string;
  onContext: (value: string) => void;
  onConvert: (mode: "notes" | "tasks") => void;
  onGoal: (value: string) => void;
  onLevel: (value: string) => void;
  onRun: (event: FormEvent) => void;
  onTime: (value: string) => void;
  onTopic: (value: string) => void;
  result: StudyResult | null;
  timeAvailable: string;
  topic: string;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_.9fr]">
      <div className="flex flex-col gap-4">
        <Card className="bg-card/70 backdrop-blur-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><GraduationCap className="h-5 w-5 text-primary" /> Study Agent</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">Create a study plan, simple explanation, quiz, flashcards, weak-area review, and daily learning tasks from your HumanOS context.</p>
            <form onSubmit={onRun} className="mt-5 space-y-4">
              <Textarea value={topic} onChange={(event) => onTopic(event.target.value)} className="min-h-20" placeholder="Topic to study" />
              <Textarea value={goal} onChange={(event) => onGoal(event.target.value)} className="min-h-16" placeholder="Learning goal" />
              <Textarea value={context} onChange={(event) => onContext(event.target.value)} className="min-h-16" placeholder="Optional context, class, exam, project, or weak areas" />
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={level} onChange={(event) => onLevel(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select>
                <select value={timeAvailable} onChange={(event) => onTime(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="20 minutes per day">20 minutes per day</option><option value="45 minutes per day">45 minutes per day</option><option value="90 minutes per day">90 minutes per day</option><option value="weekend intensive">Weekend intensive</option></select>
              </div>
              {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
              <Button disabled={isStudying || !topic.trim()}>{isStudying ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}Create study plan</Button>
            </form>
          </CardContent>
        </Card>
        <StudyResultPanel result={result} isStudying={isStudying} onConvert={onConvert} convertStatus={convertStatus} />
      </div>
      <div className="flex flex-col gap-4">
        <AgentStatusPanel agent={agent} tools={["memories", "documents", "study_plan", "quiz", "flashcards", "weak_areas", "tasks"]} />
        <StudyHistoryPanel history={history} />
      </div>
    </section>
  );
}

function StudyResultPanel({ result, isStudying, onConvert, convertStatus }: { result: StudyResult | null; isStudying: boolean; onConvert: (mode: "notes" | "tasks") => void; convertStatus: string }) {
  return (
    <Card className="bg-card/70 backdrop-blur-2xl">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-5 w-5 text-secondary" /> Study result</CardTitle></CardHeader>
      <CardContent>
        {isStudying && !result ? <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Study Agent is preparing your learning system</div> : result ? (
          <div className="space-y-5">
            <div><p className="text-xl font-semibold">{result.title}</p><p className="mt-2 text-sm leading-7 text-muted-foreground">{result.simple_explanation}</p></div>
            <div><p className="text-sm font-semibold">Study plan</p><div className="mt-2 space-y-2">{result.study_plan.map((item, index) => <div key={`${item.day}-${index}`} className="rounded-lg border bg-background/65 p-3"><p className="text-sm font-semibold">{item.day}: {item.title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p></div>)}</div></div>
            <div className="grid gap-3 md:grid-cols-2"><QuizList quiz={result.quiz} /><FlashcardList cards={result.flashcards} /></div>
            <div><p className="text-sm font-semibold">Weak areas</p><div className="mt-2 space-y-2">{result.weak_areas.map((item, index) => <div key={`${item.area}-${index}`} className="rounded-lg border bg-background/65 p-3"><p className="text-sm font-semibold">{item.area}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.fix}</p></div>)}</div></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => onConvert("notes")}>Save as notes</Button><Button variant="outline" onClick={() => onConvert("tasks")}>Create daily tasks</Button></div>
            {convertStatus && <p className="rounded-lg border bg-primary/10 p-3 text-sm text-primary">{convertStatus}</p>}
          </div>
        ) : <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border bg-background/60 p-8 text-center"><GraduationCap className="h-10 w-10 text-muted-foreground" /><p className="mt-4 text-lg font-semibold">Create a learning system</p><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Your study plan, quiz, flashcards, and weak areas will appear here.</p></div>}
      </CardContent>
    </Card>
  );
}

function QuizList({ quiz }: { quiz: StudyResult["quiz"] }) {
  return <div><p className="text-sm font-semibold">Quiz</p><div className="mt-2 space-y-2">{quiz.map((item, index) => <div key={`${item.question}-${index}`} className="rounded-lg border bg-background/65 p-3"><p className="text-sm font-semibold">{item.question}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.answer}</p></div>)}</div></div>;
}

function FlashcardList({ cards }: { cards: StudyResult["flashcards"] }) {
  return <div><p className="text-sm font-semibold">Flashcards</p><div className="mt-2 space-y-2">{cards.map((item, index) => <div key={`${item.front}-${index}`} className="rounded-lg border bg-background/65 p-3"><p className="text-sm font-semibold">{item.front}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.back}</p></div>)}</div></div>;
}

function StudyHistoryPanel({ history }: { history: StudyResult[] }) {
  return <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-5 w-5 text-secondary" /> Study history</CardTitle></CardHeader><CardContent className="space-y-2">{history.length === 0 ? <p className="text-sm text-muted-foreground">No saved study plans yet.</p> : history.slice(0, 8).map((item, index) => <div key={`${item.created_at}-${index}`} className="rounded-lg border bg-background/65 p-3"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.simple_explanation}</p></div>)}</CardContent></Card>;
}

function ResearchWorkspace({
  agent,
  context,
  convertStatus,
  depth,
  error,
  history,
  isResearching,
  onContext,
  onConvert,
  onDepth,
  onRun,
  onTopic,
  result,
  topic,
}: {
  agent?: AgentRecord;
  context: string;
  convertStatus: string;
  depth: string;
  error: string;
  history: ResearchResult[];
  isResearching: boolean;
  onContext: (value: string) => void;
  onConvert: (mode: "notes" | "tasks") => void;
  onDepth: (value: string) => void;
  onRun: (event: FormEvent) => void;
  onTopic: (value: string) => void;
  result: ResearchResult | null;
  topic: string;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_.9fr]">
      <div className="flex flex-col gap-4">
        <Card className="bg-card/70 backdrop-blur-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Search className="h-5 w-5 text-primary" /> Research Agent</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">Enter a topic and HumanOS will create a research summary, key points, pros and cons, a learning roadmap, and follow-up tasks using your memories and documents.</p>
            <form onSubmit={onRun} className="mt-5 space-y-4">
              <Textarea value={topic} onChange={(event) => onTopic(event.target.value)} className="min-h-20" placeholder="Research topic" />
              <Textarea value={context} onChange={(event) => onContext(event.target.value)} className="min-h-20" placeholder="Optional context, constraints, audience, or what you already know" />
              <select value={depth} onChange={(event) => onDepth(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="quick">Quick brief</option>
                <option value="practical">Practical</option>
                <option value="deep">Deep learning plan</option>
              </select>
              {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
              <Button disabled={isResearching || !topic.trim()}>{isResearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Create research result</Button>
            </form>
          </CardContent>
        </Card>
        <ResearchResultPanel result={result} isResearching={isResearching} onConvert={onConvert} convertStatus={convertStatus} />
      </div>
      <div className="flex flex-col gap-4">
        <AgentStatusPanel agent={agent} tools={["memories", "documents", "research_synthesis", "pros_cons", "roadmap", "tasks"]} />
        <ResearchHistoryPanel history={history} />
      </div>
    </section>
  );
}

function ResearchResultPanel({ result, isResearching, onConvert, convertStatus }: { result: ResearchResult | null; isResearching: boolean; onConvert: (mode: "notes" | "tasks") => void; convertStatus: string }) {
  return (
    <Card className="bg-card/70 backdrop-blur-2xl">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-5 w-5 text-secondary" /> Research result</CardTitle></CardHeader>
      <CardContent>
        {isResearching && !result ? (
          <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Research Agent is synthesizing</div>
        ) : result ? (
          <div className="space-y-5">
            <div>
              <p className="text-xl font-semibold">{result.title}</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{result.summary}</p>
            </div>
            <SectionList title="Key points" items={result.key_points} />
            <div className="grid gap-3 md:grid-cols-2">
              <SectionList title="Pros" items={result.pros} />
              <SectionList title="Cons" items={result.cons} />
            </div>
            <div>
              <p className="text-sm font-semibold">Learning roadmap</p>
              <div className="mt-2 space-y-2">{result.learning_roadmap.map((item, index) => <div key={`${item.title}-${index}`} className="rounded-lg border bg-background/65 p-3"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p></div>)}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => onConvert("notes")}>Save as notes</Button>
              <Button variant="outline" onClick={() => onConvert("tasks")}>Create tasks</Button>
            </div>
            {convertStatus && <p className="rounded-lg border bg-primary/10 p-3 text-sm text-primary">{convertStatus}</p>}
          </div>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border bg-background/60 p-8 text-center"><Search className="h-10 w-10 text-muted-foreground" /><p className="mt-4 text-lg font-semibold">Research a topic</p><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Your saved result will appear here with notes and task conversion actions.</p></div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionList({ title, items }: { title: string; items: string[] }) {
  return <div><p className="text-sm font-semibold">{title}</p><div className="mt-2 space-y-2">{items.map((item, index) => <div key={`${title}-${index}`} className="rounded-lg border bg-background/65 p-3 text-sm leading-6 text-muted-foreground">{item}</div>)}</div></div>;
}

function ResearchHistoryPanel({ history }: { history: ResearchResult[] }) {
  return (
    <Card className="bg-card/70 backdrop-blur-2xl">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-5 w-5 text-secondary" /> Research history</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {history.length === 0 ? <p className="text-sm text-muted-foreground">No saved research yet.</p> : history.slice(0, 8).map((item, index) => <div key={`${item.created_at}-${index}`} className="rounded-lg border bg-background/65 p-3"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.summary}</p></div>)}
      </CardContent>
    </Card>
  );
}

function OutputPanel({ output, isRunning }: { output: AgentOutput | null; isRunning: boolean }) {
  return (
    <Card className="bg-card/70 backdrop-blur-2xl">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-5 w-5 text-secondary" /> Saved output</CardTitle></CardHeader>
      <CardContent>
        {isRunning && !output ? (
          <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Agent is reading your workspace</div>
        ) : output ? (
          <div className="space-y-4">
            <div>
              <p className="text-xl font-semibold">{output.title}</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{output.summary}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Confidence" value={`${output.confidence ?? 0}%`} />
              <Metric label="Tools used" value={String(output.tools_used?.length ?? 0)} />
            </div>
            <div className="space-y-2">
              {(output.action_plan ?? []).map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-lg border bg-background/65 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{item.title}</p>
                    {item.priority && <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{item.priority}</span>}
                    {item.tool && <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">{item.tool}</span>}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border bg-primary/10 p-4 text-sm"><span className="font-semibold">Next task:</span> {output.next_task}</div>
          </div>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border bg-background/60 p-8 text-center">
            <Bot className="h-10 w-10 text-muted-foreground" />
            <p className="mt-4 text-lg font-semibold">Run this agent to generate an action plan</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">The output will be saved to PostgreSQL on the agent record and shown here as the latest result.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AgentStatusPanel({ agent, tools }: { agent?: AgentRecord; tools: string[] }) {
  return (
    <Card className="bg-card/70 backdrop-blur-2xl">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-5 w-5 text-primary" /> Agent status</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Metric label="Status" value={agent?.status ?? "idle"} />
        <Metric label="Runs saved" value={String(agent?.schedule?.outputs?.length ?? 0)} />
        <div className="rounded-lg border bg-background/65 p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Available tools</p>
          <div className="mt-3 flex flex-wrap gap-2">{tools.map((tool) => <span key={tool} className="rounded-md bg-muted px-2 py-1 text-xs">{tool.replaceAll("_", " ")}</span>)}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryPanel({ history }: { history: AgentOutput[] }) {
  return (
    <Card className="bg-card/70 backdrop-blur-2xl">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-5 w-5 text-secondary" /> Output history</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {history.length === 0 ? <p className="text-sm text-muted-foreground">No saved outputs yet.</p> : history.slice(0, 8).map((item, index) => (
          <div key={`${item.created_at}-${index}`} className="rounded-lg border bg-background/65 p-3">
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.objective ?? item.summary}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-background/65 p-4"><p className="text-xs font-medium uppercase text-muted-foreground">{label}</p><p className="mt-2 text-lg font-semibold capitalize">{value}</p></div>;
}

function AgentsPreview({ user }: { user: AppUser }) {
  return <main className="min-h-screen bg-background px-4 py-8 text-foreground"><div className="mx-auto max-w-3xl rounded-[1.5rem] border bg-card/70 p-8 shadow-soft backdrop-blur-2xl"><p className="flex items-center gap-2 text-sm font-semibold text-primary"><Bot className="h-4 w-4" /> HumanOS Agents</p><h1 className="mt-4 text-3xl font-semibold">Welcome, {user.firstName}</h1><p className="mt-3 text-sm leading-7 text-muted-foreground">Connect Clerk to run specialized agents that use your memories, documents, tasks, and goals.</p><Button asChild className="mt-6"><Link href="/sign-in">Sign in</Link></Button></div></main>;
}
