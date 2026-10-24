// Reach and read in the stylesheet and the source (world:reach-and-read): text and lines that carry meaning at 4.5 to 1 against the
// grounds they stand on by day and by night, the fills that carry white words the same, the focus ring at least 2 px in the game's
// own colours, the pad that gives a small control its 44 by 44 hit area, no text under 12 px, and a bar that shows time passing
// stepping once a second under Reduce Motion. The browser guard (e2e/reach.spec.ts) measures the screens as drawn.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

const SRC = join(import.meta.dirname, "..", "..");
const CSS = readFileSync(join(SRC, "index.css"), "utf8");

/** Every declaration of `name` in the blocks whose selector starts with `selector`, the last one winning, as the cascade reads them. */
function token(selector: string, name: string): string {
  let found: string | null = null;
  let at = CSS.indexOf(`\n${selector}`);
  while (at >= 0) {
    const open = CSS.indexOf("{", at);
    const declarations = CSS.slice(open + 1, CSS.indexOf("}", open));
    const value = new RegExp(`(?:^|[;\\s])${name}:\\s*([^;]+);`).exec(declarations)?.[1]?.trim();
    if (value !== undefined) found = value;
    at = CSS.indexOf(`\n${selector}`, open);
  }
  if (found === null) throw new Error(`No ${name} under ${selector}.`);
  return found;
}

const DAY = ":root {";
const NIGHT = ':root[data-paint="night"]';

/** A token in a paint: the night's own where it sets one, else the day's, as the cascade gives it. */
function paint(night: boolean, name: string): string {
  if (night) {
    try {
      return resolve(night, token(NIGHT, name));
    } catch {
      // Not set at night: the day's stands.
    }
  }
  return resolve(night, token(DAY, name));
}

function resolve(night: boolean, value: string): string {
  const alias = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
  return alias === undefined ? value : paint(night, alias);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255) as [number, number, number];
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

const GROUNDS = ["--sheet", "--sheet-2", "--sheet-muted", "--screen", "--tint-food", "--tint-study", "--tint-money", "--tint-body", "--tint-people"];
/** The inks a line carries meaning in: the text, its quiet second, money in and money out (a refusal, a cannot-pay, a free name). */
const INKS = ["--text", "--text-2", "--in", "--out"];

describe("contrast by day and by night (world:reach-and-read)", () => {
  for (const night of [false, true]) {
    const when = night ? "night" : "day";
    test(`[world:reach-and-read] given the ${when} paint, then text, money in and money out meet 4.5 to 1 on every sheet, card and tint`, () => {
      const short: string[] = [];
      for (const ink of INKS) for (const ground of GROUNDS) if (contrast(paint(night, ink), paint(night, ground)) < 4.5) short.push(`${ink} on ${ground}: ${String(contrast(paint(night, ink), paint(night, ground)))}`);
      expect(short).toEqual([]);
    });

    test(`[world:reach-and-read] given the ${when} paint, then the band's money meets 4.5 to 1 on its green and the soft yellow's ink on its yellow`, () => {
      expect(contrast(paint(night, "--money-ink"), paint(night, "--tint-money"))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(paint(night, "--soft-ink"), paint(night, "--soft"))).toBeGreaterThanOrEqual(4.5);
    });

    test(`[world:reach-and-read] given the ${when} paint, then a filled mark or banner in money in or out carries white and cream words at 4.5 to 1`, () => {
      for (const fill of ["--in-fill", "--out-fill"]) {
        expect(contrast("#ffffff", paint(night, fill))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(paint(night, "--on-strong"), paint(night, fill))).toBeGreaterThanOrEqual(4.5);
      }
    });

    test(`[world:reach-and-read] given the ${when} paint, then the focus ring meets 3 to 1 on every sheet and card`, () => {
      for (const ground of ["--sheet", "--sheet-2", "--sheet-muted", "--screen"]) expect(contrast(paint(night, "--focus-ring"), paint(night, ground))).toBeGreaterThanOrEqual(3);
    });
  }
});

