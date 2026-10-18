// account:country-comes-from-cloudflare: a request's country, as Cloudflare gives it.

/** `request.cf.country` on Workers, else the `CF-IPCountry` header; null when neither is set. */
export function countryOf(request: Request | null | undefined, headers?: Headers | null): string | null {
  const cf = (request as { cf?: { country?: unknown } } | null | undefined)?.cf;
  if (typeof cf?.country === "string" && cf.country !== "") return cf.country;
  const header = (headers ?? request?.headers)?.get("cf-ipcountry") ?? null;
  return header === null || header === "" ? null : header.toUpperCase();
}

/** The country stored at sign-up: the request's, or `XX` when Cloudflare gave none. */
export function signUpCountry(request: Request | null | undefined, headers?: Headers | null): string {
  return countryOf(request, headers) ?? "XX";
}
