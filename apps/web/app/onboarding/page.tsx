"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, GraduationCap, Loader2, Sparkles, Target, Users } from "lucide-react";
import { useState } from "react";

import { useSafeAuth } from "@/components/clerk-safe";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const personas = [
  { id: "student", title: "Student", icon: GraduationCap, text: "Study plans, quizzes, notes, and daily learning tasks." },
  { id: "job_seeker", title: "Job seeker", icon: BriefcaseBusiness, text: "Resume, ATS score, interview prep, projects, and roadmap." },
  { id: "professional", title: "Professional", icon: Target, text: "Tasks, goals, documents, meetings, and productivity systems." },
  { id: "founder", title: "Founder", icon: Users, text: "Strategy, research, hiring, documents, and operating rhythm." },
];

const tones = ["Practical", "Motivating", "Strict coach", "Calm mentor"];

export default function OnboardingPage() {
  const { getToken } = useSafeAuth();
  const [persona, setPersona] = useState("job_seeker");
  const [tone, setTone] = useState("Practical");
  const [mainGoal, setMainGoal] = useState("Become an AI Engineer in 6 months");
  const [focusAreas, setFocusAreas] = useState("AI skills, resume, projects, daily productivity");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function completeOnboarding() {
    setIsSaving(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again to complete onboarding.");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      const ai_preferences = {
        onboarding_complete: true,
        persona,
        tone: tone.toLowerCase(),
        primary_goal: mainGoal,
        focus_areas: focusAreas.split(",").map((item) => item.trim()).filter(Boolean),
        response_style: "personalized",
      };
      const response = await fetch(`${API_URL}/settings`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ ai_preferences }),
      });
      if (!response.ok) throw new Error("Unable to save onboarding preferences.");
      await fetch(`${API_URL}/analytics/events`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "onboarding.completed", resource: "onboarding", meta: { persona, tone, main_goal: mainGoal } }),
      });
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete onboarding.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:py-12">
      <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-[1.5rem] border bg-card/70 p-6 shadow-soft backdrop-blur-2xl sm:p-8">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" /> HumanOS setup</p>
          <h1 className="mt-4 text-3xl font-semibold sm:text-5xl">Personalize your AI operating system.</h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
            Answer a few quick questions so HumanOS can shape your dashboard, daily challenges, AI tone, and career or study workflows around you.
          </p>
          <div className="mt-6 space-y-3 rounded-lg border bg-background/65 p-4">
            {["Choose your mode", "Set your main goal", "Start with a personalized dashboard"].map((item) => (
              <p key={item} className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-primary" /> {item}</p>
            ))}
          </div>
        </div>

        <Card className="bg-card/70 backdrop-blur-2xl">
          <CardHeader>
            <CardTitle>Build my HumanOS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {personas.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPersona(item.id)}
                  className={cn(
                    "rounded-lg border bg-background/65 p-4 text-left transition hover:border-primary/60 hover:bg-background",
                    persona === item.id && "border-primary bg-primary/10",
                  )}
                >
                  <item.icon className="h-5 w-5 text-primary" />
                  <p className="mt-3 font-semibold">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Main goal</label>
              <Input value={mainGoal} onChange={(event) => setMainGoal(event.target.value)} placeholder="Example: Become AI Engineer in 6 months" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Focus areas</label>
              <Textarea value={focusAreas} onChange={(event) => setFocusAreas(event.target.value)} placeholder="AI skills, study, resume, projects" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">AI tone</label>
              <div className="grid gap-2 sm:grid-cols-4">
                {tones.map((item) => (
                  <button key={item} type="button" onClick={() => setTone(item)} className={cn("rounded-md border px-3 py-2 text-sm transition hover:border-primary", tone === item && "border-primary bg-primary text-primary-foreground")}>{item}</button>
                ))}
              </div>
            </div>

            {error && <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => void completeOnboarding()} disabled={isSaving} className="flex-1 justify-between">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Launch dashboard <ArrowRight className="h-4 w-4" />
              </Button>
              <Button asChild variant="outline" className="bg-background/50">
                <Link href="/dashboard">Skip</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}