describe("focus, reach and size (world:reach-and-read)", () => {
  test("[world:reach-and-read] given keyboard focus anywhere, then a ring at least 2 px wide shows in the focus ring's colour", () => {
    const rule = /:focus-visible\s*\{([^}]*)\}/.exec(CSS.slice(CSS.indexOf("@layer base")))?.[1] ?? "";
    const width = Number(/outline:\s*(\d+(?:\.\d+)?)px solid var\(--focus-ring\)/.exec(rule)?.[1] ?? "0");
    expect(width).toBeGreaterThanOrEqual(2);
  });

  test("[world:reach-and-read] given a control drawn smaller than 44 px, then its reach pad is a hit area of at least 44 by 44 centred on it", () => {
    const pad = /\.reach::after\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? "";
    expect(pad).toMatch(/position:\s*absolute/);
    expect(pad).toMatch(/width:\s*max\(100%,\s*44px\)/);
    expect(pad).toMatch(/height:\s*max\(100%,\s*44px\)/);
    expect(pad).toMatch(/content:\s*""/);
  });

  test("[world:reach-and-read] given the band's two thin lines, then the top line's pads reach up and the bottom line's down, so a tap on the age never opens the calendar", () => {
    expect(CSS).toMatch(/\.reach-up::after \{ top: auto; bottom: 0; translate: -50% 0; \}/);
    expect(CSS).toMatch(/\.reach-down::after \{ top: 0; translate: -50% 0; \}/);
    const band = readFileSync(join(SRC, "shared", "world", "TopBand.tsx"), "utf8");
    const person = readFileSync(join(SRC, "shared", "datapage", "PageSheet.tsx"), "utf8");
    expect(band).toMatch(/className="band-part press reach reach-up [^"]*" onClick=\{onMonth\}/);
    expect(person).toMatch(/className="reach reach-up col-start-1 row-start-1 /);
    expect(person).toMatch(/className="press reach reach-down [^"]*" onClick=\{show\} aria-label=\{say\("prologue\.page\.open"\)\} data-page-open/);
  });

  test("[world:reach-and-read] given the shared buttons and labels, then the pill button stands 44 px tall and a label's text is at least 12 px", () => {
    expect(Number(/\.pill-button\s*\{[^}]*height:\s*(\d+)px/.exec(CSS)?.[1] ?? "0")).toBeGreaterThanOrEqual(44);
    expect(Number(/\n\.label\s*\{[^}]*font-size:\s*(\d+)px/.exec(CSS)?.[1] ?? "0")).toBeGreaterThanOrEqual(12);
  });

  test("[world:reach-and-read] given the client's source, then no text is set under 12 px (the development-only sheets aside)", () => {
    const DEV_ONLY = new Set(["shared/tiles/TileSheet.tsx", "shared/ui/look/LookPreview.tsx"]);
    const small: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          walk(path);
          continue;
        }
        if (!/\.(tsx?|css)$/.test(name) || /\.test\.tsx?$|\.testing\.tsx?$/.test(name)) continue;
        const file = relative(SRC, path).replaceAll("\\", "/");
        if (DEV_ONLY.has(file)) continue;
        const lines = readFileSync(path, "utf8").split("\n");
        for (const [index, line] of lines.entries()) {
          for (const match of line.matchAll(/text-\[(\d+(?:\.\d+)?)px\]|font-size:\s*(\d+(?:\.\d+)?)px|fontSize:\s*(\d+(?:\.\d+)?)\b/g)) {
            const size = Number(match[1] ?? match[2] ?? match[3]);
            if (size < 12) small.push(`${file}:${String(index + 1)} ${match[0]}`);
          }
        }
      }
    };
    walk(SRC);
    expect(small).toEqual([]);
  });
});

describe("time passing under Reduce Motion (world:reach-and-read)", () => {
  test("[world:reach-and-read] given Reduce Motion, then the sleep's bar keeps running down, a step each second, while every other motion stops", () => {
    const reduced = [...CSS.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/g)].map((match) => match[1] ?? "").join("\n");
    const bar = /\.sleep-bar\s*\{([^}]*)\}/.exec(reduced)?.[1] ?? "";
    expect(bar).toMatch(/animation:\s*sleep-bar calc\(var\(--seconds\) \* 1s\) steps\(var\(--seconds\)\)[^;]*!important/);
  });
});
