import Link from "next/link";
import { ArrowRight, BadgeCheck, Boxes, CheckCircle2, ExternalLink, FileText, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const assets = ["Full Next.js frontend", "FastAPI backend", "PostgreSQL schema", "Qdrant vector search", "Clerk authentication", "OpenAI integration", "Billing foundation", "Docker Compose", "Vercel and Railway config", "Sales kit PDFs"];
const buyerSteps = ["Replace OpenAI, Clerk, database, Qdrant, payment, and domain keys.", "Update brand name, logo, support email, legal pages, and pricing.", "Run deployment acceptance tests for signup, chat, tasks, documents, memory, agents, and billing.", "Launch with monitoring, backups, analytics, and customer support workflow."];

export default function SellPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Button asChild variant="ghost" size="sm"><Link href="/">Back to HumanOS AI</Link></Button>
        <section className="mt-10 grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-primary"><BadgeCheck className="h-4 w-4" /> Buyer-ready SaaS asset</p>
            <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">HumanOS AI is packaged for acquisition, white-label, or productized resale.</h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">A full-stack AI life and career copilot with deployable code, auth, database, vector search, AI flows, billing foundation, deployment docs, and sales materials.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button asChild><Link href="/pricing">View SaaS pricing <ArrowRight className="h-4 w-4" /></Link></Button><Button asChild variant="outline"><a href="https://human-os-ai-aditya-iit7753s-projects.vercel.app" target="_blank" rel="noreferrer">Open live demo <ExternalLink className="h-4 w-4" /></a></Button></div>
          </div>
          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><Boxes className="h-5 w-5 text-primary" /> What is included</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              {assets.map((asset) => <p key={asset} className="flex items-center gap-2 rounded-lg border bg-background/60 p-3"><CheckCircle2 className="h-4 w-4 text-secondary" />{asset}</p>)}
            </CardContent>
          </Card>
        </section>
        <section className="mt-10 grid gap-4 lg:grid-cols-2">
          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><Rocket className="h-5 w-5 text-primary" /> Buyer launch checklist</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">{buyerSteps.map((step) => <p key={step}>- {step}</p>)}</CardContent></Card>
          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Recommended offer</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-7 text-muted-foreground"><p>- Suggested source-code acquisition price: Rs. 5,00,000.</p><p>- Include a short handover period, not unlimited future development.</p><p>- Buyer should use their own production API keys, hosting accounts, database, vector database, domain, and payment provider.</p><p>- Use a written agreement before repo transfer.</p></CardContent></Card>
        </section>
      </div>
    </main>
  );
}
