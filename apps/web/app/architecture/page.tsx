import Link from "next/link";
import { ArrowRight, Bot, Boxes, BrainCircuit, Code2, CreditCard, Database, Globe2, KeyRound, Lock, Network, Server, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const layers = [
  { icon: Globe2, title: "Frontend", text: "Next.js 15, TypeScript, Tailwind, Shadcn UI, responsive dashboard, dark/light mode, Vercel deployment." },
  { icon: Server, title: "Backend", text: "FastAPI APIs for chat, memory, tasks, goals, documents, agents, settings, billing, and auth sync." },
  { icon: Database, title: "Relational data", text: "PostgreSQL stores users, conversations, messages, memories, tasks, goals, documents, plans, agents, and subscriptions." },
  { icon: Network, title: "Vector intelligence", text: "Qdrant stores memory and document embeddings for retrieval before AI responses." },
  { icon: BrainCircuit, title: "AI provider", text: "OpenAI powers chat, summaries, roadmaps, task suggestions, career outputs, and agent responses." },
  { icon: CreditCard, title: "Payments", text: "Razorpay subscription flow, webhook handling, plan activation, and plan-limit enforcement." },
];

const flows = [
  ["Visitor", "Landing page", "Signup", "Dashboard"],
  ["User message", "FastAPI", "Memory retrieval", "OpenAI response"],
  ["Document upload", "Text extraction", "Qdrant embeddings", "Q&A and notes"],
  ["Goal", "Roadmap", "Milestones", "Tasks and planner"],
  ["Plan purchase", "Razorpay", "Webhook/verify", "Subscription active"],
];

export default function ArchitecturePage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm"><Link href="/sell">Back to buyer page</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/data-moat">View data moat <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>

        <section className="mt-10 rounded-[1.5rem] border bg-card/65 p-6 shadow-soft backdrop-blur-2xl sm:p-8">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" /> Buyer-facing architecture</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold sm:text-6xl">Full-stack AI SaaS architecture, ready for handover and scaling.</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">This diagram explains how HumanOS AI connects frontend, backend, database, vector search, AI, authentication, payments, deployment, and buyer-owned production keys.</p>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {layers.map((layer) => (
            <Card key={layer.title} className="bg-card/70 backdrop-blur-2xl">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><layer.icon className="h-5 w-5 text-primary" />{layer.title}</CardTitle></CardHeader>
              <CardContent className="text-sm leading-7 text-muted-foreground">{layer.text}</CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><Boxes className="h-5 w-5 text-primary" />System diagram</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm">
                <DiagramRow icon={Globe2} title="Next.js web app" detail="HumanOS UI, auth pages, dashboard, pricing, copilot modules" />
                <DiagramArrow />
                <DiagramRow icon={Lock} title="Clerk auth" detail="User identity, sessions, protected pages, backend token validation" />
                <DiagramArrow />
                <DiagramRow icon={Server} title="FastAPI backend" detail="Secure API layer, OpenAI calls, business logic, billing, CORS" />
                <DiagramArrow />
                <div className="grid gap-3 sm:grid-cols-2">
                  <DiagramRow icon={Database} title="PostgreSQL" detail="Structured app data" />
                  <DiagramRow icon={Network} title="Qdrant" detail="Memory and document vectors" />
                  <DiagramRow icon={BrainCircuit} title="OpenAI" detail="AI responses and generation" />
                  <DiagramRow icon={CreditCard} title="Razorpay" detail="Subscriptions and webhooks" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" />Core product flows</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {flows.map((flow) => (
                <div key={flow.join("-")} className="rounded-lg border bg-background/60 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {flow.map((step, index) => <span key={step} className="flex items-center gap-2"><span className="rounded-md bg-card px-2 py-1 font-medium text-foreground">{step}</span>{index < flow.length - 1 && <ArrowRight className="h-3.5 w-3.5" />}</span>)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-5 w-5 text-secondary" />Buyer key ownership</CardTitle></CardHeader><CardContent className="text-sm leading-7 text-muted-foreground">Buyer can replace OpenAI, Clerk, Razorpay, Railway, Vercel, Qdrant, and domain configuration with their own production accounts.</CardContent></Card>
          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-5 w-5 text-secondary" />Security baseline</CardTitle></CardHeader><CardContent className="text-sm leading-7 text-muted-foreground">Protected routes, CORS, security headers, rate limits, auth token validation, and no password storage inside the app database.</CardContent></Card>
          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Code2 className="h-5 w-5 text-secondary" />Deployment shape</CardTitle></CardHeader><CardContent className="text-sm leading-7 text-muted-foreground">Vercel frontend, Railway backend/PostgreSQL, Qdrant Cloud or compatible Docker, and Docker Compose for local startup.</CardContent></Card>
        </section>
      </div>
    </main>
  );
}

function DiagramRow({ icon: Icon, title, detail }: { icon: typeof Server; title: string; detail: string }) {
  return <div className="rounded-lg border bg-background/70 p-4"><p className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p></div>;
}

function DiagramArrow() {
  return <div className="flex justify-center text-muted-foreground"><ArrowRight className="h-5 w-5 rotate-90" /></div>;
}
