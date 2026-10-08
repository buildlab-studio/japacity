// R-ACCOUNT-007 to 010: a region's policy row and the stricter of two.
export type Interaction = "none" | "invited" | "matched" | "free-text";
export type AgeCheck = "declared" | "verified";

export interface RegionPolicy {
  open: boolean;
  interaction: Interaction;
  ageCheck: AgeCheck;
}

/** The keys `unknown` and `default` are always present (account.md contract item 3). */
export type Regions = Record<string, RegionPolicy> & { unknown: RegionPolicy; default: RegionPolicy };

const ORDER: readonly Interaction[] = ["none", "invited", "matched", "free-text"];

/** R-ACCOUNT-009: where two players meet, the stricter row applies. Open only when both are. */
export function stricter(a: RegionPolicy, b: RegionPolicy): RegionPolicy {
  return {
    open: a.open && b.open,
    interaction: ORDER.indexOf(a.interaction) <= ORDER.indexOf(b.interaction) ? a.interaction : b.interaction,
    ageCheck: a.ageCheck === "verified" || b.ageCheck === "verified" ? "verified" : "declared",
  };
}

/** R-ACCOUNT-008: the row for a Cloudflare country code; `XX` and `T1` take the unknown row. */
export function policyFor(regions: Regions, country: string | null | undefined): RegionPolicy {
  if (country === null || country === undefined || country === "" || country === "XX" || country === "T1") return regions.unknown;
  return regions[country] ?? regions.default;
}
