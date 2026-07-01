import Link from "next/link";
import { UserButton, UserProfile } from "@clerk/nextjs";
import { ArrowLeft, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

function clerkReady() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return Boolean(key && key.startsWith("pk_") && !key.includes("replace_me") && !key.includes("placeholder"));
}

export default function ProfilePage() {
  const isClerkReady = clerkReady();

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex items-center justify-between rounded-lg border bg-card/70 p-3 shadow-soft backdrop-blur-2xl">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></span>
            HumanOS AI
          </Link>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline"><Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Dashboard</Link></Button>
            {isClerkReady ? <UserButton /> : <Button asChild><Link href="/sign-in">Login</Link></Button>}
          </div>
        </header>
        <section className="rounded-[1.5rem] border bg-card/65 p-4 shadow-soft backdrop-blur-2xl sm:p-8">
          {isClerkReady ? (
            <UserProfile routing="path" path="/profile" />
          ) : (
            <div className="mx-auto max-w-2xl py-12 text-center">
              <p className="text-sm font-semibold text-primary">Clerk setup required</p>
              <h1 className="mt-3 text-3xl font-semibold">Add your Clerk keys to enable profiles.</h1>
              <p className="mt-4 text-muted-foreground">Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in apps/web/.env.local.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
