import { PropertySnapshot, PropertyField } from "@/lib/types";

export interface EstatedLookupInput {
  street: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface EstatedLookupResult {
  snapshot: PropertySnapshot;
  raw: unknown;
  warnings: string[];
}

function makeField<T>(value: T | null): PropertyField<T> {
  return {
    value,
    source: "public_record",
    confidence: value == null ? null : 0.9,
    confirmedByAgent: false,
  };
}

/**
 * NOTE: This helper now uses ATTOM's Property API (basicprofile) under the hood.
 * The existing ESTATED_API_TOKEN env var is treated as your ATTOM apikey
 * to avoid extra configuration changes.
 */
export async function lookupPropertyFromEstated(
  input: EstatedLookupInput,
): Promise<EstatedLookupResult> {
  const apiKey = process.env.ESTATED_API_TOKEN;

  if (!apiKey) {
    throw new Error(
      "ESTATED_API_TOKEN (used as ATTOM apikey) is not configured. Add it to your environment before calling this function.",
    );
  }

  const params = new URLSearchParams({
    address1: input.street,
    // ATTOM docs treat address2 as the "second line"; the common pattern is "City, ST".
    // ZIP is typically inferred; including it here can sometimes cause no matches.
    address2: `${input.city}, ${input.state}`,
  });

  const url = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile?${params.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: apiKey,
      accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "ATTOM Property API unauthorized. Check that your API key is correct and has access to the Property API.",
      );
    }
    throw new Error(
      `ATTOM Property API error: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
    );
  }

  const json = (await res.json()) as any;

  const list = Array.isArray(json.property) ? json.property : [];
  if (!list.length) {
    throw new Error("ATTOM did not return any property records for this address.");
  }

  const property = list[0] ?? {};
  const summary = property.summary ?? {};
  const building = property.building ?? {};
  const rooms = building.rooms ?? {};
  const size = building.size ?? building.area ?? {};
  const lot = property.lot ?? {};
  const assessment = property.assessment ?? {};
  const assessmentTax = assessment.tax ?? {};
  const tax = property.tax ?? {};
  const identifier = property.identifier ?? {};

  // ATTOM basicprofile example uses camelCase keys such as yearBuilt, lotSize2, taxAmt, bathsTotal, universalSize.
  const beds = (summary.beds ?? rooms.beds) ?? null; // may legitimately be missing in basicprofile
  const baths = (summary.bathsTotal ?? rooms.bathsTotal) ?? null;
  const squareFeet =
    (size.universalSize ?? size.livingSize ?? size.grossSize ?? size.bldgSize) ?? null;
  const lotSizeSqFt = (lot.lotSize2 ?? lot.lotSize1) ?? null;
  const yearBuilt = (summary.yearBuilt ?? building.yearBuilt) ?? null;
  const propertyType = (summary.propertyType ?? summary.propType ?? summary.propClass) ?? null;
  const parcelId = (identifier.apn ?? lot.apn) ?? null;
  const annualTaxes =
    (assessmentTax.taxAmt ?? tax.taxAmt ?? assessmentTax.taxAmount ?? tax.taxAmount) ?? null;

  const snapshot: PropertySnapshot = {
    beds: makeField(beds),
    baths: makeField(baths),
    squareFeet: makeField(squareFeet),
    lotSizeSqFt: makeField(lotSizeSqFt),
    yearBuilt: makeField(yearBuilt),
    propertyType: makeField(propertyType),
    parcelId: makeField(parcelId),
    annualTaxes: makeField(annualTaxes),
  };

  return {
    snapshot,
    raw: json,
    warnings: [],
  };
}

export function deriveSmartWizardDefaultsFromRaw(
  raw: unknown,
): Record<string, string> {
  const result: Record<string, string> = {};
  const data = raw as any;
  const property = Array.isArray(data?.property) ? data.property[0] : null;
  if (!property) return result;

  const summary = property.summary ?? {};
  const utilities = property.utilities ?? {};
  const building = property.building ?? {};
  const interior = building.interior ?? {};
  const construction = building.construction ?? {};
  const parking = building.parking ?? {};
  const lot = property.lot ?? {};
  const buildingSummary = building.summary ?? {};

  const yearBuilt: number | undefined = summary.yearBuilt;

  const roofCover: string | undefined = construction.roofCover;
  const roofShape: string | undefined = construction.roofShape;
  const roofParts: string[] = [];
  if (roofCover) roofParts.push(roofCover);
  if (roofShape) roofParts.push(roofShape);
  if (yearBuilt) roofParts.push(`approx. ${yearBuilt}`);
  if (roofParts.length) {
    result.roof_type_age = `${roofParts.join(", ")} (per public record; buyer to verify).`;
  }

  const coolingType: string | undefined = utilities.coolingType;
  const heatingType: string | undefined = utilities.heatingType;
  const heatingFuel: string | undefined = utilities.heatingFuel;
  const hvacParts: string[] = [];
  if (coolingType) hvacParts.push(`${coolingType} cooling`);
  if (heatingType) hvacParts.push(`${heatingType} heat`);
  if (heatingFuel) hvacParts.push(`${heatingFuel} fuel`);
  if (hvacParts.length) {
    result.hvac_type_age = `${hvacParts.join(", ")} (per public record; buyer to verify).`;
  }

  const floors: string | undefined = interior.floors;
  if (floors) {
    result.flooring = `${floors} flooring (per public record; buyer to verify rooms and coverage).`;
  }

  const poolType: string | undefined = lot.poolType;
  const view: string | undefined = buildingSummary.view;
  const prkgSpaces: string | number | undefined = parking.prkgSpaces;
  const exteriorParts: string[] = [];
  if (poolType) exteriorParts.push(`Pool: ${poolType}`);
  if (view && !/none/i.test(view)) exteriorParts.push(`View: ${view}`);
  if (prkgSpaces != null && prkgSpaces !== "") {
    exteriorParts.push(`Garage/Parking: ${prkgSpaces} spaces (per public record)`);
  }
  if (exteriorParts.length) {
    result.pool_waterfront_garage = `${exteriorParts.join("; ")} (buyer to verify).`;
  }

  return result;
}

export interface AttomExtendedFields {
  county: string | null;
  subdivision: string | null;
  legalDescription: string | null;
  zoning: string | null;
  totalSquareFeet: number | null;
  stories: string | null;
  taxYear: number | null;
  homesteadExemption: string | null;
}

export function deriveExtendedFieldsFromRaw(raw: unknown): AttomExtendedFields {
  const base: AttomExtendedFields = {
    county: null,
    subdivision: null,
    legalDescription: null,
    zoning: null,
    totalSquareFeet: null,
    stories: null,
    taxYear: null,
    homesteadExemption: null,
  };

  const data = raw as any;
  const property = Array.isArray(data?.property) ? data.property[0] : null;
  if (!property) return base;

  const summary = property.summary ?? {};
  const lot = property.lot ?? {};
  const location = property.location ?? {};
  const building = property.building ?? {};
  const size = building.size ?? building.area ?? {};
  const tax = property.tax ?? {};
  const assessment = property.assessment ?? {};
  const assessmentTax = assessment.tax ?? {};

  const result: AttomExtendedFields = { ...base };

  result.county =
    (location.county as string | undefined) ??
    (summary.county as string | undefined) ??
    null;

  result.subdivision =
    (summary.subdivision as string | undefined) ??
    (lot.subdName as string | undefined) ??
    (lot.subdivision as string | undefined) ??
    null;

  result.legalDescription =
    (lot.legalDescription as string | undefined) ??
    (lot.legal1 as string | undefined) ??
    (lot.legal2 as string | undefined) ??
    null;

  result.zoning =
    (summary.zoning as string | undefined) ??
    (lot.zoneDesc as string | undefined) ??
    (lot.zoning as string | undefined) ??
    null;

  const totalSqFt =
    (size.grossSize as number | undefined) ??
    (size.bldgSize as number | undefined) ??
    null;
  result.totalSquareFeet = totalSqFt;

  const stories =
    (building.summary?.stories as string | number | undefined) ??
    (building.summary?.storyDesc as string | number | undefined);
  result.stories = stories != null ? String(stories) : null;

  result.taxYear =
    (assessmentTax.taxYear as number | undefined) ??
    (tax.taxYear as number | undefined) ??
    null;

  const homestead =
    (assessmentTax.homesteadExemption as unknown) ??
    (assessment.homestead as unknown) ??
    (tax.homestead as unknown);
  if (typeof homestead === "string") {
    result.homesteadExemption = homestead;
  } else if (typeof homestead === "boolean") {
    result.homesteadExemption = homestead ? "YES" : "NO";
  } else if (homestead != null) {
    result.homesteadExemption = String(homestead);
  }

  return result;
}


