import Link from "next/link";
import { CreditCard, Mail, RotateCcw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const supportEmail = "humaosai@gmail.com";

const items = [
  ["Monthly subscriptions", "HumanOS AI paid plans are monthly subscriptions. Users can continue using paid features until the end of the active billing period after cancellation."],
  ["Cancellation", "To cancel or request cancellation help, contact support with your HumanOS AI account email and Razorpay payment or subscription ID. We will help stop future renewal where supported by the payment provider."],
  ["Refund eligibility", "First-time subscription payments may be considered for a refund within 7 days if the account has not heavily used paid features and there is no abuse, fraud, or policy violation."],
  ["Non-refundable cases", "Renewals, heavily used accounts, custom setup, enterprise work, white-label delivery, and misuse cases are generally not refundable unless required by law or agreed in writing."],
  ["Processing time", "Approved refunds are processed through Razorpay to the original payment method. Bank, card, wallet, or UPI processing time depends on Razorpay and the user's bank."],
  ["Required details", "For faster help, include your account email, plan name, payment date, Razorpay payment ID, and reason for cancellation or refund."],
];

export default function RefundPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Button asChild variant="ghost" size="sm"><Link href="/">Back to HumanOS AI</Link></Button>
        <div className="mt-8 rounded-[1.5rem] border bg-card/70 p-6 shadow-soft backdrop-blur-2xl sm:p-10">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary"><RotateCcw className="h-4 w-4" /> Refund and Cancellation</p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">Refund and Cancellation Policy</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">This page explains how HumanOS AI handles subscription cancellations, refund requests, payment support, and Razorpay processing.</p>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: July 21, 2026</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild><a href={`mailto:${supportEmail}?subject=HumanOS%20AI%20Refund%20or%20Cancellation`}><Mail className="h-4 w-4" />Contact support</a></Button>
            <Button asChild variant="outline"><Link href="/pricing"><CreditCard className="h-4 w-4" />View plans</Link></Button>
          </div>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {items.map(([title, body]) => <Card key={title} className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-secondary" />{title}</CardTitle></CardHeader><CardContent><p className="text-sm leading-7 text-muted-foreground">{body}</p></CardContent></Card>)}
        </div>
        <Card className="mt-6 bg-card/70 backdrop-blur-2xl"><CardContent className="pt-6"><p className="text-sm leading-7 text-muted-foreground">Support email: <a className="font-medium text-foreground underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>. This policy may be updated as HumanOS AI grows, but active users will be handled fairly based on the policy available at the time of request.</p></CardContent></Card>
      </div>
    </main>
  );
}