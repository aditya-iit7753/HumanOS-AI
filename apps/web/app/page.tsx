"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Brain,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  FileText,
  Layers3,
  Moon,
  Play,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const features = [
  { icon: Brain, title: "Life memory", text: "HumanOS remembers your preferences, commitments, context, and patterns so every answer starts closer to you." },
  { icon: BookOpen, title: "Study system", text: "Turn notes, classes, and research into focused plans, summaries, reviews, and next actions." },
  { icon: Target, title: "Goal engine", text: "Break ambitions into milestones, weekly priorities, and tiny actions that keep momentum visible." },
  { icon: Zap, title: "Productivity flow", text: "Plan your day, triage tasks, draft messages, and recover focus from one calm command center." },
];

const workflow = [
  "Connect your goals, documents, notes, and career context.",
  "HumanOS builds a private operating model of your life and work.",
  "Ask, plan, decide, and execute with memory-aware guidance every day.",
];

const pricing = [
  {
    name: "Free",
    price: "Rs. 0",
    period: "/month",
    copy: "For trying the HumanOS core loop.",
    featured: false,
    limits: { chat: "50 messages / month", memory: "25 saved memories", documents: "3 uploads / month", agents: "Research + Study preview", career: "Basic roadmap only" },
  },
  {
    name: "Starter",
    price: "Rs. 149",
    period: "/month",
    copy: "For students and job seekers who want an affordable AI copilot.",
    featured: false,
    limits: { chat: "100 messages / month", memory: "50 saved memories", documents: "5 uploads / month", agents: "Research + Study", career: "Basic career roadmap" },
  },
  {
    name: "Pro",
    price: "Rs. 249",
    period: "/month",
    copy: "Launch price for students, builders, and focused career growth.",
    featured: true,
    limits: { chat: "1,000 messages / month", memory: "500 saved memories", documents: "50 uploads / month", agents: "All standard agents", career: "Full Career Copilot" },
  },
  {
    name: "Premium",
    price: "Rs. 299",
    period: "/month",
    copy: "Launch price for power users running life, study, work, and documents in HumanOS.",
    featured: false,
    limits: { chat: "Unlimited fair use", memory: "Unlimited memories", documents: "250 uploads / month", agents: "All agents + priority runs", career: "Advanced ATS + interview prep" },
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    copy: "For teams, cohorts, institutions, and managed deployments.",
    featured: false,
    limits: { chat: "Custom limits", memory: "Workspace memory controls", documents: "Custom storage policy", agents: "Custom agent workflows", career: "Team career programs" },
  },
];

const faqs = [
  { q: "Is HumanOS AI private?", a: "Yes. The product is designed around authenticated workspaces, user-owned data, and memory that can be reviewed and controlled." },
  { q: "Can it help with my career?", a: "HumanOS maps your current role, target role, skills, proof points, and weekly focus into a practical career roadmap." },
  { q: "Does it work with documents?", a: "The Document Copilot is built for summarizing, extracting decisions, drafting outputs, and turning files into action plans." },
  { q: "Is there a free plan?", a: "Yes. Starter gives you the core AI chat, memory, and goal experience before upgrading to Pro." },
];

