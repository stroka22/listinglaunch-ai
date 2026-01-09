import { NextResponse } from "next/server";
import twilio from "twilio";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function escapeXml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twimlMessage(message: string) {
  const body = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/xml",
    },
  });
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();

  const raw = await request.text();
  const params = new URLSearchParams(raw);

  const bodyText = (params.get("Body") || "").trim();
  const from = (params.get("From") || "").trim();

  const origin = new URL(request.url).origin;

  if (!bodyText) {
    return twimlMessage(
      "Thanks for reaching out. Please text the property keyword from the yard sign to get listing details.",
    );
  }

  const normalized = bodyText.toLowerCase();

  try {
    if (normalized === "yes" || normalized === "y") {
      const { data: lastLead, error: leadError } = await supabase
        .from("leads")
        .select("id, listing_id")
        .eq("phone", from)
        .eq("source", "sms")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (leadError || !lastLead) {
        return twimlMessage(
          "We couldn't find a recent property to link this opt-in to. Please text the property keyword again.",
        );
      }

      await supabase
        .from("leads")
        .update({ opted_in: true })
        .eq("id", lastLead.id);

      const { data: listingRow } = await supabase
        .from("listings")
        .select("slug, street, city, state, postal_code")
        .eq("id", lastLead.listing_id)
        .single();

      if (!listingRow) {
        return twimlMessage(
          "You are opted in. We could not load full property details but will notify the agent.",
        );
      }

      const addressLine = `${listingRow.street}, ${listingRow.city}, ${listingRow.state} ${listingRow.postal_code}`;
      const hubUrl = `${origin}/listing/${listingRow.slug}`;

      return twimlMessage(
        `You're opted in for SMS updates on ${addressLine}. View details anytime at ${hubUrl}.`,
      );
    }

    const firstToken = bodyText.split(/\s+/)[0] ?? "";
    const keyword = firstToken.replace(/[^a-z0-9]/gi, "").toUpperCase();

    if (!keyword) {
      return twimlMessage(
        "We could not read a keyword. Please text the property keyword from the yard sign to get listing details.",
      );
    }

    const { data: listingRow, error: listingError } = await supabase
      .from("listings")
      .select("id, slug, street, city, state, postal_code, sms_keyword, branding")
      .eq("sms_keyword", keyword)
      .single();

    if (listingError || !listingRow) {
      return twimlMessage(
        `We couldn't find a property for keyword ${keyword}. Please double-check the code on the sign.`,
      );
    }

    const hubUrl = `${origin}/listing/${listingRow.slug}`;

    await supabase.from("leads").insert({
      listing_id: listingRow.id,
      phone: from,
      source: "sms",
      opted_in: false,
    });

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (accountSid && authToken && fromNumber) {
      const client = twilio(accountSid, authToken);

      const branding = listingRow.branding as any | null;
      const agentPhone: string | undefined = branding?.agent?.phone;
      const lenderPhone: string | undefined = branding?.mortgagePartner?.phone;

      const notifyBody = `New SMS lead ${from} requested details for ${listingRow.street}, ${listingRow.city}.`;

      const tasks = [] as Promise<unknown>[];
      if (agentPhone) {
        tasks.push(
          client.messages.create({
            to: agentPhone,
            from: fromNumber,
            body: notifyBody,
          }),
        );
      }
      if (lenderPhone) {
        tasks.push(
          client.messages.create({
            to: lenderPhone,
            from: fromNumber,
            body: notifyBody,
          }),
        );
      }

      if (tasks.length > 0) {
        void Promise.allSettled(tasks);
      }
    }

    return twimlMessage(
      `Thanks for your interest! View details at ${hubUrl}. Reply YES to opt into text updates about this property.`,
    );
  } catch (err: any) {
    console.error("Twilio SMS webhook error", err);
    return twimlMessage(
      "Something went wrong on our side while processing your request. Please try again later.",
    );
  }
}
