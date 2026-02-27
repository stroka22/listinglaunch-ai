import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ListingLaunch AI",
  description:
    "Generate MLS-ready data, open house flyers, and SMS lead capture for Stellar MLS from a single property intake.",
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-zinc-200 bg-white px-6 py-2 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="sr-only">ListingLaunchAI marketing site</span>
              <Image
                src="/listinglaunchai-logo-nav.svg"
                alt="ListingLaunchAI logo"
                width={480}
                height={120}
                priority
              />
            </Link>
            <div className="flex items-center gap-4">
              <span className="hidden text-xs text-zinc-500 sm:inline">
                MLS-ready launch prep for Stellar MLS agents in Florida
              </span>
              <Link
                href="/app"
                className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                My account
              </Link>
            </div>
          </header>
          <main className="flex-1 bg-zinc-50">{children}</main>
        </div>
      </body>
    </html>
  );
}
