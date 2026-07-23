"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  CheckCircle2,
  Chrome,
  Crown,
  FileAudio,
  Image,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Mic,
  Network,
  Puzzle,
  Rocket,
  Sparkles,
  Store,
  Workflow,
} from "lucide-react";

import { SafeUserButton, useSafeAuth } from "@/components/clerk-safe";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type PlanId = "free" | "starter" | "pro" | "premium" | "enterprise";
type SubscriptionResponse = { plan: PlanId; status: string };
type LabStatus = "available" | "preview" | "planned";

const paidStatuses = new Set(["active", "trialing"]);
const planRank: Record<PlanId, number> = { free: 0, starter: 1, pro: 2, premium: 3, enterprise: 4 };

const labs: Array<{
  title: string;
  icon: typeof Sparkles;
  requiredPlan: PlanId;
  status: LabStatus;
  summary: string;
  useCases: string[];
  examples: string[];
}> = [
  {
    title: "Voice AI Copilot",
    icon: Mic,
    requiredPlan: "pro",
    status: "preview",
    summary: "Speak to HumanOS to create plans, tasks, summaries, and career actions without typing.",
    useCases: ["Plan my day", "Add a task", "Prepare interview answers"],
    examples: ["Voice command: Plan tomorrow around my AI Engineer goal", "Voice note: Remember that I prefer morning study blocks"],
  },
  {
    title: "AI Meeting & Lecture Notes",
    icon: FileAudio,
    requiredPlan: "pro",
    status: "preview",
    summary: "Turn recorded lectures, meetings, and voice notes into summaries, notes, tasks, and flashcards.",
    useCases: ["Lecture notes", "Meeting action items", "Study flashcards"],
    examples: ["Upload class audio and generate revision notes", "Extract tasks from a team meeting"],
  },
  {
    title: "Multimodal AI Workspace",
    icon: Image,
    requiredPlan: "premium",
    status: "planned",
    summary: "Analyze screenshots, images, charts, resume snapshots, code errors, and visual notes inside HumanOS.",
    useCases: ["Explain screenshots", "Fix code errors", "Analyze charts"],
    examples: ["Upload an error screenshot and ask for a fix", "Upload a resume screenshot and improve it"],
  },
  {
    title: "AI Agents Marketplace",
    icon: Store,
    requiredPlan: "premium",
    status: "planned",
    summary: "A library of specialized agents for resumes, exams, interviews, coding, startups, fitness, and finance goals.",
    useCases: ["Resume Agent", "Exam Agent", "Startup Agent"],
    examples: ["Run Interview Agent before a job call", "Run Startup Agent to plan a launch"],
  },
  {
    title: "Personal Knowledge Graph",
    icon: Network,
    requiredPlan: "premium",
    status: "planned",
    summary: "Visualize connections between goals, skills, memories, documents, tasks, projects, and career roadmaps.",
    useCases: ["Goal graph", "Skill graph", "Document memory map"],
    examples: ["Goal -> Skills -> Tasks -> Documents", "Resume -> Projects -> Interview prep"],
  },
  {
    title: "AI Automation Workflows",
    icon: Workflow,
    requiredPlan: "premium",
    status: "preview",
    summary: "Create if-this-then-that AI flows that turn user actions into plans, tasks, notes, and follow-ups.",
    useCases: ["Resume to tasks", "Goal to roadmap", "Missed task recovery"],
    examples: ["When I upload a resume, score it and create improvement tasks", "When I miss tasks, adjust tomorrow's planner"],
  },
  {
    title: "Browser Extension",
    icon: Chrome,
    requiredPlan: "pro",
    status: "planned",
    summary: "Save webpages, job posts, articles, and research directly into HumanOS memory from the browser.",
    useCases: ["Save job post", "Summarize article", "Capture research"],
    examples: ["Save this job and tailor my resume", "Summarize this article into study notes"],
  },
  {
    title: "WhatsApp / Telegram Assistant",
    icon: MessageCircle,
    requiredPlan: "starter",
    status: "planned",
    summary: "Message HumanOS from chat apps to add tasks, reminders, notes, and daily plans on the go.",
    useCases: ["Add task", "Plan tomorrow", "Quick memory"],
    examples: ["WhatsApp: Add task to revise ML notes", "Telegram: Plan tomorrow morning"],
  },
  {
    title: "AI Resume & Job Auto Apply",
    icon: BriefcaseBusiness,
    requiredPlan: "premium",
    status: "planned",
    summary: "Analyze job descriptions, tailor resumes, write cover letters, track applications, and suggest portfolio projects.",
    useCases: ["Tailor resume", "Cover letter", "Application tracker"],
    examples: ["Match my resume to this JD", "Create a weekly job application plan"],
  },
  {
    title: "Personal AI Twin",
    icon: BrainCircuit,
    requiredPlan: "enterprise",
    status: "planned",
    summary: "A deeper personal AI model of the user's goals, tone, routines, preferences, decisions, and productivity patterns.",
    useCases: ["Decision support", "Writing style", "Routine intelligence"],
    examples: ["Draft in my style", "Help me choose based on my goals and history"],
  },
];

