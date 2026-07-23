"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, BrainCircuit, BriefcaseBusiness, CalendarDays, CheckCircle2, FileText, GraduationCap, Sparkles, Target } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const personas = {
  student: {
    label: "Student",
    headline: "Prepare for exams, projects, and career direction from one AI workspace.",
    context: ["2nd year computer science student", "Prefers simple explanations", "Needs project-based learning", "Wants internship readiness"],
    plan: ["Morning: revise ML basics for 60 minutes", "Afternoon: summarize lecture PDF and create flashcards", "Evening: build one portfolio feature", "Review: mark weak topics and create tomorrow's tasks"],
    outputs: ["Study plan", "Flashcards", "Quiz", "Project roadmap", "Daily learning tasks"],
  },
  jobseeker: {
    label: "Job seeker",
    headline: "Convert skills, resume, goals, and documents into an interview-ready roadmap.",
    context: ["Target role: AI/ML Engineer", "Resume needs ATS improvement", "Needs GenAI portfolio", "Prefers weekly milestones"],
    plan: ["Morning: improve resume project bullets", "Afternoon: practice 8 interview questions", "Evening: ship one GenAI portfolio task", "Review: update roadmap progress and save new skills"],
    outputs: ["ATS resume", "Skill gap analysis", "Interview questions", "Career roadmap", "Portfolio projects"],
  },
};

const modules = [
  { icon: BrainCircuit, title: "Memory", text: "Saves goals, preferences, skills, projects, and important facts." },
  { icon: FileText, title: "Documents", text: "Summarizes PDFs, notes, resumes, and extracts action items." },
  { icon: Target, title: "Goals", text: "Breaks large outcomes into milestones and progress tracking." },
  { icon: CalendarDays, title: "Planner", text: "Creates time blocks, daily focus list, and evening review." },
];

export default function DemoModePage() {
  const [persona, setPersona] = useState<keyof typeof personas>("jobseeker");
  const active = personas[persona];

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm"><Link href="/dashboard">Back to dashboard</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/analytics-proof">View proof dashboard <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_.9fr] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" /> Case-study demo mode</p>
            <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">Show buyers exactly how students and job seekers use HumanOS AI.</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">This demo mode packages HumanOS into a clear target-customer story: inputs, memory, AI engines, daily plan, career outputs, documents, and measurable progress.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {Object.entries(personas).map(([key, item]) => (
                <Button key={key} variant={persona === key ? "default" : "outline"} onClick={() => setPersona(key as keyof typeof personas)}>
                  {key === "student" ? <GraduationCap className="h-4 w-4" /> : <BriefcaseBusiness className="h-4 w-4" />}
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />Demo persona</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{active.label}</p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{active.headline}</p>
              <div className="mt-5 grid gap-2">{active.context.map((item) => <p key={item} className="rounded-lg border bg-background/60 p-3 text-sm text-muted-foreground">{item}</p>)}</div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" />AI daily operating plan</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {active.plan.map((item, index) => <p key={item} className="flex gap-3 rounded-lg border bg-background/60 p-3 text-sm leading-6 text-muted-foreground"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">{index + 1}</span>{item}</p>)}
            </CardContent>
          </Card>

          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />Generated outputs</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {active.outputs.map((item) => <div key={item} className="rounded-lg border bg-background/60 p-4"><p className="font-semibold">{item}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Generated using memory, goals, tasks, documents, and the selected intelligence engine.</p></div>)}
            </CardContent>
          </Card>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {modules.map((module) => <Card key={module.title} className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><module.icon className="h-5 w-5 text-primary" />{module.title}</CardTitle></CardHeader><CardContent className="text-sm leading-7 text-muted-foreground">{module.text}</CardContent></Card>)}
        </section>

        <section className="mt-10 rounded-[1.5rem] border bg-card/65 p-6 shadow-soft backdrop-blur-2xl sm:p-8">
          <p className="text-sm font-semibold text-primary">How to use this in a buyer demo</p>
          <p className="mt-3 text-lg leading-8 text-muted-foreground">Open this page, select Student or Job seeker, then show how HumanOS connects memory, documents, career planning, goals, and daily productivity into one target-customer workflow. This is the fastest way to explain the product&apos;s market use case.</p>
        </section>
      </div>
    </main>
  );
}
