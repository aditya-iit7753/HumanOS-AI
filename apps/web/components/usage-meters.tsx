"use client";

import Link from "next/link";
import { BarChart3, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useSafeAuth } from "@/components/clerk-safe";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type LimitValue = number | string[] | string | null | undefined;

type UsagePayload = {
  plan: string;
  usage: Record<string, number>;
  limits: Record<string, LimitValue>;
};

const meterLabels: Record<string, string> = {
  chat_messages: "AI chat messages",
  memories: "Saved memories",
  documents: "Documents",
  agents: "Created agents",
  tasks: "Tasks",
  goals: "Goals",
  daily_plans: "Daily plans",
};

const orderedMeters = ["chat_messages", "memories", "documents", "agents", "tasks", "goals", "daily_plans"];

function numericLimit(limit: LimitValue) {
  return typeof limit === "number" ? limit : null;
}

function formatLimit(limit: LimitValue) {
  if (limit === null || limit === undefined) return "Unlimited";
  if (Array.isArray(limit)) return `${limit.length} included`;
  if (typeof limit === "number") return limit.toLocaleString();
  return String(limit);
}

export function UsageMeters({ className = "" }: { className?: string }) {
  const { getToken } = useSafeAuth();
  const [data, setData] = useState<UsagePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadUsage() {
      setIsLoading(true);
      setError("");
      try {
        const token = await getToken();
        if (!token) {
          setIsLoading(false);
          return;
        }
        const response = await fetch(`${API_URL}/billing/usage`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error("Unable to load usage meters");
        const payload = (await response.json()) as UsagePayload;
        if (!cancelled) setData(payload);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load usage meters");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadUsage();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const meters = useMemo(() => {
    if (!data) return [];
    return orderedMeters.map((key) => {
      const used = data.usage[key] ?? 0;
      const limit = numericLimit(data.limits[key]);
      const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
      return { key, used, limit, percent, rawLimit: data.limits[key] };
    });
  }, [data]);

  return (
    <Card className={cn("bg-card/65 backdrop-blur-2xl animate-soft-in", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-5 w-5 text-primary" /> Usage meters</CardTitle>
        <span className="rounded-md border bg-background/70 px-2.5 py-1 text-xs font-semibold capitalize text-muted-foreground">
          {data?.plan ?? "loading"}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading usage</p>}
        {error && <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
        {!isLoading && !error && data && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {meters.map((meter) => (
              <div key={meter.key} className="rounded-lg border bg-background/65 p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{meterLabels[meter.key]}</span>
                  <span className="text-muted-foreground">{meter.used.toLocaleString()} / {formatLimit(meter.rawLimit)}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full bg-primary transition-all", meter.percent >= 85 && "bg-red-500")}
                    style={{ width: meter.limit ? `${meter.percent}%` : "100%" }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {meter.limit ? `${Math.max(0, meter.limit - meter.used).toLocaleString()} remaining` : "No monthly limit on this plan"}
                </p>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-3 rounded-lg border bg-background/65 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Need more capacity?</p>
            <p className="mt-1 text-sm text-muted-foreground">Upgrade when a meter is close to full so users do not hit a blocked workflow.</p>
          </div>
          <Button asChild variant="outline" className="shrink-0 bg-background/50">
            <Link href="/pricing">Upgrade plan</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}