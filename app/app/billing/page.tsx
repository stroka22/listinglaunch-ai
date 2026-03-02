"use client";

import { AppShell } from "@/components/app/AppShell";
import { BillingView } from "@/components/app/BillingView";

export default function BillingPage() {
  return (
    <AppShell>
      {(session) => <BillingView session={session} />}
    </AppShell>
  );
}
