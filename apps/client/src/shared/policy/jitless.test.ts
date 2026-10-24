// server:csp-holds-every-page: the page's policy lets no string run as script ('unsafe-eval' is never allowed), and
// Zod probes for it with `Function("")` as each object shape is built unless told not to. The probe is a refusal on
// every load: reported while the policy only reports, and still a report once it enforces. The game's modules build
// their shapes as they are first run, before any line of the entry's own, so Zod is told by a script of its own that
// the page runs before the entry.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

const CLIENT = join(import.meta.dirname, "..", "..", "..");
const SCRIPT = join(CLIENT, "public", "zod-jitless.js");
/** The simulation's own Zod, the one the game's shapes are built with. */
const SIM = join(CLIENT, "..", "..", "packages", "sim");

/** Zod's setting as a fresh Node sees it once it has loaded Zod, with or without the page's script run first. */
function jitlessAfter(withScript: boolean): string {
  const first = withScript ? `await import(${JSON.stringify(`file://${SCRIPT}`)});` : "";
  const program = `${first} const { z } = await import("zod"); process.stdout.write(String(z.config().jitless));`;
  return execFileSync(process.execPath, ["--input-type=module", "-e", program], { cwd: SIM, encoding: "utf8" });
}

describe("Zod without eval in the page", () => {
  test("[server:csp-holds-every-page] given the page's script run before Zod loads, when Zod is loaded, then it is set never to build a checker from a string; without the script it is not", () => {
    expect(jitlessAfter(true)).toBe("true");
    expect(jitlessAfter(false)).toBe("undefined");
  });

  test("[server:csp-holds-every-page] given the page, when its scripts are read, then the first is the deferred one that sets Zod, so it runs before the entry and holds up no paint", () => {
    const page = readFileSync(join(CLIENT, "index.html"), "utf8");
    expect([...page.matchAll(/<script\b[^>]*>/g)].map((match) => match[0])).toEqual(['<script defer src="/zod-jitless.js">', '<script type="module" src="/src/main.tsx">']);
  });
});
