import Link from "next/link";
import { ArrowRight, BrainCircuit, CheckCircle2, Database, EyeOff, FileText, Goal, KeyRound, Lock, Network, ShieldCheck, Sparkles, Trash2, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const dataSignals = [
  { icon: Goal, title: "Career and life goals", text: "Long-term outcomes, milestones, role targets, and roadmap progress." },
  { icon: BrainCircuit, title: "Durable memories", text: "Preferences, skills, projects, important facts, and reusable context saved with user intent." },
  { icon: FileText, title: "Document intelligence", text: "Document summaries, notes, action items, extracted text, and vector references." },
  { icon: CheckCircle2, title: "Productivity patterns", text: "Task completion, priorities, daily planning, evening review, and focus scores." },
];

const privacyRules = [
  "Data is tied to the authenticated user and should always be queried by user_id.",
  "Passwords are not stored by HumanOS AI because Clerk handles identity and sessions.",
  "API keys and secrets stay in environment variables, not in the frontend bundle.",
  "Users should have clear export/delete controls and published privacy/legal pages.",
  "Buyer should use their own production keys, hosting, database, analytics, and payment accounts after transfer.",
];

export default function DataMoatPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm"><Link href="/architecture">Back to architecture</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/demo-mode">View demo mode <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" /> Privacy-safe data moat</p>
            <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">HumanOS becomes more useful as users build their private context graph.</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">The moat is not secret data collection. It is user-consented structured context: memories, goals, documents, tasks, plans, skills, and career outputs that make the assistant harder to replace over time.</p>
          </div>
          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><Network className="h-5 w-5 text-primary" />Moat statement</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
              <p className="rounded-lg border bg-background/60 p-3">HumanOS AI builds a personal intelligence layer from user-approved productivity, career, study, document, and memory workflows.</p>
              <p className="rounded-lg border bg-background/60 p-3">The more the user plans, chats, uploads, and reviews, the more HumanOS can personalize answers and actions.</p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dataSignals.map((signal) => (
            <Card key={signal.title} className="bg-card/70 backdrop-blur-2xl">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><signal.icon className="h-5 w-5 text-primary" />{signal.title}</CardTitle></CardHeader>
              <CardContent className="text-sm leading-7 text-muted-foreground">{signal.text}</CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Privacy-safe rules</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
              {privacyRules.map((rule) => <p key={rule} className="flex gap-2 rounded-lg border bg-background/60 p-3"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-secondary" />{rule}</p>)}
            </CardContent>
          </Card>

          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" />Buyer explanation</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm leading-7 text-muted-foreground sm:grid-cols-2">
              <Proof icon={UserCheck} title="User-owned context" text="The product value grows through the user account, not through unsafe shared data pools." />
              <Proof icon={Lock} title="Isolation" text="Each user's data should remain scoped to their authenticated identity and backend authorization." />
              <Proof icon={EyeOff} title="Sensitive data caution" text="Avoid storing passwords, raw payment details, or unnecessary personal data inside app tables." />
              <Proof icon={Trash2} title="Control" text="Export/delete flows and legal pages improve trust for real users and serious buyers." />
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 rounded-[1.5rem] border bg-card/65 p-6 shadow-soft backdrop-blur-2xl sm:p-8">
          <p className="text-sm font-semibold text-primary">Pitch wording</p>
          <p className="mt-3 text-lg leading-8 text-muted-foreground">HumanOS AI has a privacy-safe data moat because it converts user-approved activity into a connected Memory Graph across goals, tasks, skills, documents, plans, and career outputs. This creates personalization, switching cost, and a stronger AI SaaS story while keeping the user in control of their data.</p>
        </section>
      </div>
    </main>
  );
}

function Proof({ icon: Icon, title, text }: { icon: typeof KeyRound; title: string; text: string }) {
  return <div className="rounded-lg border bg-background/60 p-4"><p className="flex items-center gap-2 font-semibold text-foreground"><Icon className="h-4 w-4 text-primary" />{title}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>;
}
