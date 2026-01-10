import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2024-06-20" as any,
    })
  : null;

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured on the server." },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as
      | {
          packageId?: string;
          agentId?: string;
        }
      | null;

    const packageId = body?.packageId;
    const agentId = body?.agentId;

    if (!packageId || !agentId) {
      return NextResponse.json(
        { error: "packageId and agentId are required" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: pkg, error: pkgError } = await supabase
      .from("credit_packages")
      .select("id, slug, name, credits, price_cents, stripe_price_id, active")
      .eq("id", packageId)
      .single();

    if (pkgError || !pkg) {
      return NextResponse.json(
        { error: pkgError?.message || "Package not found" },
        { status: 404 },
      );
    }

    if (!pkg.active) {
      return NextResponse.json(
        { error: "Package is not active" },
        { status: 400 },
      );
    }

    if (!pkg.stripe_price_id) {
      return NextResponse.json(
        {
          error:
            "This credit package is missing a Stripe price id. Configure stripe_price_id in credit_packages.",
        },
        { status: 500 },
      );
    }

    const origin =
      request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL;

    if (!origin) {
      return NextResponse.json(
        { error: "Could not determine application URL for redirect" },
        { status: 500 },
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: pkg.stripe_price_id,
          quantity: 1,
        },
      ],
      success_url: `${origin}/app?checkout=success`,
      cancel_url: `${origin}/app?checkout=cancel`,
      client_reference_id: agentId,
      metadata: {
        agent_id: agentId,
        package_id: pkg.id,
        package_slug: pkg.slug,
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("create-checkout-session error", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
