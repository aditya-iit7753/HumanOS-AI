"use client";

import Link from "next/link";
import { SafeUserButton, useSafeAuth } from "@/components/clerk-safe";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Download,
  FileText,
  Gauge,
  GraduationCap,
  Loader2,
  Map,
  MessageCircleQuestion,
  Moon,
  Route,
  Sparkles,
  Sun,
  WandSparkles,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const roleVersions = ["AI/ML Engineer", "Full Stack Developer", "Data Scientist", "GenAI Engineer", "Prompt Engineer"] as const;
const tools = [
  { id: "resume_builder", label: "ATS Resume", icon: FileText },
  { id: "ats_score", label: "ATS score", icon: Gauge },
  { id: "skill_gap", label: "Skill gap", icon: GraduationCap },
  { id: "role_recommender", label: "Role recommender", icon: BriefcaseBusiness },
  { id: "interview_questions", label: "Interview questions", icon: MessageCircleQuestion },
  { id: "project_recommender", label: "Projects", icon: WandSparkles },
  { id: "career_roadmap", label: "Roadmap", icon: Route },
] as const;

type ToolId = (typeof tools)[number]["id"];
type CareerUser = { firstName: string; fullName: string; email: string };
type CareerProfile = { current_role: string; target_role: string; strengths: string[]; growth_areas: string[]; roadmap: string[] };
type CopilotResult = { tool: string; title: string; summary: string; score?: number | null; items: { title: string; description: string }[]; content: string };
type ResumeForm = { name: string; headline: string; contact: string; summary: string; education: string; skills: string; projects: string; experience: string };

const emptyResume: ResumeForm = {
  name: "",
  headline: "",
  contact: "",
  summary: "",
  education: "",
  skills: "",
  projects: "",
  experience: "",
};

export function CareerClient({ user, clerkReady }: { user: CareerUser; clerkReady: boolean }) {
  if (!clerkReady) return <CareerSetup user={user} />;
  return <AuthenticatedCareerClient user={user} />;
}

