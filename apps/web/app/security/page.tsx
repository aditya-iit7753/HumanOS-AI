import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const controls = [
  "Clerk authentication and protected app routes.",
  "Backend token verification through Clerk JWKS and issuer settings.",
  "PostgreSQL for application records and Qdrant for vector search data.",
  "Server-side OpenAI calls so provider keys are not exposed in the browser.",
  "CORS allowlist and optional Vercel preview origin regex.",
  "Environment-based secrets for OpenAI, database, Clerk, Qdrant, and payments.",
  "User memory controls with edit and delete flows.",
  "Docker/Vercel/Railway deployment documentation for repeatable setup.",
];

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Button asChild variant="ghost" size="sm"><Link href="/">Back to HumanOS AI</Link></Button>
        <div className="mt-8">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary"><ShieldCheck className="h-4 w-4" /> Trust</p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">Security Overview</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">HumanOS AI is structured for secure SaaS deployment with buyer-owned infrastructure and keys.</p>
        </div>
        <Card className="mt-8 bg-card/70 backdrop-blur-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-primary" /> Production controls</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm leading-7 text-muted-foreground sm:grid-cols-2">
            {controls.map((item) => <p key={item} className="rounded-lg border bg-background/60 p-3">- {item}</p>)}
          </CardContent>
        </Card>
        <p className="mt-8 rounded-lg border bg-card/70 p-4 text-sm leading-7 text-muted-foreground">Before public launch, configure production keys, rotate any test credentials, enable payment webhooks, review database backups, add monitoring, and update legal contact details.</p>
      </div>
    </main>
  );
}
