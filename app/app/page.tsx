"use client";

import { AppShell } from "@/components/app/AppShell";
import { DashboardView } from "@/components/app/DashboardView";

export default function AppHome() {
  return (
    <AppShell>
      {(session) => <DashboardView session={session} />}
    </AppShell>
  );
}
