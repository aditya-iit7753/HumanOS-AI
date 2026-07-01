"use client";

import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const CLERK_READY = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("replace_me") &&
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("placeholder"),
);

export function AuthSync() {
  if (!CLERK_READY) return null;
  return <AuthSyncInner />;
}

function AuthSyncInner() {
  const { getToken, isSignedIn } = useAuth();
  const { user, isLoaded } = useUser();
  const syncedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || syncedUserId.current === user.id) return;

    async function syncProfile() {
      const token = await getToken();
      if (!token) return;

      const primaryEmail = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
      try {
        const response = await fetch(`${API_URL}/auth/clerk/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            clerk_user_id: user?.id,
            email: primaryEmail,
            full_name: user?.fullName ?? user?.username ?? primaryEmail ?? "HumanOS User",
            image_url: user?.imageUrl,
          }),
        });
        if (response.ok) syncedUserId.current = user?.id ?? null;
      } catch {
        syncedUserId.current = null;
      }
    }

    void syncProfile();
  }, [getToken, isLoaded, isSignedIn, user]);

  return null;
}
