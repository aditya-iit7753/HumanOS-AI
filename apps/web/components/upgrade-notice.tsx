import Link from "next/link";
import { ArrowUpRight, CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function extractDetail(message: string) {
  try {
    const parsed = JSON.parse(message) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
  } catch {
    // Keep plain-text backend errors as-is.
  }
  return message;
}

export function isUpgradeError(message: string) {
  const detail = extractDetail(message).toLowerCase();
  return detail.includes("payment required") || detail.includes("upgrade") || detail.includes("plan limit") || detail.includes("requires a higher plan") || detail.includes("requires pro");
}

export function UpgradeNotice({ message, className }: { message: string; className?: string }) {
  const detail = extractDetail(message);
  const upgrade = isUpgradeError(message);

  if (upgrade) {
    return (
      <div className={cn("rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-foreground", className)}>
        <p className="flex items-center gap-2 font-semibold"><CreditCard className="h-4 w-4 text-primary" />Your plan limit is over</p>
        <p className="mt-2 leading-6 text-muted-foreground">{detail || "Upgrade to Starter, Pro, or Premium to continue using this feature."}</p>
        <Button asChild size="sm" className="mt-3"><Link href="/pricing">Upgrade plan <ArrowUpRight className="h-4 w-4" /></Link></Button>
      </div>
    );
  }

  return <p className={cn("rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500", className)}>{detail}</p>;
}