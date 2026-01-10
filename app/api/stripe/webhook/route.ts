import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2024-06-20" as any,
    })
  : null;

export async function POST(request: NextRequest) {
  if (!stripe || !webhookSecret) {
    return new NextResponse("Stripe webhook not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing Stripe signature", { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error("Stripe webhook signature verification failed", err?.message);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const agentId =
        (session.metadata?.agent_id as string | undefined) ||
        (session.client_reference_id as string | undefined);
      const packageId = session.metadata?.package_id as string | undefined;

      if (!agentId || !packageId) {
        return new NextResponse("Missing metadata", { status: 200 });
      }

      const supabase = getSupabaseServerClient();

      const { data: existingOrders } = await supabase
        .from("credit_orders")
        .select("id")
        .eq("stripe_session_id", session.id)
        .limit(1);

      if (existingOrders && existingOrders.length > 0) {
        return new NextResponse("Already processed", { status: 200 });
      }

      const { data: pkg, error: pkgError } = await supabase
        .from("credit_packages")
        .select("id, credits, price_cents")
        .eq("id", packageId)
        .single();

      if (pkgError || !pkg) {
        console.error("Package not found for webhook", pkgError?.message);
        return new NextResponse("Package not found", { status: 200 });
      }

      const { error: orderError } = await supabase.from("credit_orders").insert({
        agent_id: agentId,
        package_id: pkg.id,
        credits: pkg.credits,
        price_cents: pkg.price_cents,
        status: "paid",
        stripe_session_id: session.id,
        stripe_payment_intent_id:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
      });

      if (orderError) {
        console.error("Error inserting credit_order", orderError.message);
      }

      const { error: ledgerError } = await supabase
        .from("agent_credit_ledger")
        .insert({
          agent_id: agentId,
          delta: pkg.credits,
          reason: "purchase",
          listing_id: null,
          metadata: {
            stripe_session_id: session.id,
            package_id: pkg.id,
          },
        });

      if (ledgerError) {
        console.error("Error inserting agent_credit_ledger", ledgerError.message);
      }
    }

    return new NextResponse("ok", { status: 200 });
  } catch (err: any) {
    console.error("Stripe webhook handler error", err?.message);
    return new NextResponse("Webhook handler error", { status: 500 });
  }
}
