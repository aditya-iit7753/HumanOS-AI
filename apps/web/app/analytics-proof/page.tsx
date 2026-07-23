"use client";

import Link from "next/link";
import { BarChart3, BrainCircuit, CheckCircle2, CreditCard, Database, FileText, Goal, Loader2, MessageSquareText, Network, Rocket, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useSafeAuth } from "@/components/clerk-safe";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ProofStats = { conversations: number; messages: number; memories: number; tasks: number; goals: number; documents: number; agents: number; plannerScore: number };

const proofItems = [
  { icon: Rocket, title: "Live website", text: "Take screenshot of https://www.humanosai.in loading publicly." },
  { icon: CreditCard, title: "Payment proof", text: "Upload Razorpay dashboard screenshot showing test/live payment or subscriptions." },
  { icon: BarChart3, title: "Traffic proof", text: "Upload Vercel Analytics, Google Analytics, or Search Console screenshot." },
  { icon: Database, title: "Backend proof", text: "Show Railway service healthy, PostgreSQL connected, and API health endpoint working." },
  { icon: ShieldCheck, title: "Auth proof", text: "Show Clerk production instance, custom domain, signup/login, and dashboard access." },
  { icon: Network, title: "AI proof", text: "Show chat response, Memory Graph, document Q&A, and Career Copilot outputs." },
];

export default function AnalyticsProofPage() {
  const { getToken } = useSafeAuth();
  const [stats, setStats] = useState<ProofStats>({ conversations: 0, messages: 0, memories: 0, tasks: 0, goals: 0, documents: 0, agents: 0, plannerScore: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProof() {
      setIsLoading(true);
      setError("");
      try {
        const token = await getToken();
        if (!token) throw new Error("Login to load live app usage counts.");
        const headers = { Authorization: `Bearer ${token}` };
        const results = await Promise.allSettled([
          fetch(`${API_URL}/chat/conversations`, { headers }),
          fetch(`${API_URL}/memories`, { headers }),
          fetch(`${API_URL}/tasks`, { headers }),
          fetch(`${API_URL}/goals`, { headers }),
          fetch(`${API_URL}/documents`, { headers }),
          fetch(`${API_URL}/agents`, { headers }),
          fetch(`${API_URL}/daily-plans/dashboard`, { headers }),
        ]);

        async function read(index: number) {
          const result = results[index];
          if (result.status !== "fulfilled" || !result.value.ok) return null;
          return result.value.json();
        }

        const conversations = ((await read(0)) ?? []) as Array<{ messages?: unknown[] }>;
        const memories = ((await read(1)) ?? []) as unknown[];
        const tasks = ((await read(2)) ?? []) as unknown[];
        const goals = ((await read(3)) ?? []) as unknown[];
        const documents = ((await read(4)) ?? []) as unknown[];
        const agents = ((await read(5)) ?? []) as unknown[];
        const planner = ((await read(6)) ?? {}) as { productivity_score?: number };

        setStats({
          conversations: conversations.length,
          messages: conversations.reduce((total, conversation) => total + (conversation.messages?.length ?? 0), 0),
          memories: memories.length,
          tasks: tasks.length,
          goals: goals.length,
          documents: documents.length,
          agents: agents.length,
          plannerScore: planner.productivity_score ?? 0,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load proof metrics");
      } finally {
        setIsLoading(false);
      }
    }
    void loadProof();
  }, [getToken]);

  const score = useMemo(() => {
    const checks = [stats.conversations > 0, stats.memories > 0, stats.tasks > 0, stats.goals > 0, stats.documents > 0, stats.agents > 0];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [stats]);

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm"><Link href="/dashboard">Back to dashboard</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/sell">Open buyer page</Link></Button>
        </div>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" /> Usage and proof dashboard</p>
            <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">Collect the proof buyers want before they trust the asset.</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">Use this page to show live module usage, product completeness, and the exact screenshots needed for Flippa, brokers, direct buyers, and startup marketplaces.</p>
          </div>
          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Proof readiness</CardTitle></CardHeader>
            <CardContent>
              <p className="text-5xl font-semibold">{isLoading ? "..." : `${score}%`}</p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">Based on whether this account has conversations, memories, tasks, goals, documents, and agents available.</p>
              {error && <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-200">{error}</p>}
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={MessageSquareText} label="Conversations" value={stats.conversations} loading={isLoading} />
          <Metric icon={BrainCircuit} label="Memories" value={stats.memories} loading={isLoading} />
          <Metric icon={CheckCircle2} label="Tasks" value={stats.tasks} loading={isLoading} />
          <Metric icon={Goal} label="Goals" value={stats.goals} loading={isLoading} />
          <Metric icon={FileText} label="Documents" value={stats.documents} loading={isLoading} />
          <Metric icon={Users} label="Agents" value={stats.agents} loading={isLoading} />
          <Metric icon={BarChart3} label="Planner score" value={stats.plannerScore} loading={isLoading} suffix="%" />
          <Metric icon={Network} label="Proof score" value={score} loading={isLoading} suffix="%" />
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {proofItems.map((item) => <Card key={item.title} className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><item.icon className="h-5 w-5 text-primary" />{item.title}</CardTitle></CardHeader><CardContent className="text-sm leading-7 text-muted-foreground">{item.text}</CardContent></Card>)}
        </section>

        <section className="mt-10 rounded-[1.5rem] border bg-card/65 p-6 shadow-soft backdrop-blur-2xl sm:p-8">
          <p className="text-sm font-semibold text-primary">Buyer proof package</p>
          <p className="mt-3 text-lg leading-8 text-muted-foreground">Before approaching serious buyers, prepare screenshots for live site, dashboard, chat output, Memory Graph, document Q&A, pricing/payment, Razorpay transactions, Vercel deployment, Railway backend, Clerk production, and analytics traffic. This page acts as your internal checklist.</p>
        </section>
      </div>
    </main>
  );
}

function Metric({ icon: Icon, label, value, suffix = "", loading }: { icon: typeof BarChart3; label: string; value: number; suffix?: string; loading: boolean }) {
  return <Card className="bg-card/70 backdrop-blur-2xl"><CardContent className="p-4"><p className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</p><p className="mt-3 text-3xl font-semibold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : `${value}${suffix}`}</p></CardContent></Card>;
}
