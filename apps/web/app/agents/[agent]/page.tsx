import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";

import { AgentsClient } from "../agents-client";

const agentTypes = new Set(["career", "study", "research", "productivity", "document"]);

function clerkReady() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return Boolean(key && key.startsWith("pk_") && !key.includes("replace_me") && !key.includes("placeholder"));
}

export default async function AgentPage({ params }: { params: Promise<{ agent: string }> }) {
  const { agent } = await params;
  if (!agentTypes.has(agent)) notFound();
  const isClerkReady = clerkReady();
  const user = isClerkReady ? await currentUser() : null;
  return <AgentsClient activeAgentType={agent} clerkReady={isClerkReady} user={{ firstName: user?.firstName ?? "Builder", fullName: user?.fullName ?? "HumanOS User", email: user?.primaryEmailAddress?.emailAddress ?? "humaosai@gmail.com" }} />;
}
