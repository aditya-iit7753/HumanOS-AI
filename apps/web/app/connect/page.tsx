import { currentUser } from "@clerk/nextjs/server";
import { Suspense } from "react";

import { ConnectClient } from "./connect-client";

function clerkReady() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return Boolean(key && key.startsWith("pk_") && !key.includes("replace_me") && !key.includes("placeholder"));
}

export default async function ConnectPage() {
  const isClerkReady = clerkReady();
  const user = isClerkReady ? await currentUser() : null;

  return (
    <Suspense fallback={null}>
      <ConnectClient
        clerkReady={isClerkReady}
        user={{
          firstName: user?.firstName ?? "Builder",
          email: user?.primaryEmailAddress?.emailAddress ?? "humaosai@gmail.com",
        }}
      />
    </Suspense>
  );
}
