import { currentUser } from "@clerk/nextjs/server";

import { MemoryGraphClient } from "./memory-graph-client";

function clerkReady() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return Boolean(key && key.startsWith("pk_") && !key.includes("replace_me") && !key.includes("placeholder"));
}

export default async function MemoryGraphPage() {
  const isClerkReady = clerkReady();
  const user = isClerkReady ? await currentUser() : null;

  return (
    <MemoryGraphClient
      clerkReady={isClerkReady}
      user={{
        firstName: user?.firstName ?? "Builder",
        fullName: user?.fullName ?? "HumanOS User",
        email: user?.primaryEmailAddress?.emailAddress ?? "workspace@humanos.ai",
      }}
    />
  );
}
