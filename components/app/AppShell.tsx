"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthScreen } from "@/components/auth/AuthScreen";

interface AppShellProps {
  children: (session: Session) => React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data, error }) => {
      if (!error) setSession(data.session ?? null);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-zinc-400">
        Loading…
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  return (
    <div className="min-h-screen bg-zinc-50">
      <AppNav session={session} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        {children(session)}
      </main>
    </div>
  );
}

function AppNav({ session }: { session: Session }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const supabase = getSupabaseBrowserClient();
  const email = session.user.email ?? "";

  const links = [
    { href: "/app", label: "My Listings" },
    { href: "/app/profile", label: "Profile" },
    { href: "/app/billing", label: "Billing" },
  ];

  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";

  return (
    <nav className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <a href="/app" className="text-sm font-semibold tracking-tight text-zinc-900">
            ListingLaunch
          </a>
          <div className="hidden items-center gap-1 sm:flex">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  currentPath === l.href
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-zinc-500 sm:inline">{email}</span>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/app";
            }}
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
          >
            Sign out
          </button>
          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-md p-1 text-zinc-600 hover:bg-zinc-100 sm:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z" />
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-zinc-100 px-4 pb-3 sm:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`block rounded-md px-3 py-2 text-sm ${
                currentPath === l.href
                  ? "font-medium text-zinc-900"
                  : "text-zinc-600"
              }`}
            >
              {l.label}
            </a>
          ))}
          <div className="mt-2 px-3 text-xs text-zinc-500">{email}</div>
        </div>
      )}
    </nav>
  );
}
