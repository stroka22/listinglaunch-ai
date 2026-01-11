import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type {
  AgentProfile,
  Listing,
  ListingAiContent,
  MortgagePartnerProfile,
  PropertyField,
} from "@/lib/types";

async function loadImageForPdf(pdfDoc: PDFDocument, url: string | null) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
    const isPng =
      contentType.includes("png") || url.toLowerCase().endsWith(".png");
    if (isPng) {
      return await pdfDoc.embedPng(bytes);
    }
    return await pdfDoc.embedJpg(bytes);
  } catch {
    return null;
  }
}

function hexToRgbColor(hex: string | null) {
  if (!hex) return null;
  const clean = hex.trim().replace("#", "");
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return rgb(r, g, b);
}

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

  // Co-branded flyer uses a clean black header like the reference example
  const brandColor = rgb(0, 0, 0);
  const agentLogoImage = await loadImageForPdf(pdfDoc, agent.logoUrl);
  const agentHeadshotImage = await loadImageForPdf(pdfDoc, agent.headshotUrl);
  const lenderHeadshotImage = await loadImageForPdf(
    pdfDoc,
    mortgagePartner?.headshotUrl ?? null,
  );

  const photoUrls: string[] = Array.isArray((listing as any).photos)
    ? ((listing as any).photos as string[])
    : [];
  const photoImages = [] as any[];
  for (const url of photoUrls.slice(0, 3)) {
    const img = await loadImageForPdf(pdfDoc, url);
    if (img) photoImages.push(img);
  }

  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const margin = 40;
  let y = height - margin;

  if (agentLogoImage) {
    const maxLogoWidth = 120;
    const maxLogoHeight = 40;
    const logoScale = Math.min(
      maxLogoWidth / agentLogoImage.width,
      maxLogoHeight / agentLogoImage.height,
    );
    const logoWidth = agentLogoImage.width * logoScale;
    const logoHeight = agentLogoImage.height * logoScale;
    const logoX = width - margin - logoWidth;
    const logoY = y - logoHeight + 8;
    page.drawImage(agentLogoImage, {
      x: logoX,
      y: logoY,
      width: logoWidth,
      height: logoHeight,
    });
  }

  page.drawText("OPEN HOUSE", {
    x: margin,
    y: y - 32,
    size: 30,
    font: boldFont,
    color: brandColor,
  });
  y -= 32 + 10; // a bit more breathing room before the address, no underline bar

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
    const dateLines = wrapText(
      input.openHouseDateTime,
      font,
      14,
      width - margin * 2,
    );
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

  if (photoImages.length > 0) {
    const bandHeight = 200; // slightly shorter strip to match reference flyer proportions
    const gap = 8;
    const count = photoImages.length;
    const totalGap = gap * (count - 1);
    const availableWidth = width - margin * 2 - totalGap;
    const cellWidth = availableWidth / count;
    const bandBottom = y - bandHeight;

    photoImages.forEach((img, index) => {
      const scale = Math.min(
        cellWidth / img.width,
        bandHeight / img.height,
      );
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      const cellX = margin + index * (cellWidth + gap);
      const x = cellX + (cellWidth - drawWidth) / 2;
      const yImg = bandBottom + (bandHeight - drawHeight) / 2;

      page.drawImage(img, {
        x,
        y: yImg,
        width: drawWidth,
        height: drawHeight,
      });
    });

    y = bandBottom - 20;
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
    page.drawText("FEATURES", {
      x: margin,
      y,
      size: 12,
      font: boldFont,
    });
    y -= 16;

    for (const item of highlights) {
      const wrapped = wrapText(`• ${item}`, font, 11, width - margin * 2);
      for (const line of wrapped) {
        page.drawText(line, {
          x: margin,
          y,
          size: 11,
          font,
        });
        y -= 14;
      }
    }

    y -= 8;
  }

  y -= 4;
  if (aiContent?.mlsPublicRemarks.standard) {
    // Leave generous white space between remarks and the bottom band,
    // matching the co-branded reference flyer.
    const availableHeight = y - (margin + 160);
    const bodyLines = wrapText(
      aiContent.mlsPublicRemarks.standard,
      font,
      12,
      width - margin * 2,
    );
    let used = 0;
    for (const line of bodyLines) {
      if (used + 16 > availableHeight) {
        break;
      }
      page.drawText(line, {
        x: margin,
        y,
        size: 12,
        font,
      });
      y -= 16;
      used += 16;
    }
  }

  // Agent & lender cards in two columns, QR to the far right
  const footerTextRightLimit = width - margin - (qrBuffer ? 130 : 0);

  const contentWidth = width - margin * 2;
  const columnGap = 28;
  const columnWidth = (contentWidth - columnGap) / 2;

  const leftColX = margin;
  const rightColX = margin + columnWidth + columnGap;

  let cardTopY = y - 80;
  if (cardTopY < margin + 115) {
    cardTopY = margin + 115;
  }

  // Agent (left column)
  let agentTextX = leftColX;
  let agentTextY = cardTopY;

  if (agentHeadshotImage) {
    const targetHeight = 80;
    const scale = targetHeight / agentHeadshotImage.height;
    const imgWidth = agentHeadshotImage.width * scale;
    const imgHeight = targetHeight;
    const imgY = cardTopY - imgHeight + 6;
    page.drawImage(agentHeadshotImage, {
      x: leftColX,
      y: imgY,
      width: imgWidth,
      height: imgHeight,
    });
    agentTextX = leftColX + imgWidth + 10;
    agentTextY = imgY + imgHeight - 10;
  }

  page.drawText("Presented by", {
    x: agentTextX,
    y: agentTextY,
    size: 12,
    font: boldFont,
  });
  agentTextY -= 16;

  const agentLines = [
    `${agent.name} | ${agent.brokerage}`.trim(),
    `Phone: ${agent.phone} | Email: ${agent.email}`,
  ];
  for (const line of agentLines) {
    const wrapped = wrapText(
      line,
      font,
      11,
      leftColX + columnWidth - agentTextX,
    );
    for (const l of wrapped) {
      page.drawText(l, { x: agentTextX, y: agentTextY, size: 11, font });
      agentTextY -= 14;
    }
  }

  // Lender (right column)
  let lenderTextX = rightColX;
  let lenderTextY = cardTopY;

  if (mortgagePartner) {
    if (lenderHeadshotImage) {
      const targetHeight = 70;
      const scale = targetHeight / lenderHeadshotImage.height;
      const imgWidth = lenderHeadshotImage.width * scale;
      const imgHeight = targetHeight;
      const imgY = cardTopY - imgHeight + 6;
      page.drawImage(lenderHeadshotImage, {
        x: rightColX,
        y: imgY,
        width: imgWidth,
        height: imgHeight,
      });
      lenderTextX = rightColX + imgWidth + 10;
      lenderTextY = imgY + imgHeight - 10;
    }

    page.drawText("In partnership with", {
      x: lenderTextX,
      y: lenderTextY,
      size: 12,
      font: boldFont,
    });
    lenderTextY -= 16;

    const lenderLines = [
      `${mortgagePartner.name} | ${mortgagePartner.company}`.trim(),
      `NMLS: ${mortgagePartner.nmlsId}`,
      `Phone: ${mortgagePartner.phone} | Email: ${mortgagePartner.email}`,
    ];
    for (const line of lenderLines) {
      const wrapped = wrapText(
        line,
        font,
        11,
        rightColX + columnWidth - lenderTextX,
      );
      for (const l of wrapped) {
        page.drawText(l, { x: lenderTextX, y: lenderTextY, size: 11, font });
        lenderTextY -= 14;
      }
    }
  }

  if (qrBuffer) {
    const qrImage = await pdfDoc.embedPng(qrBuffer);
    const maxQrSize = 120;
    const qrScale = Math.min(
      maxQrSize / qrImage.width,
      maxQrSize / qrImage.height,
    );
    const qrWidth = qrImage.width * qrScale;
    const qrHeight = qrImage.height * qrScale;
    const qrX = width - margin - qrWidth;
    const qrY = margin + 10;
    page.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrWidth,
      height: qrHeight,
    });

    if (input.qrCodeUrl) {
      page.drawText("Scan to view full listing", {
        x: qrX,
        y: qrY + qrHeight + 8,
        size: 9,
        font: boldFont,
      });
    }
  }

  const disclaimer =
    "For marketing use only. Not affiliated with or approved by Stellar MLS. Data source labels: Public record, agent confirmed, or AI-generated as marked in the full Listing Packet.";
  const disclaimerLines = wrapText(
    disclaimer,
    font,
    7,
    footerTextRightLimit - margin,
  );

  let dy = margin + 8;

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

  if (input.smsKeyword && input.smsPhoneNumber) {
    const smsText = `Text "${input.smsKeyword.toUpperCase()}" to ${input.smsPhoneNumber} for photos, details, and price updates.`;
    const smsLines = wrapText(
      smsText,
      font,
      10,
      footerTextRightLimit - margin,
    );
    let sy = dy + 6;
    for (const line of smsLines) {
      page.drawText(line, {
        x: margin,
        y: sy,
        size: 10,
        font,
      });
      sy += 13;
    }
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
