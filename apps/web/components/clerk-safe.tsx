"use client";

import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";
import { UserButton as ClerkUserButton, useAuth as useClerkAuth } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { clerkIsConfigured } from "@/lib/clerk-config";

type SafeAuth = ReturnType<typeof useClerkAuth>;

const fallbackAuth: SafeAuth = {
  actor: null,
  getToken: async () => null,
  has: () => false,
  isLoaded: true,
  isSignedIn: false,
  orgId: null,
  orgRole: null,
  orgSlug: null,
  sessionClaims: null,
  sessionId: null,
  signOut: async () => {
    if (typeof window !== "undefined") window.location.href = "/sign-in";
  },
  userId: null,
} as SafeAuth;

const SafeAuthContext = createContext<SafeAuth>(fallbackAuth);

export function FallbackAuthProvider({ children }: { children: ReactNode }) {
  return <SafeAuthContext.Provider value={fallbackAuth}>{children}</SafeAuthContext.Provider>;
}

export function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const auth = useClerkAuth();
  return <SafeAuthContext.Provider value={auth}>{children}</SafeAuthContext.Provider>;
}

export function useSafeAuth() {
  return useContext(SafeAuthContext);
}

export function SafeUserButton() {
  if (!clerkIsConfigured()) {
    return (
      <Button asChild size="sm">
        <Link href="/sign-in">Login</Link>
      </Button>
    );
  }

  return <ClerkUserButton />;
}
