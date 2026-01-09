import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { AgentProfile, Listing, ListingAiContent, MortgagePartnerProfile, PropertyField } from "@/lib/types";

function fieldDisplay<T>(label: string, field: PropertyField<T>) {
  const value = field.value == null || field.value === "" ? "—" : String(field.value);
  const source =
    field.source === "public_record"
      ? "Public record"
      : field.source === "agent_confirmed"
        ? "Agent confirmed"
        : "AI-generated";
  const confidence =
    typeof field.confidence === "number" ? ` (confidence: ${(field.confidence * 100).toFixed(0)}%)` : "";
  const confirmed = field.confirmedByAgent ? " ✓" : "";

  return `${label}: ${value} [${source}${confidence}]${confirmed}`;
}

function collectMissingOrLowConfidenceFields(listing: Listing) {
  const out: string[] = [];

  const entries: Array<[string, PropertyField<unknown>]> = [
    ["Beds", listing.property.beds],
    ["Baths", listing.property.baths],
    ["Square Feet", listing.property.squareFeet],
    ["Lot Size Sq Ft", listing.property.lotSizeSqFt],
    ["Year Built", listing.property.yearBuilt],
    ["Property Type", listing.property.propertyType],
    ["Parcel ID", listing.property.parcelId],
    ["Annual Taxes", listing.property.annualTaxes],
  ];

  for (const [label, field] of entries) {
    const missing = field.value == null || field.value === "";
    const lowConfidence = typeof field.confidence === "number" && field.confidence < 0.7;
    if (missing || lowConfidence) {
      out.push(
        `${label} - ${missing ? "missing" : "low confidence"} (source: ${field.source}, confirmed: ${field.confirmedByAgent ? "yes" : "no"})`,
      );
    }
  }

  return out;
}

async function renderPdf(build: (doc: any) => void): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 40 });
  const chunks: Buffer[] = [];

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => {
      chunks.push(chunk as Buffer);
    });
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", (err) => reject(err));

    build(doc);
    doc.end();
  });
}

export interface ListingPacketPdfInput {
  listing: Listing;
  aiContent: ListingAiContent | null;
  agent: AgentProfile;
  mortgagePartner: MortgagePartnerProfile | null;
}

export async function generateListingPacketPdf(
  input: ListingPacketPdfInput,
): Promise<Buffer> {
  const { listing, aiContent, agent, mortgagePartner } = input;
  const addressLine = `${listing.street}, ${listing.city}, ${listing.state} ${listing.postalCode}`;

  return renderPdf((doc) => {
    doc.fontSize(20).text("Stellar MLS Listing Packet", { align: "center" });
    doc.moveDown();

    doc.fontSize(12).text(`Property: ${addressLine}`);
    doc.text(`Listing status: ${listing.status}`);
    doc.moveDown();

    doc.fontSize(14).text("Core Property Data", { underline: true });
    doc.moveDown(0.5);

    const fields = listing.property;
    const lines = [
      fieldDisplay("Beds", fields.beds),
      fieldDisplay("Baths", fields.baths),
      fieldDisplay("Square Feet", fields.squareFeet),
      fieldDisplay("Lot Size (sq ft)", fields.lotSizeSqFt),
      fieldDisplay("Year Built", fields.yearBuilt),
      fieldDisplay("Property Type", fields.propertyType),
      fieldDisplay("Parcel ID", fields.parcelId),
      fieldDisplay("Annual Taxes", fields.annualTaxes),
    ];

    for (const line of lines) {
      doc.fontSize(10).text(line);
    }

    doc.moveDown();

    const missing = collectMissingOrLowConfidenceFields(listing);
    if (missing.length > 0) {
      doc.fontSize(14).text("Missing or Low-Confidence Fields", { underline: true });
      doc.moveDown(0.5);
      missing.forEach((m) => doc.fontSize(10).text(`• ${m}`));
      doc.moveDown();
    }

    if (aiContent) {
      doc.addPage();
      doc.fontSize(16).text("MLS Public Remarks", { underline: true });
      doc.moveDown();

      doc.fontSize(12).text("Standard:");
      doc.fontSize(10).text(aiContent.mlsPublicRemarks.standard ?? "—");
      doc.moveDown();

      doc.fontSize(12).text("Lifestyle:");
      doc.fontSize(10).text(aiContent.mlsPublicRemarks.lifestyle ?? "—");
      doc.moveDown();

      doc.fontSize(12).text("Investor:");
      doc.fontSize(10).text(aiContent.mlsPublicRemarks.investor ?? "—");
      doc.moveDown();

      doc.addPage();
      doc.fontSize(16).text("Feature Bullets", { underline: true });
      doc.moveDown();

      const sections: Array<[string, string[]]> = [
        ["Interior", aiContent.featureBulletsInterior],
        ["Exterior", aiContent.featureBulletsExterior],
        ["Community", aiContent.featureBulletsCommunity],
      ];

      for (const [label, items] of sections) {
        doc.fontSize(12).text(label + ":");
        if (items.length === 0) {
          doc.fontSize(10).text("—");
        } else {
          items.forEach((item) => doc.fontSize(10).text(`• ${item}`));
        }
        doc.moveDown();
      }
    }

    doc.addPage();
    doc.fontSize(16).text("Branding", { underline: true });
    doc.moveDown();

    doc.fontSize(12).text("Agent");
    doc.fontSize(10).text(`${agent.name} | ${agent.brokerage}`);
    doc.fontSize(10).text(`Phone: ${agent.phone} | Email: ${agent.email}`);
    if (agent.primaryColor) {
      doc.fontSize(10).text(`Brand colors: ${agent.primaryColor}${agent.secondaryColor ? `, ${agent.secondaryColor}` : ""}`);
    }

    if (mortgagePartner) {
      doc.moveDown();
      doc.fontSize(12).text("Mortgage Partner (Marketing Only)");
      doc.fontSize(10).text(`${mortgagePartner.name} | ${mortgagePartner.company}`);
      doc.fontSize(10).text(`NMLS: ${mortgagePartner.nmlsId}`);
      doc.fontSize(10).text(`Phone: ${mortgagePartner.phone} | Email: ${mortgagePartner.email}`);
    }

    doc.moveDown(2);
    doc.fontSize(8).text(
      "Sources: Public record data via Estated Property API v4; agent-confirmed fields as marked; AI-generated text via OpenAI. Data is provided for MLS entry support only—do not treat as a direct MLS feed.",
      { align: "left" },
    );
  });
}

