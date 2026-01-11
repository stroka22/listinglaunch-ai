import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type {
  AgentProfile,
  Listing,
  ListingAiContent,
  MortgagePartnerProfile,
  PropertyField,
} from "@/lib/types";

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

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const testLine = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = testLine;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
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
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const margin = 40;
  let y = height - margin;

  page.drawText("Stellar MLS Listing Packet", {
    x: margin,
    y: y - 24,
    size: 20,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  y -= 24 + 16;

  page.drawText(`Property: ${addressLine}`, {
    x: margin,
    y,
    size: 12,
    font,
  });
  y -= 16;
  page.drawText(`Listing status: ${listing.status}`, {
    x: margin,
    y,
    size: 12,
    font,
  });
  y -= 24;

  page.drawText("Core Property Data", {
    x: margin,
    y,
    size: 14,
    font: boldFont,
  });
  y -= 18;

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

  const maxWidth = width - margin * 2;
  for (const line of lines) {
    const wrapped = wrapText(line, font, 10, maxWidth);
    for (const l of wrapped) {
      page.drawText(l, { x: margin, y, size: 10, font });
      y -= 14;
    }
  }

  y -= 10;

  const missing = collectMissingOrLowConfidenceFields(listing);
  if (missing.length > 0) {
    page.drawText("Missing or Low-Confidence Fields", {
      x: margin,
      y,
      size: 14,
      font: boldFont,
    });
    y -= 18;
    for (const m of missing) {
      const wrapped = wrapText(`• ${m}`, font, 10, maxWidth);
      for (const l of wrapped) {
        page.drawText(l, { x: margin, y, size: 10, font });
        y -= 14;
      }
    }
  }

  if (aiContent) {
    const remarksPage = pdfDoc.addPage();
    const { width: rw, height: rh } = remarksPage.getSize();
    let ry = rh - margin;

    remarksPage.drawText("MLS Public Remarks", {
      x: margin,
      y: ry - 24,
      size: 16,
      font: boldFont,
    });
    ry -= 24 + 12;

    const sections: Array<[string, string | null]> = [
      ["Standard", aiContent.mlsPublicRemarks.standard ?? "—"],
      ["Lifestyle", aiContent.mlsPublicRemarks.lifestyle ?? "—"],
      ["Investor", aiContent.mlsPublicRemarks.investor ?? "—"],
    ];

    for (const [label, text] of sections) {
      remarksPage.drawText(`${label}:`, {
        x: margin,
        y: ry,
        size: 12,
        font: boldFont,
      });
      ry -= 16;
      const wrapped = wrapText(text || "—", font, 10, rw - margin * 2);
      for (const l of wrapped) {
        remarksPage.drawText(l, { x: margin, y: ry, size: 10, font });
        ry -= 14;
      }
      ry -= 10;
    }

    const bulletsPage = pdfDoc.addPage();
    const { width: bw, height: bh } = bulletsPage.getSize();
    let by = bh - margin;

    bulletsPage.drawText("Feature Bullets", {
      x: margin,
      y: by - 24,
      size: 16,
      font: boldFont,
    });
    by -= 24 + 12;

    const bulletSections: Array<[string, string[]]> = [
      ["Interior", aiContent.featureBulletsInterior],
      ["Exterior", aiContent.featureBulletsExterior],
      ["Community", aiContent.featureBulletsCommunity],
    ];

    for (const [label, items] of bulletSections) {
      bulletsPage.drawText(`${label}:`, {
        x: margin,
        y: by,
        size: 12,
        font: boldFont,
      });
      by -= 16;

      if (items.length === 0) {
        bulletsPage.drawText("—", {
          x: margin,
          y: by,
          size: 10,
          font,
        });
        by -= 14;
      } else {
        for (const item of items) {
          const wrapped = wrapText(`• ${item}`, font, 10, bw - margin * 2);
          for (const l of wrapped) {
            bulletsPage.drawText(l, { x: margin, y: by, size: 10, font });
            by -= 14;
          }
        }
      }

      by -= 10;
    }
  }

  const brandingPage = pdfDoc.addPage();
  const { height: brh } = brandingPage.getSize();
  let bry = brh - margin;

  brandingPage.drawText("Branding", {
    x: margin,
    y: bry - 24,
    size: 16,
    font: boldFont,
  });
  bry -= 24 + 16;

  brandingPage.drawText("Agent", {
    x: margin,
    y: bry,
    size: 12,
    font: boldFont,
  });
  bry -= 16;

  const agentLines = [
    `${agent.name} | ${agent.brokerage}`.trim(),
    `Phone: ${agent.phone} | Email: ${agent.email}`,
    agent.primaryColor
      ? `Brand colors: ${agent.primaryColor}${agent.secondaryColor ? `, ${agent.secondaryColor}` : ""}`
      : "",
  ].filter(Boolean);

  for (const line of agentLines) {
    const wrapped = wrapText(line, font, 10, width - margin * 2);
    for (const l of wrapped) {
      brandingPage.drawText(l, { x: margin, y: bry, size: 10, font });
      bry -= 14;
    }
  }

  if (mortgagePartner) {
    bry -= 16;
    brandingPage.drawText("Mortgage Partner (Marketing Only)", {
      x: margin,
      y: bry,
      size: 12,
      font: boldFont,
    });
    bry -= 16;

    const lenderLines = [
      `${mortgagePartner.name} | ${mortgagePartner.company}`.trim(),
      `NMLS: ${mortgagePartner.nmlsId}`,
      `Phone: ${mortgagePartner.phone} | Email: ${mortgagePartner.email}`,
    ];

    for (const line of lenderLines) {
      const wrapped = wrapText(line, font, 10, width - margin * 2);
      for (const l of wrapped) {
        brandingPage.drawText(l, { x: margin, y: bry, size: 10, font });
        bry -= 14;
      }
    }
  }

  bry -= 20;
  const disclaimer =
    "Sources: Public record data via Estated/ATTOM; agent-confirmed fields as marked; AI-generated text via OpenAI. Data is provided for MLS entry support only—do not treat as a direct MLS feed.";
  const disclaimerLines = wrapText(disclaimer, font, 8, width - margin * 2);
  for (const line of disclaimerLines) {
    brandingPage.drawText(line, {
      x: margin,
      y: bry,
      size: 8,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });
    bry -= 10;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
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
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const margin = 40;
  let y = height - margin;

  page.drawText("Open House", {
    x: margin,
    y: y - 30,
    size: 26,
    font: boldFont,
  });
  y -= 30 + 16;

  const addressLines = wrapText(addressLine, boldFont, 18, width - margin * 2);
  for (const line of addressLines) {
    page.drawText(line, {
      x: margin,
      y,
      size: 18,
      font: boldFont,
    });
    y -= 22;
  }

  if (input.openHouseDateTime) {
    const dateLines = wrapText(input.openHouseDateTime, font, 14, width - margin * 2);
    for (const line of dateLines) {
      page.drawText(line, {
        x: margin,
        y,
        size: 14,
        font,
      });
      y -= 18;
    }
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
    const highlightText = highlights.join("  •  ");
    const highlightLines = wrapText(highlightText, font, 12, width - margin * 2);
    for (const line of highlightLines) {
      page.drawText(line, {
        x: margin,
        y,
        size: 12,
        font,
      });
      y -= 16;
    }
  }

  y -= 12;
  if (aiContent?.mlsPublicRemarks.standard) {
    const bodyLines = wrapText(aiContent.mlsPublicRemarks.standard, font, 12, width - margin * 2);
    for (const line of bodyLines) {
      page.drawText(line, {
        x: margin,
        y,
        size: 12,
        font,
      });
      y -= 16;
    }
  }

  y -= 18;
  page.drawText("Presented by:", {
    x: margin,
    y,
    size: 12,
    font: boldFont,
  });
  y -= 16;

  const agentLines = [
    `${agent.name} | ${agent.brokerage}`.trim(),
    `Phone: ${agent.phone} | Email: ${agent.email}`,
  ];
  for (const line of agentLines) {
    const wrapped = wrapText(line, font, 11, width - margin * 2);
    for (const l of wrapped) {
      page.drawText(l, { x: margin, y, size: 11, font });
      y -= 14;
    }
  }

  if (mortgagePartner) {
    y -= 18;
    page.drawText("In partnership with:", {
      x: margin,
      y,
      size: 12,
      font: boldFont,
    });
    y -= 16;

    const lenderLines = [
      `${mortgagePartner.name} | ${mortgagePartner.company}`.trim(),
      `NMLS: ${mortgagePartner.nmlsId}`,
      `Phone: ${mortgagePartner.phone} | Email: ${mortgagePartner.email}`,
    ];
    for (const line of lenderLines) {
      const wrapped = wrapText(line, font, 11, width - margin * 2);
      for (const l of wrapped) {
        page.drawText(l, { x: margin, y, size: 11, font });
        y -= 14;
      }
    }
  }

  if (qrBuffer) {
    const qrImage = await pdfDoc.embedPng(qrBuffer);
    const qrDim = qrImage.scale(0.6);
    const qrX = margin;
    const qrY = margin;
    page.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrDim.width,
      height: qrDim.height,
    });

    if (input.qrCodeUrl) {
      page.drawText(`Property hub: ${input.qrCodeUrl}`, {
        x: qrX,
        y: qrY - 12,
        size: 9,
        font,
      });
    }
  }

  if (input.smsKeyword && input.smsPhoneNumber) {
    page.drawText(
      `Text "${input.smsKeyword.toUpperCase()}" to ${input.smsPhoneNumber} for photos, details, and price updates.`,
      {
        x: margin,
        y: margin,
        size: 12,
        font,
      },
    );
  }

  const disclaimer =
    "For marketing use only. Not affiliated with or approved by Stellar MLS. Data source labels: Public record, agent confirmed, or AI-generated as marked in the full Listing Packet.";
  const disclaimerLines = wrapText(disclaimer, font, 7, width - margin * 2);
  let dy = margin + 24;
  for (const line of disclaimerLines) {
    page.drawText(line, {
      x: margin,
      y: dy,
      size: 7,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });
    dy += 9;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
