"use client";

import { useState } from "react";
import Link from "next/link";
import { useSafeAuth } from "@/components/clerk-safe";
import { ArrowRight, Check, ChevronLeft, Loader2, LockKeyhole, Moon, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type PlanId = "free" | "starter" | "pro" | "premium" | "enterprise";
type CheckoutResponse = {
  provider: "razorpay" | "stripe";
  url?: string | null;
  key_id?: string | null;
  subscription_id?: string | null;
  plan?: string | null;
  name?: string | null;
  email?: string | null;
};

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  prefill: { name?: string | null; email?: string | null };
  notes: Record<string, string>;
  theme: { color: string };
  handler: (response: RazorpaySuccessResponse) => void | Promise<void>;
  readonly?: { email?: boolean; contact?: boolean };
  modal: { ondismiss: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

const rows = [
  ["Chat limit", "chat"],
  ["Memory limit", "memory"],
  ["Document upload limit", "documents"],
  ["Agent access", "agents"],
  ["Career Copilot access", "career"],
] as const;

const plans: Array<{
  id: PlanId;
  name: string;
  price: string;
  period: string;
  copy: string;
  cta: string;
  featured: boolean;
  limits: Record<(typeof rows)[number][1], string>;
}> = [
  {
    id: "free",
    name: "Free",
    price: "Rs. 0",
    period: "/month",
    copy: "Try HumanOS with limited usage.",
    cta: "Start free",
    featured: false,
    limits: { chat: "50 messages / month", memory: "25 saved memories", documents: "3 uploads / month", agents: "Research + Study preview", career: "Basic roadmap only" },
  },
  {
    id: "starter",
    name: "Starter",
    price: "Rs. 149",
    period: "/month",
    copy: "Affordable access for students and job seekers.",
    cta: "Start Starter",
    featured: false,
    limits: { chat: "100 messages / month", memory: "50 saved memories", documents: "5 uploads / month", agents: "Research + Study", career: "Basic career roadmap" },
  },
  {
    id: "pro",
    name: "Pro",
    price: "Rs. 249",
    period: "/month",
    copy: "Launch price for serious personal execution.",
    cta: "Upgrade to Pro",
    featured: true,
    limits: { chat: "1,000 messages / month", memory: "500 saved memories", documents: "50 uploads / month", agents: "All standard agents", career: "Full Career Copilot" },
  },
  {
    id: "premium",
    name: "Premium",
    price: "Rs. 299",
    period: "/month",
    copy: "Launch price for power users and document workflows.",
    cta: "Upgrade to Premium",
    featured: false,
    limits: { chat: "Unlimited fair use", memory: "Unlimited memories", documents: "250 uploads / month", agents: "All agents + priority runs", career: "Advanced ATS + interview prep" },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    copy: "For managed teams, cohorts, and institutions.",
    cta: "Contact sales",
    featured: false,
    limits: { chat: "Custom limits", memory: "Workspace memory controls", documents: "Custom storage policy", agents: "Custom agent workflows", career: "Team career programs" },
  },
];

function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Unable to load Razorpay Checkout")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Razorpay Checkout"));
    document.body.appendChild(script);
  });
}

