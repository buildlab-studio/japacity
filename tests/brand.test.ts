// The brand package keeps the game's colours and wordmark letters as data for pictures drawn outside the client
// (the teaser). These guards fail when the package and the client drift apart.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { CREAM, DAY, DEVICE, FONT, GREEN, NAVY, NIGHT, TINT, WORDMARK_PATH, YELLOW } from "../packages/brand/src/index";
import { REPO_ROOT } from "../tools/repo";

const CSS = readFileSync(join(REPO_ROOT, "apps", "client", "src", "index.css"), "utf8");
const block = (selector: string): string => {
  const start = CSS.indexOf(selector);
  return CSS.slice(start, CSS.indexOf("}", start));
};
const DAY_BLOCK = block(":root {");
const NIGHT_BLOCK = block(':root[data-paint="night"]');
const value = (css: string, name: string): string | undefined => new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1];
const firstFamily = (stack: string | undefined): string | undefined => stack?.split(",")[0]?.trim().replace(/"/g, "");

describe("the brand package", () => {
  // skyDeep is left out: it is the teaser's own deeper background and the client has no token of it.
  test("[R-WORLD-021] given the brand's paints, then each colour but the teaser's skyDeep is the client's role token of the same paint", () => {
    const paint = { sky: "sheet", card: "sheet-2", ink: "text", ink2: "text-2", edge: "edge", cut: "cut" } as const;
    for (const [key, token] of Object.entries(paint)) expect({ key, value: DAY[key as keyof typeof paint] }).toEqual({ key, value: value(DAY_BLOCK, token) });
    for (const [key, token] of Object.entries(paint)) expect({ key, value: NIGHT[key as keyof typeof paint] }).toEqual({ key, value: value(NIGHT_BLOCK, token) });
    expect([NAVY, YELLOW, CREAM, DEVICE, GREEN]).toEqual([value(DAY_BLOCK, "strong"), value(DAY_BLOCK, "action"), value(DAY_BLOCK, "on-strong"), value(DAY_BLOCK, "device"), value(DAY_BLOCK, "in")]);
    for (const [kind, tint] of Object.entries(TINT)) expect({ kind, tint }).toEqual({ kind, tint: value(DAY_BLOCK, `tint-${kind}`) });
    expect(firstFamily(FONT)).toBe(firstFamily(value(CSS, "font-sans")));
  });

  test("[R-WORLD-021] given the lockups the site serves, then the name in each is drawn with the brand's wordmark letters", () => {
    for (const ground of ["light", "dark"]) {
      const svg = readFileSync(join(REPO_ROOT, "apps", "client", "public", "brand", `japacity-lockup-${ground}.svg`), "utf8");
      const name = /<\/g>\s*<path d="([^"]+)"/.exec(svg)?.[1];
      expect({ ground, same: name === WORDMARK_PATH }).toEqual({ ground, same: true });
    }
  });
});
