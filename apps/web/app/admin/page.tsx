"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, ArrowLeft, BarChart3, CreditCard, Loader2, RefreshCw, Users, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SafeUserButton, useSafeAuth } from "@/components/clerk-safe";
import { UsageMeters } from "@/components/usage-meters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Overview = {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
  active_paid_subscriptions: number;
  estimated_mrr_inr: number;
};

type Usage = Record<string, number>;

type Engagement = {
  messages_7d: number;
  tasks_created_7d: number;
  documents_uploaded_30d: number;
  average_planner_score: number;
};

type SubscriptionRow = { plan: string; status: string; count: number };
type RecentUser = { id: string; email: string; full_name: string; role: string; created_at: string };

type AdminAnalytics = {
  generated_at: string;
  overview: Overview;
  usage: Usage;
  engagement: Engagement;
  subscriptions: SubscriptionRow[];
  recent_users: RecentUser[];
};

const usageLabels: Record<string, string> = {
  conversations: "Conversations",
  messages: "Messages",
  memories: "Memories",
  tasks: "Tasks",
  open_tasks: "Open tasks",
  goals: "Goals",
  documents: "Documents",
  agents: "Agents",
  daily_plans: "Daily plans",
};

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default function AdminPage() {
  const { getToken } = useSafeAuth();
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async function loadAnalytics() {
    setIsLoading(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) {
        setError("Sign in to view the admin dashboard.");
        return;
      }
      const response = await fetch(`${API_URL}/admin/analytics`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 403) throw new Error("Admin access required. Add your email to ADMIN_EMAILS on Railway or set your user role to admin.");
      if (!response.ok) throw new Error("Unable to load admin analytics.");
      setData((await response.json()) as AdminAnalytics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load admin analytics.");
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const usageRows = useMemo(() => Object.entries(data?.usage ?? {}), [data]);

  return (
    <main className="min-h-screen bg-background/80">
      <header className="sticky top-0 z-30 border-b bg-background/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" className="gap-2">
            <Link href="/dashboard"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" title="Refresh analytics" onClick={() => void loadAnalytics()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <SafeUserButton />
          </div>
        </div>
      </header>

      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[1.5rem] border bg-card/65 p-6 shadow-soft backdrop-blur-2xl sm:p-8">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary"><BarChart3 className="h-4 w-4" /> Admin analytics</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold sm:text-5xl">HumanOS AI control room</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Track growth, product usage, subscription health, and account activity from one private owner dashboard.
          </p>
        </div>

        {isLoading && (
          <Card className="bg-card/65 backdrop-blur-2xl">
            <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading analytics</CardContent>
          </Card>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {data && (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Metric icon={Users} label="Total users" value={data.overview.total_users.toLocaleString()} detail={`${data.overview.new_users_7d} new in 7 days`} />
              <Metric icon={CreditCard} label="Paid subscriptions" value={data.overview.active_paid_subscriptions.toLocaleString()} detail="Active or trialing plans" />
              <Metric icon={BarChart3} label="Estimated MRR" value={formatInr(data.overview.estimated_mrr_inr)} detail="Based on current Razorpay plan prices" />
              <Metric icon={Zap} label="Planner score" value={`${data.engagement.average_planner_score}%`} detail="Average daily plan score" />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1fr_.8fr]">
              <Card className="bg-card/65 backdrop-blur-2xl">
                <CardHeader><CardTitle>Product usage</CardTitle></CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {usageRows.map(([key, value]) => (
                    <div key={key} className="rounded-lg border bg-background/65 p-4">
                      <p className="text-xs font-medium uppercase text-muted-foreground">{usageLabels[key] ?? key}</p>
                      <p className="mt-3 text-2xl font-semibold">{value.toLocaleString()}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-card/65 backdrop-blur-2xl">
                <CardHeader><CardTitle>Subscriptions</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {data.subscriptions.length ? data.subscriptions.map((row) => (
                    <div key={`${row.plan}-${row.status}`} className="flex items-center justify-between rounded-lg border bg-background/65 p-3 text-sm">
                      <span className="capitalize">{row.plan} - {row.status}</span>
                      <span className="font-semibold">{row.count}</span>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No subscription records yet.</p>}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
              <Card className="bg-card/65 backdrop-blur-2xl">
                <CardHeader><CardTitle>Recent users</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {data.recent_users.length ? data.recent_users.map((recentUser) => (
                    <div key={recentUser.id} className="rounded-lg border bg-background/65 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold">{recentUser.full_name}</p>
                        <span className="rounded-md border px-2 py-1 text-xs capitalize text-muted-foreground">{recentUser.role}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{recentUser.email}</p>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No users yet.</p>}
                </CardContent>
              </Card>

              <UsageMeters />
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <Card className="bg-card/65 backdrop-blur-2xl animate-soft-in">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <p className="mt-4 text-3xl font-semibold">{value}</p>
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
