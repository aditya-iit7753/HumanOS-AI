import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";

import { ClerkAuthBridge, FallbackAuthProvider } from "@/components/clerk-safe";
import { clerkIsConfigured } from "@/lib/clerk-config";

export function AppAuthProvider({ children }: { children: ReactNode }) {
  if (!clerkIsConfigured()) {
    return <FallbackAuthProvider>{children}</FallbackAuthProvider>;
  }

  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" afterSignOutUrl="/">
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}
