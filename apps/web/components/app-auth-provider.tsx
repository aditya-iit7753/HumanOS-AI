import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";

function hasUsableClerkKey() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return Boolean(key && key.startsWith("pk_") && !key.includes("replace_me") && !key.includes("placeholder"));
}

export function AppAuthProvider({ children }: { children: ReactNode }) {
  if (!hasUsableClerkKey()) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  );
}

export function clerkIsConfigured() {
  return hasUsableClerkKey();
}
