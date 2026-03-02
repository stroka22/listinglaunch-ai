"use client";

import { AppShell } from "@/components/app/AppShell";
import { AgentProfileScreen } from "@/components/profile/AgentProfileScreen";

export default function ProfilePage() {
  return (
    <AppShell>
      {(session) => <AgentProfileScreen session={session} />}
    </AppShell>
  );
}
