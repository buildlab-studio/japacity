// server:csp-holds-every-page: under `require-trusted-types-for 'script'` the browser takes a script's address only as a
// trusted value made by a Trusted Types policy the page's content policy names. The page makes one, under one name,
// and it passes only addresses on the outside script hosts the page loads from code, so a string that reached a
// script's address by any other way is refused before it loads. A browser without Trusted Types gets the checked
// address as it is.

/** The policy's name, as the content policy's `trusted-types` directive lists it. */
export const TRUSTED_TYPES_POLICY = "japacity";

/** The outside hosts a script is loaded from in code: the bot check's. The beacon is a tag in the page, not code. */
export const SCRIPT_HOSTS: readonly string[] = ["https://challenges.cloudflare.com"];

/** The part of the browser's Trusted Types factory this uses; TypeScript's DOM types do not carry it yet. */
interface TrustedTypesFactory {
  createPolicy(name: string, rules: { createScriptURL: (input: string) => string }): { createScriptURL: (input: string) => unknown };
}

function checked(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new TypeError("A script address must be a whole address on a named host.");
  }
  if (!SCRIPT_HOSTS.includes(url.origin)) throw new TypeError(`No script is loaded from ${url.origin}.`);
  return input;
}

let policy: ReturnType<TrustedTypesFactory["createPolicy"]> | null = null;

/** A script's address, made trusted where the browser has Trusted Types; refused when it is not on a named host. */
export function trustedScriptUrl(input: string): string {
  const factory = (globalThis as { trustedTypes?: TrustedTypesFactory }).trustedTypes;
  if (factory === undefined) return checked(input);
  policy ??= factory.createPolicy(TRUSTED_TYPES_POLICY, { createScriptURL: checked });
  // A trusted value goes where a string does; the element reads it as the address.
  return policy.createScriptURL(input) as string;
}
