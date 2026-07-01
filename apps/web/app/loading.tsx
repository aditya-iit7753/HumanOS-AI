import { Loader2, Sparkles } from "lucide-react";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="rounded-[1.25rem] border bg-card/70 p-8 text-center shadow-soft backdrop-blur-2xl animate-rise">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-6 w-6" />
        </span>
        <p className="mt-5 text-lg font-semibold">Loading HumanOS AI</p>
        <p className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Preparing your workspace
        </p>
      </div>
    </main>
  );
}
