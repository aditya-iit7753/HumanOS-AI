import Link from "next/link";
import { Brain, BriefcaseBusiness, CheckCircle2, FileText, Sparkles, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const values = [
  ["Personal context", "HumanOS AI helps users keep chats, goals, memories, tasks, career plans, and documents in one AI workspace."],
  ["Career execution", "The Career Copilot supports resumes, roadmaps, interview prep, skill gaps, and practical project planning."],
  ["Daily productivity", "Tasks, goals, planner, agents, and document tools turn AI output into actual next actions."],
  ["User control", "Users can manage memories, profile data, uploaded documents, and subscription choices from inside the app."],
];

const modules = [
  [Brain, "AI Chat + Memory"],
  [Target, "Goals + Tasks"],
  [BriefcaseBusiness, "Career Copilot"],
  [FileText, "Document Copilot"],
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Button asChild variant="ghost" size="sm"><Link href="/">Back to HumanOS AI</Link></Button>
        <section className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" /> About HumanOS AI</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">A personal AI operating system for life, study, career, and productivity.</h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">HumanOS AI brings the tools people already need every day into one intelligent workspace: chat, long-term memory, documents, goals, tasks, daily planning, and career growth.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild><Link href="/sign-up">Start using HumanOS AI</Link></Button>
              <Button asChild variant="outline"><Link href="/contact">Contact support</Link></Button>
            </div>
          </div>
          <Card className="bg-card/70 shadow-soft backdrop-blur-2xl">
            <CardHeader><CardTitle>What users can do</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {modules.map(([Icon, label]) => <div key={String(label)} className="rounded-lg border bg-background/70 p-4"><Icon className="mb-3 h-5 w-5 text-primary" /><p className="text-sm font-medium">{String(label)}</p></div>)}
            </CardContent>
          </Card>
        </section>
        <section className="mt-10 grid gap-4 md:grid-cols-2">
          {values.map(([title, body]) => <Card key={title} className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CheckCircle2 className="h-5 w-5 text-secondary" />{title}</CardTitle></CardHeader><CardContent><p className="text-sm leading-7 text-muted-foreground">{body}</p></CardContent></Card>)}
        </section>
      </div>
    </main>
  );
}