// the address the server trusts (SITE_URL, which the
// auth library, the passkeys' relying party, the Turnstile host check and the
// origin check all read) is the address the game is served from, the one the
// holding page's play link opens and the one the friends' gate stands in front of.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const PLAY = "https://play.japacity.com";

function wrangler(path: string): { vars: Record<string, string>; routes?: { pattern: string }[] } {
  const text = readFileSync(fileURLToPath(new URL(path, import.meta.url).href), "utf8");
  return JSON.parse(text.replace(/^\s*\/\/.*$/gm, "")) as { vars: Record<string, string>; routes?: { pattern: string }[] };
}

describe("the game's address", () => {
  test("given the three Workers' shipped settings, when they are read, then the server's SITE_URL is the play address, the holding page's play link opens it, and the gate's route is on its host", () => {
    const server = wrangler("../wrangler.jsonc");
    const landing = wrangler("../../landing/wrangler.jsonc");
    const gate = wrangler("../../gate/wrangler.jsonc");
    expect(server.vars["SITE_URL"]).toBe(PLAY);
    expect(landing.vars["LANDING_PLAY_URL"]).toBe(PLAY);
    expect(gate.routes?.map((route) => route.pattern)).toEqual([`${new URL(PLAY).host}/*`]);
  });
});
