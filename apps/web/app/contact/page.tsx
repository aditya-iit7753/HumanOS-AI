import Link from "next/link";
import { HelpCircle, Mail, MessageSquare, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const supportEmail = "assaditya.iit@gmail.com";

const topics = [
  ["Billing and subscriptions", "Payment status, active plan issues, Razorpay receipts, renewals, and cancellation questions."],
  ["Account access", "Sign in, signup, Clerk profile, dashboard access, and profile sync problems."],
  ["Product help", "AI chat, memory, tasks, goals, documents, planner, agents, and Career Copilot usage."],
  ["Business enquiries", "Partnerships, custom deployment, white-label use, and enterprise plans."],
  ["Advertising", "Sponsored placements, campaign enquiries, student offers, career tools, and brand partnerships."],
];

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Button asChild variant="ghost" size="sm"><Link href="/">Back to HumanOS AI</Link></Button>
        <section className="mt-10 rounded-[1.5rem] border bg-card/70 p-6 shadow-soft backdrop-blur-2xl sm:p-10">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary"><HelpCircle className="h-4 w-4" /> Contact and Support</p>
          <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">Need help with HumanOS AI?</h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">For support, billing questions, product issues, or business enquiries, email the HumanOS AI team. Include your account email, payment ID if relevant, and a short description of the problem.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild><a href={`mailto:${supportEmail}?subject=HumanOS%20AI%20Support`}><Mail className="h-4 w-4" />Email support</a></Button>
            <Button asChild variant="outline"><Link href="/refund">Refund and cancellation policy</Link></Button>
            <Button asChild variant="outline"><Link href="/advertise">Advertise with us</Link></Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Support email: <a className="font-medium text-foreground underline" href={`mailto:${supportEmail}`}>{supportEmail}</a></p>
        </section>
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {topics.map(([title, body]) => <Card key={title} className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><MessageSquare className="h-5 w-5 text-primary" />{title}</CardTitle></CardHeader><CardContent><p className="text-sm leading-7 text-muted-foreground">{body}</p></CardContent></Card>)}
        </section>
        <Card className="mt-6 bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-secondary" />Response expectations</CardTitle></CardHeader><CardContent><p className="text-sm leading-7 text-muted-foreground">Most support requests are reviewed within 24-48 hours. Urgent payment issues should include the Razorpay payment ID, subscription plan, account email, and screenshot if available.</p></CardContent></Card>
      </div>
    </main>
  );
}
