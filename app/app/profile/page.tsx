"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { AgentProfileScreen } from "@/components/profile/AgentProfileScreen";

export default function ProfilePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data, error }) => {
      if (!error) {
        setSession(data.session ?? null);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-49px)] items-center justify-center text-sm text-zinc-500">
        Checking your session...
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <AgentProfileScreen session={session} />;
}
