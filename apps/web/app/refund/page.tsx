import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const items = [
  ["Monthly plans", "Customers may cancel renewal from the billing portal when payments are configured. Access remains available until the end of the paid period unless the operator's policy says otherwise."],
  ["Refund window", "A production operator may offer a 7-day refund window for first-time paid subscriptions if usage is reasonable and no abuse is detected."],
  ["Enterprise and custom work", "Enterprise, white-label, setup, and customization fees are usually non-refundable after work starts unless a written agreement says otherwise."],
  ["Payment provider", "Refunds are processed through the connected payment provider, such as Stripe, Razorpay, Paddle, or another configured gateway."],
];

export default function RefundPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Button asChild variant="ghost" size="sm"><Link href="/">Back to HumanOS AI</Link></Button>
        <div className="mt-8">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary"><RotateCcw className="h-4 w-4" /> Billing</p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">Refund Policy</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">A buyer-ready refund policy template for subscription and white-label deployments.</p>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: July 5, 2026</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {items.map(([title, body]) => <Card key={title} className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><p className="text-sm leading-7 text-muted-foreground">{body}</p></CardContent></Card>)}
        </div>
      </div>
    </main>
  );
}
