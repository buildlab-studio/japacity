// R-ACCOUNT-008: a request's country, as Cloudflare gives it.
import { policyFor } from "../region";
import type { RegionPolicy, Regions } from "../region";

/** `request.cf.country` on Workers, else the `CF-IPCountry` header; null when neither is set. */
export function countryOf(request: Request | null | undefined, headers?: Headers | null): string | null {
  const cf = (request as { cf?: { country?: unknown } } | null | undefined)?.cf;
  if (typeof cf?.country === "string" && cf.country !== "") return cf.country;
  const header = (headers ?? request?.headers)?.get("cf-ipcountry") ?? null;
  return header === null || header === "" ? null : header.toUpperCase();
}

/** The row a request is judged by, and the country stored at sign-up (`XX` when Cloudflare gave none). */
export function regionOf(regions: Regions, request: Request | null | undefined, headers?: Headers | null): { country: string; policy: RegionPolicy } {
  const country = countryOf(request, headers);
  return { country: country ?? "XX", policy: policyFor(regions, country) };
}
