import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

import { Button } from "@/components/ui/button";

function clerkReady() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return Boolean(key && key.startsWith("pk_") && !key.includes("replace_me") && !key.includes("placeholder"));
}

export default function Page() {
  if (!clerkReady()) {
    return <ClerkSetup title="Signup requires Clerk keys" />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/dashboard" />
    </main>
  );
}

function ClerkSetup({ title }: { title: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="max-w-xl rounded-[1.5rem] border bg-card/70 p-8 text-center shadow-soft backdrop-blur-2xl">
        <p className="text-sm font-semibold text-primary">Clerk setup required</p>
        <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
        <p className="mt-4 text-muted-foreground">Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to apps/web/.env.local, then restart the dev server.</p>
        <Button asChild className="mt-6"><Link href="/dashboard">View dashboard preview</Link></Button>
      </section>
    </main>
  );
}