function AuthenticatedCareerClient({ user }: { user: CareerUser }) {
  const { getToken } = useSafeAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [activeTool, setActiveTool] = useState<ToolId>("resume_builder");
  const [targetRole, setTargetRole] = useState<(typeof roleVersions)[number]>("AI/ML Engineer");
  const [resumeForm, setResumeForm] = useState<ResumeForm>({ ...emptyResume, name: user.fullName, contact: user.email });
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [profile, setProfile] = useState<CareerProfile>({ current_role: "", target_role: "AI/ML Engineer", strengths: [], growth_areas: [], roadmap: [] });
  const [result, setResult] = useState<CopilotResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function authHeaders() {
    const token = await getToken();
    if (!token) throw new Error("Missing Clerk session token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  async function request<T>(path: string, options: RequestInit = {}) {
    const headers = await authHeaders();
    const response = await fetch(`${API_URL}${path}`, { ...options, headers: { ...headers, ...options.headers } });
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as T;
  }

  async function loadProfile() {
    try {
      const data = await request<CareerProfile | null>("/career");
      if (!data) return;
      setProfile(data);
      const nextRole = roleVersions.find((role) => role === data.target_role) ?? "AI/ML Engineer";
      setTargetRole(nextRole);
      setResumeForm((current) => ({ ...current, headline: data.target_role || current.headline, skills: current.skills || data.strengths.join(", ") }));
    } catch {}
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const saved = await request<CareerProfile>("/career", { method: "PUT", body: JSON.stringify({ ...profile, target_role: targetRole }) });
      setProfile(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save profile");
    }
  }

  async function runTool(tool: ToolId = activeTool) {
    setIsLoading(true);
    setError("");
    try {
      const data = await request<CopilotResult>("/career/copilot", {
        method: "POST",
        body: JSON.stringify({
          tool,
          target_role: targetRole,
          resume_text: resumeText,
          resume_data: resumeForm,
          job_description: jobDescription,
        }),
      });
      setActiveTool(tool);
      setResult(data);
      if (data.content && tool === "resume_builder") setResumeText(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run Career Copilot");
    } finally {
      setIsLoading(false);
    }
  }

  function updateResumeForm(key: keyof ResumeForm, value: string) {
    setResumeForm((current) => ({ ...current, [key]: value }));
  }

  function exportPdf() {
    const printable = resumeText.trim() || buildLocalPreview(resumeForm, targetRole);
    const printWindow = window.open("", "_blank", "width=900,height=1100");
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html><head><title>${targetRole} Resume</title><style>${resumePrintCss}</style></head><body><main class="resume">${escapeHtml(printable).replace(/\n/g, "<br />")}</main><script>window.onload=()=>{window.print();}</script></body></html>`);
    printWindow.document.close();
  }

  const activeToolLabel = useMemo(() => tools.find((tool) => tool.id === activeTool)?.label ?? "Career Copilot", [activeTool]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Dashboard</Link></Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground"><BriefcaseBusiness className="h-5 w-5" /></div>
            <div><p className="text-sm font-semibold">Career Copilot</p><p className="text-xs text-muted-foreground">ATS resume builder and career tools</p></div>
          </div>
          <div className="flex gap-2"><Button variant="outline" size="icon" title="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button><SafeUserButton /></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[360px_1fr] lg:px-8">
        <aside className="space-y-4">
          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="text-base">Resume version</CardTitle></CardHeader><CardContent className="grid gap-2">{roleVersions.map((role) => <button key={role} onClick={() => { setTargetRole(role); setResumeForm((current) => ({ ...current, headline: role })); }} className={cn("h-10 rounded-md border px-3 text-left text-sm transition hover:bg-muted", targetRole === role && "border-primary bg-primary text-primary-foreground")}>{role}</button>)}</CardContent></Card>
          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="text-base">Career profile</CardTitle></CardHeader><CardContent><form onSubmit={saveProfile} className="space-y-3"><Input value={profile.current_role} onChange={(event) => setProfile({ ...profile, current_role: event.target.value })} placeholder="Current role" /><Textarea value={profile.strengths.join(", ")} onChange={(event) => setProfile({ ...profile, strengths: event.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="Skills, comma-separated" /><Textarea value={profile.growth_areas.join(", ")} onChange={(event) => setProfile({ ...profile, growth_areas: event.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="Skill gaps, comma-separated" /><Button className="w-full">Save profile</Button></form></CardContent></Card>
          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="text-base">Career tools</CardTitle></CardHeader><CardContent className="grid gap-2">{tools.map((tool) => <button key={tool.id} onClick={() => setActiveTool(tool.id)} className={cn("flex h-10 items-center gap-2 rounded-md border px-3 text-left text-sm transition hover:bg-muted", activeTool === tool.id && "border-primary bg-primary text-primary-foreground")}><tool.icon className="h-4 w-4" />{tool.label}</button>)}</CardContent></Card>
        </aside>

        <section className="space-y-4">
          <div className="rounded-[1.5rem] border bg-card/65 p-5 shadow-soft backdrop-blur-2xl sm:p-7"><p className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" />ATS resume builder</p><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Generate a clean one-page resume for {targetRole}.</h1></div>
          {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}

          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="text-base">Resume inputs</CardTitle></CardHeader><CardContent className="grid gap-3"><div className="grid gap-3 md:grid-cols-2"><Input value={resumeForm.name} onChange={(event) => updateResumeForm("name", event.target.value)} placeholder="Full name" /><Input value={resumeForm.contact} onChange={(event) => updateResumeForm("contact", event.target.value)} placeholder="Email | Phone | LinkedIn | GitHub" /></div><Input value={resumeForm.headline} onChange={(event) => updateResumeForm("headline", event.target.value)} placeholder="Headline / target title" /><Textarea value={resumeForm.summary} onChange={(event) => updateResumeForm("summary", event.target.value)} placeholder="Professional summary" className="min-h-20" /><Textarea value={resumeForm.education} onChange={(event) => updateResumeForm("education", event.target.value)} placeholder="Education, one item per line" className="min-h-20" /><Textarea value={resumeForm.skills} onChange={(event) => updateResumeForm("skills", event.target.value)} placeholder="Skills, comma-separated or one per line" className="min-h-20" /><Textarea value={resumeForm.projects} onChange={(event) => updateResumeForm("projects", event.target.value)} placeholder="Projects, one achievement per line" className="min-h-24" /><Textarea value={resumeForm.experience} onChange={(event) => updateResumeForm("experience", event.target.value)} placeholder="Experience, one achievement per line" className="min-h-24" /><Textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Optional job description for ATS targeting" className="min-h-20" /><div className="flex flex-wrap gap-2"><Button onClick={() => void runTool("resume_builder")} disabled={isLoading}>{isLoading && activeTool === "resume_builder" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}Generate ATS resume</Button><Button variant="outline" onClick={exportPdf}><Download className="h-4 w-4" />Export PDF</Button><Button variant="outline" onClick={() => void runTool()} disabled={isLoading}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Map className="h-4 w-4" />}Run {activeToolLabel}</Button></div></CardContent></Card>

          <div className="grid gap-4 xl:grid-cols-[1fr_.8fr]">
            <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="text-base">Clean ATS template</CardTitle></CardHeader><CardContent><pre className="min-h-[620px] overflow-auto rounded-lg border bg-white p-6 text-sm leading-6 text-slate-950 shadow-soft whitespace-pre-wrap">{resumeText || buildLocalPreview(resumeForm, targetRole)}</pre></CardContent></Card>
            {result && <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center justify-between gap-3"><span>{result.title}</span>{typeof result.score === "number" && <span className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground">{result.score}%</span>}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm leading-6 text-muted-foreground">{result.summary}</p><div className="grid gap-3">{result.items.map((item) => <div key={item.title} className="rounded-lg border bg-background/65 p-4"><p className="font-semibold">{item.title}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p></div>)}</div></CardContent></Card>}
          </div>
        </section>
      </div>
    </main>
  );
}

function buildLocalPreview(form: ResumeForm, role: string) {
  const name = form.name || "YOUR NAME";
  const contact = form.contact || "email@example.com | LinkedIn | GitHub | Portfolio";
  return `${name.toUpperCase()}\n${form.headline || role}\n${contact}\n\nSUMMARY\n${form.summary || `Targeting ${role} roles with hands-on software, data, and AI project experience.`}\n\nSKILLS\n${form.skills || "Python, TypeScript, SQL, APIs, Machine Learning, LLMs, RAG, Docker"}\n\nEXPERIENCE\n${form.experience || "- Add 2-4 quantified achievements with action verbs and measurable impact."}\n\nPROJECTS\n${form.projects || "- Add AI/ML projects with stack, outcome, and deployed links."}\n\nEDUCATION\n${form.education || "- Degree, institution, graduation year, relevant coursework."}`;
}

const resumePrintCss = "@page{size:letter;margin:.45in}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0}.resume{max-width:7.6in;margin:0 auto;font-size:10.5pt;line-height:1.32}br{line-height:1.32}";
function escapeHtml(value: string) { return value.replace(/[&<>'\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[char] ?? char)); }
function CareerSetup({ user }: { user: CareerUser }) { const { resolvedTheme, setTheme } = useTheme(); return <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground"><div className="absolute right-4 top-4 flex gap-2"><Button variant="outline" size="icon" title="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button><Button asChild><Link href="/sign-in">Login</Link></Button></div><section className="mx-auto max-w-2xl rounded-[1.5rem] border bg-card/70 p-8 text-center shadow-soft backdrop-blur-2xl"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><BriefcaseBusiness className="h-7 w-7" /></div><h1 className="mt-5 text-3xl font-semibold">Career Copilot is ready, {user.firstName}.</h1><p className="mt-3 text-muted-foreground">Add Clerk keys to enable personalized career tools.</p></section></main>; }
