import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LegalSection = { title: string; items: string[] };

const sections: LegalSection[] = [
  { title: "Information we collect", items: ["Account details such as name, email, and authentication identifiers.", "Workspace content such as chats, tasks, goals, memories, documents, planner entries, and agent outputs.", "Technical data such as device, browser, logs, API events, and usage metrics needed to operate the service."] },
  { title: "How we use data", items: ["To provide AI chat, memory, task, goal, document, career, agent, and planner features.", "To personalize responses using user-approved context and saved memories.", "To secure the product, debug issues, prevent abuse, and improve reliability."] },
  { title: "AI and third-party processors", items: ["HumanOS AI can send prompts, document excerpts, memories, and user instructions to configured AI providers such as OpenAI.", "Authentication, hosting, database, vector search, analytics, and payment providers may process limited data required for their services.", "Production buyers should connect their own provider accounts and review each provider's data processing terms."] },
  { title: "User controls", items: ["Users can review, edit, and delete saved memories inside the app.", "Users can request export or deletion of account data from settings or support.", "Workspace owners are responsible for configuring retention, billing, and legal settings for their deployment."] },
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" subtitle="How HumanOS AI handles account, workspace, AI, and product data." sections={sections} />;
}

function LegalPage({ title, subtitle, sections }: { title: string; subtitle: string; sections: LegalSection[] }) {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Button asChild variant="ghost" size="sm"><Link href="/">Back to HumanOS AI</Link></Button>
        <div className="mt-8">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary"><ShieldCheck className="h-4 w-4" /> Legal</p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">{title}</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">{subtitle}</p>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: July 5, 2026</p>
        </div>
        <div className="mt-8 space-y-4">
          {sections.map((section) => (
            <Card key={section.title} className="bg-card/70 backdrop-blur-2xl">
              <CardHeader><CardTitle className="text-xl">{section.title}</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
                {section.items.map((item) => <p key={item}>- {item}</p>)}
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-8 rounded-lg border bg-card/70 p-4 text-sm leading-7 text-muted-foreground">This template is provided for product readiness and should be reviewed by qualified legal counsel before public commercial launch.</p>
      </div>
    </main>
  );
}


