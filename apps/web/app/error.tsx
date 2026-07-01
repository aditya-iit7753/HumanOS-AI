"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="max-w-lg rounded-[1.25rem] border bg-card/70 p-8 text-center shadow-soft backdrop-blur-2xl animate-rise">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-4 text-2xl font-semibold">Something went sideways.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{error.message || "HumanOS could not render this page. Try again or return to the dashboard."}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={reset}><RefreshCcw className="h-4 w-4" />Try again</Button>
          <Button asChild variant="outline"><Link href="/dashboard">Open dashboard</Link></Button>
        </div>
      </div>
    </main>
  );
}
