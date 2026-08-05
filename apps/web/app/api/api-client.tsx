"use client";

import Link from "next/link";
import { SafeUserButton, useSafeAuth } from "@/components/clerk-safe";
import { useTheme } from "next-themes";
import { Check, ChevronLeft, Code2, Copy, KeyRound, Loader2, Moon, Plus, ShieldCheck, Sun, Terminal, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ApiUser = { firstName: string; fullName: string; email: string };
type HumanOSApiKey = {
  id: string;
  name: string;
  masked_key: string;
  key_prefix: string;
  scopes: string[];
  last_used_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
};

type CreateKeyResponse = { api_key: string; key: HumanOSApiKey };

export function ApiClient({ user, clerkReady }: { user: ApiUser; clerkReady: boolean }) {
  if (!clerkReady) return <ApiPreview user={user} />;
  return <AuthenticatedApiClient user={user} />;
}

function AuthenticatedApiClient({ user }: { user: ApiUser }) {
  const { getToken } = useSafeAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [keys, setKeys] = useState<HumanOSApiKey[]>([]);
  const [name, setName] = useState("My project key");
  const [newKey, setNewKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    void loadKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await getToken();
    if (!token) throw new Error("Missing Clerk session token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  async function loadKeys() {
    setIsLoading(true);
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/api-keys`, { headers });
      if (!response.ok) throw new Error(await response.text());
      setKeys((await response.json()) as HumanOSApiKey[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load API keys");
    } finally {
      setIsLoading(false);
    }
  }

  async function createKey(event: FormEvent) {
    event.preventDefault();
    setIsCreating(true);
    setError("");
    setStatus("");
    setNewKey("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/api-keys`, { method: "POST", headers, body: JSON.stringify({ name }) });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as CreateKeyResponse;
      setNewKey(data.api_key);
      setKeys((current) => [data.key, ...current]);
      setStatus("API key created. Copy it now; it will not be shown again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create API key");
    } finally {
      setIsCreating(false);
    }
  }

  async function copyKey(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function revokeKey(id: string) {
    setRevokingId(id);
    setError("");
    setStatus("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/api-keys/${id}`, { method: "DELETE", headers });
      if (!response.ok) throw new Error(await response.text());
      setKeys((current) => current.map((key) => (key.id === id ? { ...key, revoked_at: new Date().toISOString() } : key)));
      setStatus("API key revoked.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to revoke API key");
    } finally {
      setRevokingId(null);
    }
  }

  const mcpUrl = `${API_URL}/mcp`;
  const sampleKey = newKey || "hos_live_your_api_key";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="sm"><Link href="/dashboard"><ChevronLeft className="h-4 w-4" />Dashboard</Link></Button>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">API</p><p className="text-xs text-muted-foreground">Generate keys and connect HumanOS to your own projects</p></div>
          </div>
          <div className="flex items-center gap-2"><Button variant="outline" size="icon" title="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button><SafeUserButton /></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
        <section className="flex flex-col gap-4">
          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-5 w-5 text-primary" /> Create API key</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={createKey} className="space-y-3">
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Key name" />
                <Button disabled={isCreating} className="w-full justify-between">
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Generate key
                </Button>
              </form>
              {newKey && (
                <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-4">
                  <p className="text-sm font-semibold text-primary">Copy this key now</p>
                  <div className="mt-3 flex gap-2">
                    <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-background px-3 py-2 text-xs">{newKey}</code>
                    <Button type="button" variant="outline" size="icon" title="Copy API key" onClick={() => void copyKey(newKey)}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-5 w-5 text-secondary" /> Your keys</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading keys</p>}
              {!isLoading && !keys.length && <p className="rounded-lg border bg-background/65 p-4 text-sm text-muted-foreground">No API keys yet. Generate one to connect HumanOS from your app.</p>}
              {keys.map((key) => (
                <div key={key.id} className={cn("rounded-lg border bg-background/65 p-4", key.revoked_at && "opacity-60")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{key.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{key.masked_key} · {key.revoked_at ? "Revoked" : "Active"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Last used: {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "Never"}</p>
                    </div>
                    {!key.revoked_at && <Button variant="outline" size="icon" title="Revoke key" disabled={revokingId === key.id} onClick={() => void revokeKey(key.id)}>{revokingId === key.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          {(error || status) && <p className={cn("rounded-lg border p-3 text-sm", error ? "border-red-500/30 bg-red-500/10 text-red-500" : "bg-primary/10 text-primary")}>{error || status}</p>}
        </section>

        <section className="flex flex-col gap-4">
          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Code2 className="h-5 w-5 text-primary" /> MCP connection</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-background/65 p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Endpoint</p>
                <code className="mt-2 block overflow-x-auto text-sm">POST {mcpUrl}</code>
              </div>
              <CodeBlock value={`fetch("${mcpUrl}", {\n  method: "POST",\n  headers: {\n    "Content-Type": "application/json",\n    "x-mcp-api-key": "${sampleKey}"\n  },\n  body: JSON.stringify({\n    jsonrpc: "2.0",\n    id: 1,\n    method: "tools/list",\n    params: {}\n  })\n})`} />
            </CardContent>
          </Card>

          <Card className="bg-card/70 backdrop-blur-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Terminal className="h-5 w-5 text-secondary" /> Create a task from your app</CardTitle></CardHeader>
            <CardContent>
              <CodeBlock value={`fetch("${mcpUrl}", {\n  method: "POST",\n  headers: {\n    "Content-Type": "application/json",\n    "Authorization": "Bearer ${sampleKey}"\n  },\n  body: JSON.stringify({\n    jsonrpc: "2.0",\n    id: 2,\n    method: "tools/call",\n    params: {\n      name: "humanos_create_task",\n      arguments: {\n        title: "Prepare launch plan",\n        priority: "high"\n      }\n    }\n  })\n})`} />
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Keys created by {user.email} operate only on this HumanOS account. The raw key is stored as a hash and shown once.</p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function CodeBlock({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return (
    <div className="relative overflow-hidden rounded-lg border bg-foreground text-background">
      <Button type="button" variant="outline" size="icon" title="Copy code" className="absolute right-3 top-3 h-8 w-8 bg-background text-foreground" onClick={() => void copy()}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
      <pre className="overflow-x-auto p-4 pr-14 text-xs leading-6"><code>{value}</code></pre>
    </div>
  );
}

function ApiPreview({ user }: { user: ApiUser }) {
  return <main className="min-h-screen bg-background px-4 py-8 text-foreground"><div className="mx-auto max-w-3xl rounded-[1.5rem] border bg-card/70 p-8 shadow-soft backdrop-blur-2xl"><p className="flex items-center gap-2 text-sm font-semibold text-primary"><KeyRound className="h-4 w-4" /> API</p><h1 className="mt-4 text-3xl font-semibold">Connect HumanOS, {user.firstName}.</h1><p className="mt-3 text-sm leading-7 text-muted-foreground">Sign in to generate your own HumanOS API key and connect external projects.</p><Button asChild className="mt-6"><Link href="/sign-in">Sign in</Link></Button></div></main>;
}