export default function PricingPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const { getToken, isSignedIn } = useSafeAuth();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState("");

  async function startCheckout(plan: PlanId) {
    setError("");
    if (plan === "free") {
      window.location.href = isSignedIn ? "/dashboard" : "/sign-up";
      return;
    }
    if (plan === "enterprise") {
      window.location.href = "mailto:sales@humanos.ai?subject=HumanOS%20AI%20Enterprise";
      return;
    }
    const token = await getToken();
    if (!token) {
      window.location.href = `/sign-up?redirect_url=${encodeURIComponent("/pricing")}`;
      return;
    }
    setLoadingPlan(plan);
    try {
      const response = await fetch(`${API_URL}/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ detail: "Unable to start checkout" }));
        throw new Error(body.detail ?? "Unable to start checkout");
      }
      const data = (await response.json()) as CheckoutResponse;
      if (data.provider === "razorpay") {
        if (!data.key_id || !data.subscription_id) throw new Error("Razorpay checkout is missing subscription details");
        await loadRazorpay();
        const checkout = new window.Razorpay!({
          key: data.key_id,
          subscription_id: data.subscription_id,
          name: "HumanOSai",
          description: `${plan.charAt(0).toUpperCase()}${plan.slice(1)} monthly subscription`,
          prefill: { name: data.name, email: data.email },
          notes: { plan, product: "HumanOSai", email: data.email ?? "" },
          readonly: { email: Boolean(data.email) },
          theme: { color: "#2563eb" },
          handler: async (payment: RazorpaySuccessResponse) => {
            try {
              const verifyResponse = await fetch(`${API_URL}/billing/razorpay/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ plan, ...payment }),
              });
              if (!verifyResponse.ok) {
                const body = await verifyResponse.json().catch(() => ({ detail: "Payment succeeded but plan activation failed" }));
                throw new Error(body.detail ?? "Payment succeeded but plan activation failed");
              }
              window.location.href = `/settings?billing=success&plan=${encodeURIComponent(plan)}`;
            } catch (verifyError) {
              setError(verifyError instanceof Error ? verifyError.message : "Payment succeeded but plan activation failed");
              setLoadingPlan(null);
            }
          },
          modal: {
            ondismiss: () => setLoadingPlan(null),
          },
        });
        checkout.open();
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("Checkout provider is not configured");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout");
      setLoadingPlan(null);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" size="sm"><Link href="/"><ChevronLeft className="h-4 w-4" />Home</Link></Button>
          <div className="flex items-center gap-2 font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></span>HumanOS AI Pricing</div>
          <Button variant="outline" size="icon" title="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
        </div>
      </header>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold text-primary">Pricing</p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-6xl">Simple plans for your personal AI operating system.</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">Upgrade as your chat, memory, documents, agents, and career workflows grow.</p>
          <p className="mt-3 text-sm font-medium text-secondary">Secure monthly subscriptions powered by Razorpay.</p>
          {error && <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
        </div>

        <div className="mx-auto mt-10 grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-5">
          {plans.map((plan) => <PlanCard key={plan.name} plan={plan} loading={loadingPlan === plan.id} onSelect={() => void startCheckout(plan.id)} />)}
        </div>

        <Card className="mx-auto mt-8 max-w-7xl bg-card/70 backdrop-blur-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><LockKeyhole className="h-5 w-5 text-primary" /> Feature limits enforced after payment confirmation</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-separate border-spacing-0 text-sm">
              <thead><tr>{["Feature", ...plans.map((plan) => plan.name)].map((head) => <th key={head} className="border-b px-4 py-3 text-left font-semibold">{head}</th>)}</tr></thead>
              <tbody>{rows.map(([label, key]) => <tr key={key}>{[label, ...plans.map((plan) => plan.limits[key])].map((cell, index) => <td key={`${key}-${index}`} className="border-b px-4 py-3 text-muted-foreground first:text-foreground first:font-medium">{cell}</td>)}</tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function PlanCard({ plan, loading, onSelect }: { plan: (typeof plans)[number]; loading: boolean; onSelect: () => void }) {
  return (
    <Card className={cn("flex h-full flex-col bg-card/70 backdrop-blur-2xl", plan.featured && "border-primary bg-primary/10 ring-1 ring-primary/30")}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3"><CardTitle>{plan.name}</CardTitle>{plan.featured && <span className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">Best value</span>}</div>
        <p className="text-sm leading-6 text-muted-foreground">{plan.copy}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="text-3xl font-semibold">{plan.price}<span className="text-base font-normal text-muted-foreground">{plan.period}</span></p>
        <div className="mt-6 flex-1 space-y-3">
          {rows.map(([label, key]) => <p key={key} className="flex items-start gap-2 text-sm leading-6"><Check className="mt-1 h-4 w-4 shrink-0 text-secondary" /><span><span className="font-medium">{label}:</span> {plan.limits[key]}</span></p>)}
        </div>
        <Button type="button" className="mt-6" variant={plan.featured ? "default" : "outline"} onClick={onSelect} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{plan.cta}</Button>
      </CardContent>
    </Card>
  );
}