export interface OpenHouseFlyerPdfInput {
  listing: Listing;
  aiContent: ListingAiContent | null;
  agent: AgentProfile;
  mortgagePartner: MortgagePartnerProfile | null;
  openHouseDateTime: string | null;
  qrCodeUrl: string | null;
  smsKeyword: string | null;
  smsPhoneNumber: string | null;
}

export async function generateOpenHouseFlyerPdf(
  input: OpenHouseFlyerPdfInput,
): Promise<Buffer> {
  const { listing, aiContent, agent, mortgagePartner } = input;
  const addressLine = `${listing.street}, ${listing.city}, ${listing.state} ${listing.postalCode}`;
  const qrBuffer = input.qrCodeUrl
    ? await QRCode.toBuffer(input.qrCodeUrl, { width: 240 })
    : null;

  return renderPdf((doc) => {
    doc.fontSize(26).text("Open House", { align: "center" });
    doc.moveDown();

    doc.fontSize(18).text(addressLine, { align: "center" });
    doc.moveDown();

    if (input.openHouseDateTime) {
      doc.fontSize(14).text(input.openHouseDateTime, { align: "center" });
      doc.moveDown();
    }

    const p = listing.property;
    const highlights = [
      p.beds.value && `${p.beds.value} beds`,
      p.baths.value && `${p.baths.value} baths`,
      p.squareFeet.value && `${p.squareFeet.value} sq ft`,
      p.lotSizeSqFt.value && `${p.lotSizeSqFt.value} sq ft lot`,
      p.yearBuilt.value && `Built ${p.yearBuilt.value}`,
    ].filter(Boolean) as string[];

    if (highlights.length) {
      doc.fontSize(12).text(highlights.join("  •  "), { align: "center" });
      doc.moveDown();
    }

    if (aiContent?.mlsPublicRemarks.standard) {
      doc.fontSize(12).text(aiContent.mlsPublicRemarks.standard, {
        align: "left",
      });
      doc.moveDown();
    }

    doc.fontSize(12).text("Presented by:");
    doc.fontSize(11).text(`${agent.name} | ${agent.brokerage}`);
    doc.fontSize(11).text(`Phone: ${agent.phone} | Email: ${agent.email}`);
    doc.moveDown();

    if (mortgagePartner) {
      doc.fontSize(12).text("In partnership with:");
      doc.fontSize(11).text(`${mortgagePartner.name} | ${mortgagePartner.company}`);
      doc.fontSize(11).text(`NMLS: ${mortgagePartner.nmlsId}`);
      doc.fontSize(11).text(`Phone: ${mortgagePartner.phone} | Email: ${mortgagePartner.email}`);
      doc.moveDown();
    }

    if (qrBuffer) {
      doc.moveDown();
      const x = doc.page.margins.left;
      const y = doc.y;
      doc.image(qrBuffer, x, y, { fit: [140, 140] });
      doc.moveDown(8);
      if (input.qrCodeUrl) {
        doc.fontSize(9).text(`Property hub: ${input.qrCodeUrl}`);
      }
    }

    if (input.smsKeyword && input.smsPhoneNumber) {
      doc.moveDown();
      doc.fontSize(12).text(
        `Text "${input.smsKeyword.toUpperCase()}" to ${input.smsPhoneNumber} for photos, details, and price updates.`,
      );
    }

    doc.moveDown(2);
    doc.fontSize(7).text(
      "For marketing use only. Not affiliated with or approved by Stellar MLS. Data source labels: Public record, agent confirmed, or AI-generated as marked in the full Listing Packet.",
    );
  });
}