export default function LandingPage() {
  const { theme, setTheme } = useTheme();

  return (
    <main className="min-h-screen overflow-hidden">
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-background/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#hero" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></span>
            HumanOS AI
          </a>
          <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#career" className="hover:text-foreground">Career</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" title="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <Sun className="hidden h-4 w-4 dark:block" />
              <Moon className="h-4 w-4 dark:hidden" />
            </Button>
            <Button asChild className="hidden sm:inline-flex"><Link href="/sign-up">Sign up</Link></Button>
          </div>
        </div>
      </nav>

      <Hero />
      <Features />
      <HowItWorks />
      <CopilotSections />
      <MemorySystem />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}

function Hero() {
  return (
    <section id="hero" className="relative isolate flex min-h-[92svh] items-center px-4 pt-24 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(140deg,rgba(37,99,235,.18),transparent_34%),linear-gradient(320deg,rgba(16,185,129,.14),transparent_30%)]" />
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[.95fr_1.05fr]">
        <div className="max-w-3xl animate-rise">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1.5 text-sm text-muted-foreground shadow-soft backdrop-blur-xl">
            <BadgeCheck className="h-4 w-4 text-secondary" />
            Personal AI operating system
          </div>
          <h1 className="text-5xl font-semibold tracking-normal sm:text-7xl">HumanOS AI</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
            One premium copilot for life, study, career, documents, goals, memory, and productivity.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="default" className="h-12 px-6"><Link href="/sign-up">Start building your OS <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button asChild variant="outline" className="h-12 px-6 bg-background/50 backdrop-blur-xl"><Link href="/sign-in"><Play className="h-4 w-4" /> Login</Link></Button>
          </div>
        </div>
        <ProductVisual />
      </div>
    </section>
  );
}

function ProductVisual() {
  return (
    <div className="relative mx-auto w-full max-w-2xl animate-float">
      <div className="absolute -inset-6 rounded-[2rem] bg-primary/10 blur-3xl" />
      <div className="relative rounded-[1.5rem] border border-white/20 bg-card/55 p-3 shadow-[0_30px_100px_rgba(2,6,23,.22)] backdrop-blur-2xl">
        <div className="rounded-[1.1rem] border bg-background/80 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-1.5"><span className="h-3 w-3 rounded-full bg-red-400" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-emerald-400" /></div>
            <span className="text-xs text-muted-foreground">HumanOS Command Center</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1.2fr_.8fr]">
            <GlassPanel title="Today" icon={Sparkles} lines={["Deep work block", "Review career roadmap", "Summarize investor notes"]} />
            <div className="grid gap-3">
              <Metric label="Memory confidence" value="94%" />
              <Metric label="Goal velocity" value="3.8x" />
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniPanel title="Career" value="Next role mapped" icon={BriefcaseBusiness} />
            <MiniPanel title="Docs" value="12 insights" icon={FileText} />
            <MiniPanel title="Systems" value="6 loops closed" icon={Layers3} />
            <MiniPanel title="Study" value="Review ready" icon={BookOpen} />
          </div>
          <div className="mt-3 rounded-lg border bg-card/70 p-4">
            <p className="text-sm font-medium">AI recommendation</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Protect a 90-minute portfolio sprint today. It advances your target role and clears the strongest open loop.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="px-4 py-20 sm:px-6 lg:px-8">
      <SectionHeader kicker="Features" title="Everything you need to operate with clarity." />
      <div className="mx-auto mt-10 grid max-w-7xl gap-4 md:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => <FeatureCard key={feature.title} {...feature} />)}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="border-y bg-card/35 px-4 py-20 backdrop-blur-xl sm:px-6 lg:px-8">
      <SectionHeader kicker="How it works" title="From scattered context to one intelligent system." />
      <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
        {workflow.map((item, index) => (
          <div key={item} className="rounded-lg border bg-background/65 p-6 shadow-soft backdrop-blur-xl">
            <span className="text-sm font-semibold text-primary">0{index + 1}</span>
            <p className="mt-4 text-lg font-medium leading-7">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CopilotSections() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-2">
        <DeepDive id="career" icon={BriefcaseBusiness} title="Career Copilot" text="Map your target role, identify skill gaps, generate proof-point projects, and convert ambition into weekly traction." items={["Role trajectory", "Skill-gap radar", "Interview and portfolio prep"]} />
        <DeepDive icon={FileText} title="Document Copilot" text="Turn documents, notes, PDFs, and research into summaries, decisions, tasks, drafts, and reusable knowledge." items={["Smart summaries", "Action extraction", "Reusable knowledge base"]} />
      </div>
    </section>
  );
}

function MemorySystem() {
  return (
    <section className="px-4 pb-20 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-8 rounded-[1.5rem] border bg-card/55 p-6 shadow-soft backdrop-blur-2xl lg:grid-cols-[.85fr_1.15fr] lg:p-10">
        <div>
          <p className="text-sm font-semibold text-secondary">Memory System</p>
          <h2 className="mt-3 text-3xl font-semibold sm:text-5xl">An AI that compounds context.</h2>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">HumanOS stores durable facts, preferences, goals, work history, document insights, and decision patterns so your copilot becomes more useful every week.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {["Preferences", "Career goals", "Study notes", "Document insights", "Habits", "Open loops"].map((item) => (
            <div key={item} className="rounded-lg border bg-background/70 p-4 backdrop-blur-xl"><Brain className="mb-3 h-5 w-5 text-primary" /><p className="font-medium">{item}</p></div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="border-y bg-card/35 px-4 py-20 backdrop-blur-xl sm:px-6 lg:px-8">
      <SectionHeader kicker="Pricing" title="Choose the operating system tier that matches your ambition." />
      <div className="mx-auto mt-10 grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-5">
        {pricing.map((plan) => <PricingCard key={plan.name} plan={plan} />)}
      </div>
      <div className="mx-auto mt-6 flex max-w-7xl justify-center">
        <Button asChild variant="outline" className="bg-background/60"><Link href="/pricing">Compare all limits <ArrowRight className="h-4 w-4" /></Link></Button>
      </div>
    </section>
  );
}

function PricingCard({ plan }: { plan: (typeof pricing)[number] }) {
  const limits = [
    ["Chat limit", plan.limits.chat],
    ["Memory limit", plan.limits.memory],
    ["Document upload limit", plan.limits.documents],
    ["Agent access", plan.limits.agents],
    ["Career Copilot access", plan.limits.career],
  ];
  return (
    <div className={cn("flex h-full flex-col rounded-lg border bg-background/70 p-5 shadow-soft backdrop-blur-xl", plan.featured && "border-primary bg-primary/10 ring-1 ring-primary/30")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{plan.name}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{plan.copy}</p>
        </div>
        {plan.featured && <span className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">Best value</span>}
      </div>
      <p className="mt-5 text-4xl font-semibold">{plan.price}<span className="text-base font-normal text-muted-foreground">{plan.period}</span></p>
      <div className="mt-6 flex-1 space-y-3">
        {limits.map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card/60 p-3">
            <p className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground"><Check className="h-3.5 w-3.5 text-secondary" />{label}</p>
            <p className="mt-1 text-sm font-medium leading-6">{value}</p>
          </div>
        ))}
      </div>
      <Button asChild className="mt-6 w-full" variant={plan.featured ? "default" : "outline"}><Link href={plan.name === "Enterprise" ? "mailto:sales@humanos.ai?subject=HumanOS%20AI%20Enterprise" : "/pricing"}>{plan.name === "Enterprise" ? "Contact sales" : `Choose ${plan.name}`}</Link></Button>
    </div>
  );
}

function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="px-4 py-20 sm:px-6 lg:px-8">
      <SectionHeader kicker="FAQ" title="Questions before you install a new way of working." />
      <div className="mx-auto mt-10 max-w-3xl space-y-3">
        {faqs.map((faq, index) => (
          <button key={faq.q} onClick={() => setOpen(open === index ? -1 : index)} className="w-full rounded-lg border bg-card/70 p-5 text-left shadow-soft backdrop-blur-xl">
            <span className="flex items-center justify-between gap-4 font-medium">{faq.q}<ChevronDown className={cn("h-4 w-4 transition", open === index && "rotate-180")} /></span>
            {open === index && <p className="mt-3 text-sm leading-6 text-muted-foreground">{faq.a}</p>}
          </button>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section id="cta" className="px-4 pb-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-[1.5rem] border bg-foreground p-8 text-background shadow-soft sm:p-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold opacity-70">HumanOS AI</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold sm:text-5xl">Build the personal operating system your future self keeps asking for.</h2>
          </div>
          <Button asChild className="h-12 bg-background px-6 text-foreground hover:bg-background/90"><Link href="/sign-up">Join the private beta <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ kicker, title }: { kicker: string; title: string }) {
  return <div className="mx-auto max-w-3xl text-center"><p className="text-sm font-semibold text-primary">{kicker}</p><h2 className="mt-3 text-3xl font-semibold sm:text-5xl">{title}</h2></div>;
}

function FeatureCard({ icon: Icon, title, text }: { icon: typeof Brain; title: string; text: string }) {
  return <div className="rounded-lg border bg-card/60 p-6 shadow-soft backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:bg-card/80"><Icon className="h-6 w-6 text-primary" /><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p></div>;
}

function DeepDive({ id, icon: Icon, title, text, items }: { id?: string; icon: typeof Brain; title: string; text: string; items: string[] }) {
  return <div id={id} className="rounded-[1.25rem] border bg-card/60 p-6 shadow-soft backdrop-blur-2xl sm:p-8"><Icon className="h-7 w-7 text-primary" /><h2 className="mt-5 text-3xl font-semibold">{title}</h2><p className="mt-4 text-base leading-7 text-muted-foreground">{text}</p><div className="mt-6 grid gap-3">{items.map((item) => <p key={item} className="flex items-center gap-3 rounded-lg border bg-background/70 p-3 text-sm"><ShieldCheck className="h-4 w-4 text-secondary" />{item}</p>)}</div></div>;
}

function GlassPanel({ title, icon: Icon, lines }: { title: string; icon: typeof Brain; lines: string[] }) {
  return <div className="rounded-lg border bg-card/70 p-4 backdrop-blur-xl"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><p className="font-medium">{title}</p></div><div className="mt-4 space-y-2">{lines.map((line) => <p key={line} className="rounded-md bg-background/80 px-3 py-2 text-sm text-muted-foreground">{line}</p>)}</div></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-card/70 p-4 backdrop-blur-xl"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>;
}

function MiniPanel({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Brain }) {
  return <div className="rounded-lg border bg-card/70 p-4 backdrop-blur-xl"><Icon className="mb-3 h-4 w-4 text-accent" /><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{value}</p></div>;
}






function Footer() {
  return (
    <footer className="border-t bg-card/35 px-4 py-8 text-sm text-muted-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p>HumanOS AI - personal AI operating system for life and career.</p>
        <div className="flex flex-wrap gap-4">
          <Link href="/about" className="hover:text-foreground">About</Link>
          <Link href="/contact" className="hover:text-foreground">Contact</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/refund" className="hover:text-foreground">Refunds</Link>
          <Link href="/security" className="hover:text-foreground">Security</Link>
          <Link href="/sell" className="hover:text-foreground">For buyers</Link>
        </div>
      </div>
    </footer>
  );
}

