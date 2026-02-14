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
  // Optional extra payloads from secondary ATTOM endpoints (e.g. schools)
  schoolsRaw?: unknown;
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
  const warnings: string[] = [];

  async function fetchProfile(endpoint: "expandedprofile" | "basicprofile") {
    const url = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/${endpoint}?${params.toString()}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: apiKey as string,
        accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false as const,
        status: res.status,
        statusText: res.statusText,
        body: text,
      };
    }

    const json = (await res.json()) as any;
    return { ok: true as const, json };
  }

  // Prefer expandedprofile for richer MLS auto-fill, but gracefully fall back
  // to basicprofile when ATTOM returns "no match" (400) for the expanded call.
  const expanded = await fetchProfile("expandedprofile");

  let json: any;

  if (expanded.ok) {
    json = expanded.json;
  } else if (expanded.status === 401 || expanded.status === 403) {
    throw new Error(
      "ATTOM Property API unauthorized. Check that your API key is correct and has access to the Property API.",
    );
  } else if (expanded.status === 400) {
    // ATTOM uses 400 for "no match" searches. These are not billable and we
    // can safely retry against basicprofile, which is sometimes more lenient.
    warnings.push(
      "ATTOM expandedprofile returned no match (400); falling back to basicprofile for this lookup.",
    );

    const basic = await fetchProfile("basicprofile");
    if (!basic.ok) {
      if (basic.status === 401 || basic.status === 403) {
        throw new Error(
          "ATTOM Property API unauthorized. Check that your API key is correct and has access to the Property API.",
        );
      }
      throw new Error(
        `ATTOM Property API error: ${basic.status} ${basic.statusText}${basic.body ? ` - ${basic.body}` : ""}`,
      );
    }
    json = basic.json;
  } else {
    throw new Error(
      `ATTOM Property API error: ${expanded.status} ${expanded.statusText}${expanded.body ? ` - ${expanded.body}` : ""}`,
    );
  }

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

  // Optionally call ATTOM's detail-with-schools endpoint using the ATTOM ID (if present)
  let schoolsRaw: unknown = null;
  const attomId: string | number | undefined =
    (identifier.attomId as string | number | undefined) ??
    (identifier.attomid as string | number | undefined) ??
    (identifier.attom_id as string | number | undefined);

  if (attomId != null) {
    try {
      const schoolsUrl =
        `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detailwithschools?attomid=${encodeURIComponent(String(attomId))}`;

      const schoolsRes = await fetch(schoolsUrl, {
        method: "GET",
        headers: {
          apikey: apiKey,
          accept: "application/json",
        },
      });

      if (schoolsRes.ok) {
        schoolsRaw = (await schoolsRes.json()) as any;
      } else {
        const schoolsText = await schoolsRes.text().catch(() => "");
        warnings.push(
          `ATTOM detailwithschools lookup failed: ${schoolsRes.status} ${schoolsRes.statusText}${schoolsText ? " – see ATTOM logs for details" : ""}`,
        );
      }
    } catch {
      warnings.push(
        "ATTOM detailwithschools lookup threw an error; school information was not auto-filled.",
      );
    }
  }

  return {
    snapshot,
    raw: json,
    schoolsRaw,
    warnings,
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
  const assessment = property.assessment ?? {};
  const association = property.association ?? assessment.association ?? {};

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

  // Water / sewer convenience string where ATTOM exposes utility providers
  const water:
    | string
    | undefined =
    utilities.waterType ??
    utilities.water ??
    utilities.wtrSup ??
    utilities.waterSource ??
    utilities.waterSupply;
  const sewer:
    | string
    | undefined =
    utilities.sewerType ??
    utilities.sewer ??
    utilities.swrSup ??
    utilities.sewerSource ??
    utilities.sewerSupply;

  const waterSewerParts: string[] = [];
  if (water) waterSewerParts.push(`Water: ${water}`);
  if (sewer) waterSewerParts.push(`Sewer: ${sewer}`);
  if (waterSewerParts.length) {
    result.water_sewer = `${waterSewerParts.join("; ")} (per public record; buyer to verify with utility providers).`;
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

  // HOA / community summary from association data if available
  const assocName: string | undefined =
    (association.name as string | undefined) ??
    (association.assocName as string | undefined) ??
    (association.associationName as string | undefined) ??
    (association.hoaName as string | undefined);

  const assocFees: number | string | undefined =
    (association.assocFees as number | string | undefined) ??
    (association.fees as number | string | undefined) ??
    (association.associationFee as number | string | undefined) ??
    (association.hoaFee as number | string | undefined);

  const assocFeesFreq: string | undefined =
    (association.assocFeesFreq as string | undefined) ??
    (association.feeFrequency as string | undefined) ??
    (association.associationFeeFrequency as string | undefined) ??
    (association.hoaFeeFreq as string | undefined);

  const hoaParts: string[] = [];
  if (assocName) hoaParts.push(`HOA/Condo: ${assocName}`);
  if (assocFees != null && `${assocFees}`.trim() !== "") {
    const amt =
      typeof assocFees === "number"
        ? assocFees.toLocaleString()
        : String(assocFees);
    if (assocFeesFreq) {
      hoaParts.push(`Fees: $${amt} (${assocFeesFreq})`);
    } else {
      hoaParts.push(`Fees: $${amt}`);
    }
  }

  if (hoaParts.length) {
    result.hoa_fees_amenities = `${hoaParts.join("; ")} (per public record/association; buyer to verify).`;
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
   parkingSpaces: number | null;
   parkingType: string | null;
   lotFeatures: string | null;
   hoaName: string | null;
   hoaFeeAmount: number | null;
   hoaFeeFrequency: string | null;
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
    parkingSpaces: null,
    parkingType: null,
    lotFeatures: null,
    hoaName: null,
    hoaFeeAmount: null,
    hoaFeeFrequency: null,
  };

  const data = raw as any;
  const property = Array.isArray(data?.property) ? data.property[0] : null;
  if (!property) return base;

  const summary = property.summary ?? {};
  const lot = property.lot ?? {};
  const location = property.location ?? {};
  const building = property.building ?? {};
  const size = building.size ?? building.area ?? {};
   const parking = building.parking ?? {};
  const tax = property.tax ?? {};
  const assessment = property.assessment ?? {};
  const assessmentTax = assessment.tax ?? {};
   const association = property.association ?? {};

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

   // Parking
   const prkgSpaces = parking.prkgSpaces as number | string | undefined;
   if (prkgSpaces != null && `${prkgSpaces}`.trim() !== "") {
     const numeric =
       typeof prkgSpaces === "number" ? prkgSpaces : Number(prkgSpaces);
     if (Number.isFinite(numeric)) {
       result.parkingSpaces = numeric as number;
     }
   }

   result.parkingType =
     (parking.prkgType as string | undefined) ??
     (parking.parkingType as string | undefined) ??
     (parking.type as string | undefined) ??
     null;

   // Lot features / site description
   result.lotFeatures =
     (lot.lotType as string | undefined) ??
     (lot.lotDescription as string | undefined) ??
     (lot.siteType as string | undefined) ??
     (lot.siteDesc as string | undefined) ??
     null;

   // HOA basics
   result.hoaName =
     (association.name as string | undefined) ??
     (association.assocName as string | undefined) ??
     (association.associationName as string | undefined) ??
     (association.hoaName as string | undefined) ??
     null;

   const hoaFees =
     (association.assocFees as number | string | undefined) ??
     (association.fees as number | string | undefined) ??
     (association.associationFee as number | string | undefined) ??
     (association.hoaFee as number | string | undefined) ??
     null;
   if (hoaFees != null && `${hoaFees}`.trim() !== "") {
     const numeric =
       typeof hoaFees === "number" ? hoaFees : Number(hoaFees);
     if (Number.isFinite(numeric)) {
       result.hoaFeeAmount = numeric as number;
     }
   }

   result.hoaFeeFrequency =
     (association.assocFeesFreq as string | undefined) ??
     (association.feeFrequency as string | undefined) ??
     (association.associationFeeFrequency as string | undefined) ??
     (association.hoaFeeFreq as string | undefined) ??
     null;

  return result;
}

export interface AttomSchoolsSummary {
  elementary: string | null;
  middle: string | null;
  high: string | null;
}

// Very lightweight heuristic parser that walks the ATTOM schools payload and
// pulls out up to one elementary, middle, and high school by name. We avoid
// depending on any specific schema so this works across basic/expanded
// responses and future ATTOM versions.
export function deriveSchoolsFromRawSchools(raw: unknown): AttomSchoolsSummary {
  const summary: AttomSchoolsSummary = {
    elementary: null,
    middle: null,
    high: null,
  };

  if (!raw || typeof raw !== "object") return summary;

  const visited = new Set<any>();

  function visit(node: any): void {
    if (!node || typeof node !== "object" || visited.has(node)) return;
    visited.add(node);

    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === "object") {
        visit(value);
        continue;
      }

      if (typeof value === "string") {
        const keyLower = key.toLowerCase();
        const val = value.trim();
        const valLower = val.toLowerCase();

        const looksLikeSchoolName =
          keyLower.includes("school") || keyLower.includes("name");

        if (looksLikeSchoolName && /school/.test(valLower)) {
          if (!summary.elementary && /elementary/i.test(val)) {
            summary.elementary = val;
            continue;
          }
          if (!summary.middle && /middle/i.test(val)) {
            summary.middle = val;
            continue;
          }
          if (!summary.high && /high/i.test(val)) {
            summary.high = val;
            continue;
          }
        }
      }
    }
  }

  visit(raw as any);
  return summary;
}


