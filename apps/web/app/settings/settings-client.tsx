"use client";

import Link from "next/link";
import { UserButton, useAuth } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { ArrowDownToLine, ChevronLeft, CreditCard, KeyRound, Loader2, Moon, Save, Settings, ShieldAlert, Sparkles, Sun, Trash2, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type AppUser = { firstName: string; fullName: string; email: string };
type SubscriptionPayload = { plan: string; status: string; limits: Record<string, unknown>; current_period_end?: string | null; cancel_at_period_end: boolean; stripe_customer_id?: string | null };

type SettingsPayload = {
  user: { id: string; email: string; full_name: string; role: string; created_at: string };
  ai_preferences: { model?: string; tone?: string; response_style?: string; custom_instructions?: string };
  memory_enabled: boolean;
  theme: "light" | "dark" | "system";
  dev_api_keys: Record<string, string>;
  updated_at: string;
};

export function SettingsClient({ user, clerkReady }: { user: AppUser; clerkReady: boolean }) {
  if (!clerkReady) return <SettingsPreview user={user} />;
  return <AuthenticatedSettings fallbackUser={user} />;
}

function AuthenticatedSettings({ fallbackUser }: { fallbackUser: AppUser }) {
  const { getToken, signOut } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionPayload | null>(null);
  const [fullName, setFullName] = useState(fallbackUser.fullName);
  const [model, setModel] = useState("gpt-4.1-mini");
  const [tone, setTone] = useState("practical");
  const [responseStyle, setResponseStyle] = useState("concise");
  const [customInstructions, setCustomInstructions] = useState("");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [themeChoice, setThemeChoice] = useState<"light" | "dark" | "system">("system");
  const [openaiKey, setOpenaiKey] = useState("");
  const [qdrantKey, setQdrantKey] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBillingLoading, setIsBillingLoading] = useState(false);

  useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await getToken();
    if (!token) throw new Error("Missing Clerk session token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  async function loadSettings() {
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/settings`, { headers });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as SettingsPayload;
      setSettings(data);
      setFullName(data.user.full_name);
      setModel(data.ai_preferences.model ?? "gpt-4.1-mini");
      setTone(data.ai_preferences.tone ?? "practical");
      setResponseStyle(data.ai_preferences.response_style ?? "concise");
      setCustomInstructions(data.ai_preferences.custom_instructions ?? "");
      setMemoryEnabled(data.memory_enabled);
      setThemeChoice(data.theme);
      setTheme(data.theme);
      const subscriptionResponse = await fetch(`${API_URL}/billing/subscription`, { headers });
      if (subscriptionResponse.ok) setSubscription((await subscriptionResponse.json()) as SubscriptionPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load settings");
    }
  }

  async function saveSettings(event?: FormEvent) {
    event?.preventDefault();
    setIsSaving(true);
    setStatus("");
    setError("");
    try {
      const headers = await authHeaders();
      const dev_api_keys: Record<string, string> = {};
      if (openaiKey.trim()) dev_api_keys.openai_api_key = openaiKey.trim();
      if (qdrantKey.trim()) dev_api_keys.qdrant_api_key = qdrantKey.trim();
      const response = await fetch(`${API_URL}/settings`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          full_name: fullName,
          memory_enabled: memoryEnabled,
          theme: themeChoice,
          ai_preferences: { model, tone, response_style: responseStyle, custom_instructions: customInstructions },
          dev_api_keys,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as SettingsPayload;
      setSettings(data);
      setOpenaiKey("");
      setQdrantKey("");
      setTheme(data.theme);
      setStatus("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  async function exportData() {
    setIsExporting(true);
    setStatus("");
    setError("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing Clerk session token");
      const response = await fetch(`${API_URL}/settings/export`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "humanos-export.json";
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("Data export downloaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to export data");
    } finally {
      setIsExporting(false);
    }
  }


  async function openBillingPortal() {
    setIsBillingLoading(true);
    setStatus("");
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/billing/portal`, { method: "POST", headers });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as { url: string };
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open billing portal");
    } finally {
      setIsBillingLoading(false);
    }
  }

  async function deleteAccount() {
    setIsDeleting(true);
    setStatus("");
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/settings/account`, { method: "DELETE", headers, body: JSON.stringify({ confirmation: deleteConfirmation }) });
      if (!response.ok) throw new Error(await response.text());
      setStatus("Local HumanOS account deleted.");
      await signOut();
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete account");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="sm"><Link href="/dashboard"><ChevronLeft className="h-4 w-4" />Dashboard</Link></Button>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">Settings</p><p className="text-xs text-muted-foreground">Profile, AI, memory, theme, data, and development keys</p></div>
          </div>
          <div className="flex items-center gap-2"><Button variant="outline" size="icon" title="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button><UserButton /></div>
        </div>
      </header>

      <form onSubmit={saveSettings} className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_.9fr] lg:px-8">
        <section className="flex flex-col gap-4">
          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-5 w-5 text-primary" /> Profile settings</CardTitle></CardHeader><CardContent className="space-y-3"><Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" /><Input value={settings?.user.email ?? fallbackUser.email} disabled /></CardContent></Card>
          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-5 w-5 text-secondary" /> AI preferences</CardTitle></CardHeader><CardContent className="space-y-3"><Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="Default model" /><div className="grid gap-3 sm:grid-cols-2"><select value={tone} onChange={(event) => setTone(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="practical">Practical</option><option value="coach">Coach</option><option value="technical">Technical</option><option value="concise">Concise</option></select><select value={responseStyle} onChange={(event) => setResponseStyle(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="concise">Concise</option><option value="detailed">Detailed</option><option value="step_by_step">Step by step</option></select></div><Textarea value={customInstructions} onChange={(event) => setCustomInstructions(event.target.value)} placeholder="Custom AI instructions" /></CardContent></Card>
          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Settings className="h-5 w-5 text-primary" /> Memory and theme</CardTitle></CardHeader><CardContent className="space-y-4"><button type="button" onClick={() => setMemoryEnabled((value) => !value)} className="flex w-full items-center justify-between rounded-lg border bg-background/65 p-4 text-left"><span><span className="block text-sm font-semibold">Memory system</span><span className="text-sm text-muted-foreground">Controls chat memory retrieval and automatic saving.</span></span><span className={cn("rounded-md px-3 py-1 text-sm", memoryEnabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{memoryEnabled ? "On" : "Off"}</span></button><div className="grid gap-2 sm:grid-cols-3">{(["system", "light", "dark"] as const).map((item) => <button key={item} type="button" onClick={() => { setThemeChoice(item); setTheme(item); }} className={cn("rounded-lg border p-3 text-sm capitalize", themeChoice === item ? "border-primary bg-primary/10 text-primary" : "bg-background/65 text-muted-foreground")}>{item}</button>)}</div></CardContent></Card>
        </section>

        <section className="flex flex-col gap-4">
          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-5 w-5 text-primary" /> Development API keys</CardTitle></CardHeader><CardContent className="space-y-3"><Input type="password" value={openaiKey} onChange={(event) => setOpenaiKey(event.target.value)} placeholder="OpenAI API key" /><Input type="password" value={qdrantKey} onChange={(event) => setQdrantKey(event.target.value)} placeholder="Qdrant API key" /><p className="text-xs leading-5 text-muted-foreground">For local development only. Stored keys are masked when returned by the API. Production deployments should use environment variables.</p><div className="flex flex-wrap gap-2">{Object.entries(settings?.dev_api_keys ?? {}).map(([key, value]) => <span key={key} className="rounded-md bg-muted px-2 py-1 text-xs">{key}: {value}</span>)}</div></CardContent></Card>
          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-5 w-5 text-primary" /> Billing</CardTitle></CardHeader><CardContent className="space-y-3"><div className="rounded-lg border bg-background/65 p-4"><p className="text-sm font-semibold capitalize">{subscription?.plan ?? "free"} plan</p><p className="mt-1 text-sm text-muted-foreground">Status: {subscription?.status ?? "inactive"}</p>{subscription?.current_period_end && <p className="mt-1 text-sm text-muted-foreground">Renews: {new Date(subscription.current_period_end).toLocaleDateString()}</p>}</div><div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" onClick={() => void openBillingPortal()} disabled={isBillingLoading || !subscription?.stripe_customer_id}>{isBillingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}Manage billing</Button><Button asChild type="button"><Link href="/pricing">Upgrade plan</Link></Button></div><p className="text-xs leading-5 text-muted-foreground">Paid subscriptions are managed through Stripe Checkout and the Stripe customer portal.</p></CardContent></Card>
          <Card className="bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ArrowDownToLine className="h-5 w-5 text-secondary" /> Data export</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">Download your HumanOS profile, settings, conversations, messages, memories, tasks, goals, documents, agents, and daily plans as JSON.</p><Button type="button" variant="outline" className="mt-4" onClick={() => void exportData()} disabled={isExporting}>{isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}Export data</Button></CardContent></Card>
          <Card className="border-destructive/30 bg-card/70 backdrop-blur-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-5 w-5 text-destructive" /> Delete account</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm leading-6 text-muted-foreground">Deletes the local HumanOS PostgreSQL user and cascades workspace data. Use Clerk profile controls for hosted auth account deletion.</p><Input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder="Type DELETE to confirm" /><Button type="button" variant="outline" onClick={() => void deleteAccount()} disabled={deleteConfirmation !== "DELETE" || isDeleting}>{isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Delete local account</Button></CardContent></Card>
          {(error || status) && <p className={cn("rounded-lg border p-3 text-sm", error ? "border-red-500/30 bg-red-500/10 text-red-500" : "bg-primary/10 text-primary")}>{error || status}</p>}
          <Button disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save settings</Button>
        </section>
      </form>
    </main>
  );
}

function SettingsPreview({ user }: { user: AppUser }) {
  return <main className="min-h-screen bg-background px-4 py-8 text-foreground"><div className="mx-auto max-w-3xl rounded-[1.5rem] border bg-card/70 p-8 shadow-soft backdrop-blur-2xl"><p className="flex items-center gap-2 text-sm font-semibold text-primary"><Settings className="h-4 w-4" /> Settings</p><h1 className="mt-4 text-3xl font-semibold">Welcome, {user.firstName}</h1><p className="mt-3 text-sm leading-7 text-muted-foreground">Connect Clerk to manage HumanOS settings.</p><Button asChild className="mt-6"><Link href="/sign-in">Sign in</Link></Button></div></main>;
}
