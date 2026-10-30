import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, test } from "vitest";

import { requestFailure } from "../net/http";
import { troubleWords } from "./trouble";

const CLIENT = join(import.meta.dirname, "../..");

/** Every source file of the client that is not a test or a test's helper. */
function sources(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return name === "testing" ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("a failed request on screen is said in the player's words (engine:browser-authority-for-dev-only)", () => {
  test("[engine:browser-authority-for-dev-only] each kind of failure is said by the trouble words, and anything else as ours, never the error's own text", () => {
    expect(troubleWords(requestFailure("network", "Load failed"))).toBe("Could not connect");
    expect(troubleWords(requestFailure("wall", "an opaque redirect"))).toBe("Your session ended");
    expect(troubleWords(requestFailure("server", "502"))).toBe("Something went wrong on our side");
    expect(troubleWords(new TypeError("Failed to fetch"))).toBe("Something went wrong on our side");
  });

  test("[engine:browser-authority-for-dev-only] no screen or helper of the client reads an error's message to show it: the trouble words say it instead", () => {
    const found: string[] = [];
    const files = sources(CLIENT);
    expect(files.length).toBeGreaterThan(100);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\b\w*(?:error|caught|err|reason|failure)\w*\??\.message\b|\.message\s*\}/gi)) found.push(`${relative(CLIENT, file)}: ${match[0]}`);
    }
    expect(found).toEqual([]);
  });
});