const statusCopy: Record<LabStatus, string> = {
  available: "Available",
  preview: "Preview",
  planned: "Planned",
};

export default function AILabsPage() {
  const { getToken, isSignedIn } = useSafeAuth();
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadSubscription() {
      if (!isSignedIn) {
        setSubscription(null);
        return;
      }
      setIsLoading(true);
      try {
        const token = await getToken();
        if (!token) return;
        const response = await fetch(`${API_URL}/billing/subscription`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as SubscriptionResponse;
        if (!cancelled) setSubscription(data);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadSubscription();
    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn]);

  const activePlan: PlanId = subscription && paidStatuses.has(subscription.status) ? subscription.plan : "free";
  const unlocked = useMemo(() => labs.filter((lab) => planRank[activePlan] >= planRank[lab.requiredPlan]).length, [activePlan]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Dashboard</Link></Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground"><Rocket className="h-5 w-5" /></div>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">AI Labs</p><p className="text-xs text-muted-foreground">Upcoming technology inside HumanOS AI</p></div>
          </div>
          <div className="flex items-center gap-2"><Button asChild variant="outline" size="sm"><Link href="/pricing">Plans</Link></Button><SafeUserButton /></div>
        </div>
      </header>

      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
            <div className="rounded-[1.5rem] border bg-card/65 p-6 shadow-soft backdrop-blur-2xl sm:p-8">
              <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" /> Future-ready AI workspace</p>
              <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">Upcoming AI tools that make HumanOS feel more advanced and useful.</h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">AI Labs shows the next generation of HumanOS features: voice, audio notes, multimodal AI, automation workflows, marketplace agents, browser capture, chat-app access, job automation, and personal AI twin concepts.</p>
            </div>

            <Card className="bg-card/70 backdrop-blur-2xl">
              <CardHeader><CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-primary" />Your access</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-background/65 p-4">
                  <p className="text-sm text-muted-foreground">Current plan</p>
                  <p className="mt-1 text-3xl font-semibold capitalize">{isLoading ? "Checking..." : activePlan}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Unlocked labs" value={`${unlocked}/${labs.length}`} />
                  <Metric label="Highest tier" value="Premium+" />
                </div>
                <Button asChild className="w-full"><Link href="/pricing">Upgrade for more labs <ArrowRight className="h-4 w-4" /></Link></Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {labs.map((lab) => <LabCard key={lab.title} lab={lab} activePlan={activePlan} />)}
          </div>

          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><Puzzle className="h-5 w-5 text-primary" />Why this helps users understand HumanOS</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm leading-7 text-muted-foreground md:grid-cols-3">
              <p className="rounded-lg border bg-background/60 p-4">Users can see what is available now, what is coming next, and why paid plans unlock more powerful workflows.</p>
              <p className="rounded-lg border bg-background/60 p-4">Each lab explains the real-life use case in simple words instead of only technical AI language.</p>
              <p className="rounded-lg border bg-background/60 p-4">The page makes HumanOS feel like a growing AI platform, not a static dashboard.</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

function LabCard({ lab, activePlan }: { lab: (typeof labs)[number]; activePlan: PlanId }) {
  const isUnlocked = planRank[activePlan] >= planRank[lab.requiredPlan];
  const Icon = lab.icon;
  return (
    <Card className={cn("flex h-full flex-col bg-card/70 backdrop-blur-2xl", isUnlocked && "border-primary/40 bg-primary/5")}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-5 w-5 text-primary" />{lab.title}</CardTitle>
          <span className={cn("shrink-0 rounded-md px-2 py-1 text-xs font-medium", isUnlocked ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground")}>{isUnlocked ? "Included" : lab.requiredPlan}</span>
        </div>
        <div className="flex flex-wrap gap-2"><span className="rounded-md border bg-background/70 px-2 py-1 text-xs text-muted-foreground">{statusCopy[lab.status]}</span><span className="rounded-md border bg-background/70 px-2 py-1 text-xs capitalize text-muted-foreground">{lab.requiredPlan}+ plan</span></div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="text-sm leading-7 text-muted-foreground">{lab.summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">{lab.useCases.map((item) => <span key={item} className="rounded-md bg-background/70 px-2 py-1 text-xs font-medium text-muted-foreground">{item}</span>)}</div>
        <div className="mt-4 flex-1 space-y-2">{lab.examples.map((item) => <p key={item} className="flex gap-2 rounded-lg border bg-background/60 p-3 text-xs leading-5 text-muted-foreground"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />{item}</p>)}</div>
        {isUnlocked ? <Button variant="outline" className="mt-5 w-full" disabled><Bot className="h-4 w-4" />Available in your plan</Button> : <Button asChild className="mt-5 w-full"><Link href="/pricing"><LockKeyhole className="h-4 w-4" />Upgrade to {lab.requiredPlan}</Link></Button>}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-background/65 p-4"><p className="text-xs font-medium uppercase text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>;
}
