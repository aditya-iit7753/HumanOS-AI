import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

import { Button } from "@/components/ui/button";

function clerkReady() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return Boolean(key && key.startsWith("pk_") && !key.includes("replace_me") && !key.includes("placeholder"));
}

export default function Page() {
  if (!clerkReady()) {
    return <ClerkSetup title="Login requires Clerk keys" />;
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl items-center gap-8 lg:grid-cols-[.9fr_1.1fr]">
        <div>
          <Link href="/" className="text-sm font-semibold text-primary">HumanOS AI</Link>
          <h1 className="mt-5 text-3xl font-semibold sm:text-5xl">Sign in to your AI operating system.</h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">Access your chat, memory, tasks, goals, career tools, documents, payments, and developer MCP connections.</p>
        </div>
        <div className="rounded-[1.5rem] border bg-card/75 p-4 shadow-soft backdrop-blur-2xl sm:p-6">
          <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/dashboard" />
        </div>
      </section>
    </main>
  );
}

function ClerkSetup({ title }: { title: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="max-w-xl rounded-[1.5rem] border bg-card/70 p-8 text-center shadow-soft backdrop-blur-2xl">
        <p className="text-sm font-semibold text-primary">Clerk setup required</p>
        <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
        <p className="mt-4 text-muted-foreground">Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY, then redeploy the frontend.</p>
        <Button asChild className="mt-6"><Link href="/dashboard">View dashboard preview</Link></Button>
      </section>
    </main>
  );
}
