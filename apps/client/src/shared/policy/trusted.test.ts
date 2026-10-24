// server:csp-holds-every-page: under `require-trusted-types-for 'script'` a script's address may only be set from a
// Trusted Types policy. The page makes one, under one name, and it passes only the outside script hosts the content
// policy names; anything else is refused before it reaches the page.
import { afterEach, describe, expect, test, vi } from "vitest";

import { SCRIPT_HOSTS, TRUSTED_TYPES_POLICY, trustedScriptUrl } from "./trusted";

interface Made {
  name: string;
  rules: { createScriptURL: (input: string) => string };
}

function fakeFactory(made: Made[]) {
  return {
    createPolicy: (name: string, rules: Made["rules"]) => {
      made.push({ name, rules });
      return { createScriptURL: (input: string) => ({ trusted: rules.createScriptURL(input) }) };
    },
  };
}

function refused(make: () => unknown): boolean {
  try {
    make();
    return false;
  } catch {
    return true;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("the page's Trusted Types policy", () => {
  test("[server:csp-holds-every-page] given a browser with Trusted Types, when a script address on a named host is made twice, then one policy of the page's name makes both, as trusted values", async () => {
    const made: Made[] = [];
    vi.stubGlobal("trustedTypes", fakeFactory(made));
    const fresh = await import("./trusted");
    const url = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    expect(fresh.trustedScriptUrl(url)).toEqual({ trusted: url });
    expect(fresh.trustedScriptUrl(url)).toEqual({ trusted: url });
    expect(made.map((each) => each.name)).toEqual([TRUSTED_TYPES_POLICY]);
  });

  test("[server:csp-holds-every-page] given a browser with Trusted Types, when an address off the named hosts is asked for, then it is refused", async () => {
    vi.stubGlobal("trustedTypes", fakeFactory([]));
    const fresh = await import("./trusted");
    for (const url of ["https://evil.example.test/x.js", "http://challenges.cloudflare.com/turnstile/v0/api.js", "https://challenges.cloudflare.com.evil.test/a.js", "data:text/javascript,alert(1)", "javascript:alert(1)", "/assets/own.js"]) {
      expect({ url, refused: refused(() => fresh.trustedScriptUrl(url)) }).toEqual({ url, refused: true });
    }
  });

  test("[server:csp-holds-every-page] given a browser without Trusted Types, when an address is made, then a named host's comes back as it is and any other is still refused", () => {
    expect(trustedScriptUrl("https://challenges.cloudflare.com/turnstile/v0/api.js")).toBe("https://challenges.cloudflare.com/turnstile/v0/api.js");
    expect(() => trustedScriptUrl("https://evil.example.test/x.js")).toThrow();
    expect(SCRIPT_HOSTS).toEqual(["https://challenges.cloudflare.com"]);
  });
});
