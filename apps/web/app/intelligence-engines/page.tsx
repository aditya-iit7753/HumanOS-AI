import Link from "next/link";
import { ArrowRight, BrainCircuit, BriefcaseBusiness, CalendarDays, CheckCircle2, FileText, GraduationCap, Network, Search, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const engines = [
  { icon: BrainCircuit, name: "Personal Memory Engine", text: "Turns durable facts, preferences, goals, skills, and decisions into reusable AI context.", signals: ["Preferences", "Important facts", "Memory Graph"] },
  { icon: BriefcaseBusiness, name: "Career Intelligence Engine", text: "Personalizes resumes, roadmaps, skill gaps, projects, ATS checks, and interview preparation.", signals: ["Target role", "Skills", "Career goals"] },
  { icon: FileText, name: "Document Intelligence Engine", text: "Extracts text, summarizes documents, creates notes, finds action items, and supports document Q&A.", signals: ["PDF/DOCX/TXT", "Embeddings", "Action items"] },
  { icon: CalendarDays, name: "Productivity Intelligence Engine", text: "Reads tasks, goals, incomplete work, and daily inputs to create priorities and time-blocked plans.", signals: ["Tasks", "Daily plan", "Progress score"] },
  { icon: GraduationCap, name: "Study Intelligence Engine", text: "Creates study plans, simple explanations, quizzes, flashcards, weak-area tracking, and daily learning tasks.", signals: ["Topics", "Quizzes", "Weak areas"] },
  { icon: Search, name: "Research Intelligence Engine", text: "Generates topic summaries, key points, pros and cons, learning roadmaps, notes, and task conversions.", signals: ["Research topic", "Roadmap", "Notes"] },
];

export default function IntelligenceEnginesPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm"><Link href="/dashboard">Back to dashboard</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/memory-graph">Open Memory Graph <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" /> HumanOS Intelligence Engines</p>
            <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">A connected AI system with named engines for each life and work workflow.</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">HumanOS packages its AI capabilities as reusable engines instead of isolated prompts. Each engine uses user memory, goals, tasks, documents, and profile context to create more personalized outputs over time.</p>
          </div>
          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><Network className="h-5 w-5 text-primary" /> Platform loop</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
              {["User creates chats, tasks, goals, documents, and plans.", "HumanOS saves structured context and vector memories.", "Engines retrieve the right context before generating outputs.", "New outputs become notes, tasks, plans, roadmaps, and memories."].map((item) => <p key={item} className="rounded-lg border bg-background/60 p-3">{item}</p>)}
            </CardContent>
          </Card>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {engines.map((engine) => (
            <Card key={engine.name} className="bg-card/70 backdrop-blur-2xl">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><engine.icon className="h-5 w-5 text-primary" />{engine.name}</CardTitle></CardHeader>
              <CardContent>
                <p className="min-h-20 text-sm leading-6 text-muted-foreground">{engine.text}</p>
                <div className="mt-4 flex flex-wrap gap-2">{engine.signals.map((signal) => <span key={signal} className="rounded-md border bg-background/70 px-2 py-1 text-xs font-medium text-muted-foreground">{signal}</span>)}</div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-3">
          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-5 w-5 text-secondary" />Buyer value</CardTitle></CardHeader><CardContent className="text-sm leading-7 text-muted-foreground">The engines give buyers a clear product architecture, branded IP story, and modular roadmap for new verticals like edtech, career-tech, HR-tech, and productivity SaaS.</CardContent></Card>
          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-5 w-5 text-secondary" />Launch value</CardTitle></CardHeader><CardContent className="text-sm leading-7 text-muted-foreground">Each engine can become its own landing page, paid feature, plan limit, or white-label package for institutional customers.</CardContent></Card>
          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ArrowRight className="h-5 w-5 text-secondary" />Next</CardTitle></CardHeader><CardContent><Button asChild className="w-full"><Link href="/architecture">View architecture diagram</Link></Button></CardContent></Card>
        </section>
      </div>
    </main>
  );
}
