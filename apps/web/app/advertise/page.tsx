import Link from "next/link";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, CheckCircle2, FileText, Megaphone, MessageSquare, ShieldCheck, Sparkles, Target, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const supportEmail = "assaditya.iit@gmail.com";

const placements = [
  {
    icon: Target,
    title: "Sponsored dashboard card",
    text: "A native sponsored card for relevant tools, courses, events, career services, productivity products, or student offers.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Career Copilot sponsor",
    text: "Best for resume services, interview prep, coding bootcamps, hiring platforms, courses, and mentorship programs.",
  },
  {
    icon: FileText,
    title: "Document Copilot sponsor",
    text: "Best for PDF tools, note-taking apps, academic tools, productivity services, and document workflow products.",
  },
  {
    icon: MessageSquare,
    title: "Newsletter or launch mention",
    text: "A simple sponsored mention in HumanOS updates, user onboarding emails, or launch announcements when available.",
  },
];

const rules = [
  "Ads must be relevant to students, job seekers, professionals, AI learners, productivity users, or career growth.",
  "Sponsored content should be clearly marked as sponsored.",
  "No misleading claims, scams, gambling, adult content, fake jobs, or unsafe financial promises.",
  "HumanOS AI can reject ads that may harm user trust or brand quality.",
];

const packages = [
  ["Starter sponsor", "Rs. 999", "One sponsored mention or placement test for early advertisers."],
  ["Growth sponsor", "Rs. 2,999", "Multiple placements across relevant product areas for a short campaign."],
  ["Custom partner", "Custom", "For edtech, career-tech, HR, coaching, and SaaS partnership campaigns."],
];

export default function AdvertisePage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm"><Link href="/">Back to HumanOS AI</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/contact">Contact support</Link></Button>
        </div>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Megaphone className="h-4 w-4" /> Advertise with HumanOS AI</p>
            <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">Reach students, job seekers, AI learners, and productivity-focused users.</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">Companies can partner with HumanOS AI through relevant sponsored placements, career offers, education campaigns, productivity tools, and custom brand partnerships.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild><a href={`mailto:${supportEmail}?subject=Advertise%20with%20HumanOS%20AI&body=Hi%20HumanOS%20AI%2C%0A%0AWe%20want%20to%20advertise%20on%20HumanOS%20AI.%0A%0ACompany%20name%3A%0AWebsite%3A%0ATarget%20audience%3A%0ACampaign%20goal%3A%0ABudget%3A%0A%0AThanks.`}>Request ad placement <ArrowRight className="h-4 w-4" /></a></Button>
              <Button asChild variant="outline"><Link href="/pricing">View user plans</Link></Button>
            </div>
          </div>

          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Audience fit</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm leading-7 text-muted-foreground">
              {[
                "Students and AI learners",
                "Job seekers and career switchers",
                "Professionals building productivity systems",
                "Users working with documents, resumes, tasks, goals, and daily planning",
              ].map((item) => <p key={item} className="rounded-lg border bg-background/60 p-3">{item}</p>)}
            </CardContent>
          </Card>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {placements.map((placement) => (
            <Card key={placement.title} className="bg-card/70 backdrop-blur-2xl">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><placement.icon className="h-5 w-5 text-primary" />{placement.title}</CardTitle></CardHeader>
              <CardContent className="text-sm leading-7 text-muted-foreground">{placement.text}</CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Suggested ad packages</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {packages.map(([name, price, text]) => (
                <div key={name} className="rounded-lg border bg-background/60 p-4">
                  <div className="flex items-start justify-between gap-3"><p className="font-semibold">{name}</p><p className="font-semibold text-primary">{price}</p></div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Brand safety rules</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
              {rules.map((rule) => <p key={rule} className="flex gap-2 rounded-lg border bg-background/60 p-3"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-secondary" />{rule}</p>)}
            </CardContent>
          </Card>
        </section>

        <section className="mt-10 rounded-[1.5rem] border bg-card/65 p-6 shadow-soft backdrop-blur-2xl sm:p-8">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary"><BadgeCheck className="h-4 w-4" />Advertiser enquiry details</p>
          <p className="mt-3 text-lg leading-8 text-muted-foreground">Companies should include company name, website, product category, target audience, campaign goal, preferred placement, budget, and campaign dates. HumanOS AI will review fit before accepting a sponsored placement.</p>
          <Button asChild className="mt-6"><a href={`mailto:${supportEmail}?subject=HumanOS%20AI%20Advertising%20Enquiry`}>Email advertising enquiry</a></Button>
        </section>
      </div>
    </main>
  );
}
