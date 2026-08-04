"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SafeUserButton, useSafeAuth } from "@/components/clerk-safe";
import { ArrowRight, CheckCircle2, KeyRound, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ConnectUser = { firstName: string; email: string };
type DeveloperApp = { id: string; name: string; client_id: string; redirect_url: string; description: string; created_at: string };

export function ConnectClient({ user, clerkReady }: { user: ConnectUser; clerkReady: boolean }) {
  const params = useSearchParams();
  const { getToken } = useSafeAuth();
  const clientId = params.get("client_id") ?? "";
  const redirectUrl = params.get("redirect_url") ?? "";
  const state = params.get("state") ?? "";
  const [app, setApp] = useState<DeveloperApp | null>(null);
  const [alreadyConnected, setAlreadyConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(clerkReady);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState("");

  const missingParams = useMemo(() => !clientId || !redirectUrl, [clientId, redirectUrl]);

  useEffect(() => {
    if (!clerkReady || missingParams) return;
    async function loadApp() {
      setIsLoading(true);
      setError("");
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing Clerk session token");
        const response = await fetch(`${API_URL}/connect/app?client_id=${encodeURIComponent(clientId)}&redirect_url=${encodeURIComponent(redirectUrl)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(await response.text());
        const data = (await response.json()) as { app: DeveloperApp; already_connected: boolean };
        setApp(data.app);
        setAlreadyConnected(data.already_connected);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load app connection");
      } finally {
        setIsLoading(false);
      }
    }
    void loadApp();
  }, [clientId, clerkReady, getToken, missingParams, redirectUrl]);

  async function approve() {
    setIsApproving(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing Clerk session token");
      const response = await fetch(`${API_URL}/connect/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, redirect_url: redirectUrl, state }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as { redirect_url: string };
      window.location.href = data.redirect_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to approve app");
      setIsApproving(false);
    }
  }

  if (!clerkReady) {
    return <ConnectShell><ConnectMessage icon={KeyRound} title="Sign in required" text="Connect your HumanOS account after authentication is configured." action={<Button asChild><Link href="/sign-in">Sign in</Link></Button>} /></ConnectShell>;
  }

  if (missingParams) {
    return <ConnectShell><ConnectMessage icon={XCircle} title="Invalid connect link" text="This link is missing client_id or redirect_url." action={<Button asChild variant="outline"><Link href="/dashboard">Back to dashboard</Link></Button>} /></ConnectShell>;
  }

  return (
    <ConnectShell>
      <Card className="mx-auto w-full max-w-xl bg-card/75 shadow-soft backdrop-blur-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Connect HumanOS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading app details</p>}
          {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
          {app && (
            <>
              <div className="rounded-lg border bg-background/65 p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">External app</p>
                <h1 className="mt-2 text-2xl font-semibold">{app.name}</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{app.description || "This app wants to connect to your HumanOS MCP tools."}</p>
              </div>
              <div className="rounded-lg border bg-background/65 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4 text-primary" /> Permissions</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Allow this app to create and read HumanOS MCP tool outputs for {user.email}. You can revoke it later from the API page.</p>
                {alreadyConnected && <p className="mt-2 text-xs text-primary">This app is already connected. Approving again rotates its token.</p>}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button className="flex-1 justify-between" disabled={isApproving} onClick={() => void approve()}>{isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Approve<ArrowRight className="h-4 w-4" /></Button>
                <Button asChild variant="outline" className="flex-1"><Link href="/dashboard">Cancel</Link></Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </ConnectShell>
  );
}

function ConnectShell({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-background px-4 py-6 text-foreground"><div className="mx-auto flex max-w-5xl items-center justify-between"><Link href="/" className="flex items-center gap-2 font-semibold"><KeyRound className="h-5 w-5 text-primary" />HumanOS AI</Link><SafeUserButton /></div><div className="flex min-h-[calc(100vh-7rem)] items-center justify-center py-8">{children}</div></main>;
}

function ConnectMessage({ icon: Icon, title, text, action }: { icon: typeof KeyRound; title: string; text: string; action: ReactNode }) {
  return <Card className="mx-auto w-full max-w-lg bg-card/75 shadow-soft backdrop-blur-2xl"><CardContent className="p-8 text-center"><Icon className="mx-auto h-10 w-10 text-primary" /><h1 className="mt-4 text-2xl font-semibold">{title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p><div className="mt-6">{action}</div></CardContent></Card>;
}
