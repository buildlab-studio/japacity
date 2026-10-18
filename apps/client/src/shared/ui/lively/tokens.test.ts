// The lively layer's tokens (docs/design/13-the-lively-layer.md, section 2; decision 0025; world:colours-are-role-tokens): the day
// paint on :root, the night paint under data-paint="night", one type face in three sizes, and the circle pattern kept
// off every everyday surface.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const CSS = readFileSync(join(import.meta.dirname, "..", "..", "..", "index.css"), "utf8");
const KINDS = ["food", "study", "money", "body", "people", "plain"] as const;

/** The declarations of the first block whose selector list starts with `selector`. */
function block(selector: string): string {
  const at = CSS.indexOf(`\n${selector}`);
  if (at < 0) throw new Error(`No ${selector} block.`);
  const open = CSS.indexOf("{", at);
  return CSS.slice(open + 1, CSS.indexOf("}", open));
}

function token(declarations: string, name: string): string | null {
  return new RegExp(`(?:^|[;\\s])${name}:\\s*([^;]+);`).exec(declarations)?.[1]?.trim() ?? null;
}

/** A #rrggbb colour's hue in degrees and its relative luminance. */
function colour(hex: string): { hue: number; luminance: number } {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const span = max - min;
  const hue = span === 0 ? 0 : max === r ? (60 * ((g - b) / span) + 360) % 360 : max === g ? 60 * ((b - r) / span) + 120 : 60 * ((r - g) / span) + 240;
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return { hue, luminance: 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b) };
}

function hueGap(a: number, b: number): number {
  const gap = Math.abs(a - b) % 360;
  return gap > 180 ? 360 - gap : gap;
}

describe("the day paint", () => {
  test("[world:colours-are-role-tokens] given :root, then the sheet is pale sky, cards white, the ink navy, the edge navy at 1 px, the action danfo yellow with a navy underside, and money in and out keep their colours", () => {
    const day = block(":root {");
    expect(token(day, "--sheet")).toBe("#eaf3fb");
    expect(token(day, "--sheet-2")).toBe("#ffffff");
    expect(token(day, "--text")).toBe("#131a33");
    expect(token(day, "--strong")).toBe("#1c2a5e");
    expect(token(day, "--edge")).toBe("#1c2a5e");
    expect(token(day, "--edge-width")).toBe("1px");
    expect(token(day, "--action")).toBe("#f2b705");
    expect(token(day, "--action-under")).toBe("#1c2a5e");
    expect(token(day, "--in")).toBe("#2a8656");
    expect(token(day, "--out")).toBe("#c23a2a");
  });

  test("[world:colours-are-role-tokens] given :root, then each kind of act has its soft tint, and the plain one is the sheet's", () => {
    const day = block(":root {");
    expect(token(day, "--tint-food")).toBe("#ffe8dc");
    expect(token(day, "--tint-study")).toBe("#dde9fb");
    expect(token(day, "--tint-money")).toBe("#dcf5e6");
    expect(token(day, "--tint-body")).toBe("#ebe3f7");
    expect(token(day, "--tint-people")).toBe("#fde0e8");
    expect(token(day, "--tint-plain")).toBe(token(day, "--sheet"));
  });
});

describe("the night paint", () => {
  test("[world:colours-are-role-tokens] given data-paint night, then the sheet is navy, cards a lighter navy, the ink and the edges cream, and the yellow action unchanged", () => {
    const night = block(':root[data-paint="night"]');
    expect(token(night, "--sheet")).toBe("#1c2a5e");
    expect(token(night, "--sheet-2")).toBe("#243470");
    expect(token(night, "--text")).toBe("#f3efe6");
    expect(token(night, "--edge")).toBe("#f3efe6");
    expect(token(night, "--action")).toBeNull();
    expect(token(night, "color-scheme")).toBe("dark");
  });

  test("[world:colours-are-role-tokens] given data-paint night, then every tint is darkened to the same hue, dark enough for the cream ink", () => {
    const day = block(":root {");
    const night = block(':root[data-paint="night"]');
    for (const kind of KINDS.filter((each) => each !== "plain")) {
      const lit = colour(token(day, `--tint-${kind}`) ?? "");
      const dark = colour(token(night, `--tint-${kind}`) ?? "");
      expect({ kind, sameHue: hueGap(lit.hue, dark.hue) <= 25, dark: dark.luminance < 0.12 }).toEqual({ kind, sameHue: true, dark: true });
    }
    expect(token(night, "--tint-plain")).toBe(token(night, "--sheet"));
  });

  test("[world:colours-are-role-tokens] given the night paint, then a part of the page can carry it too, so the two paints stand side by side", () => {
    expect(CSS).toMatch(/\n:root\[data-paint="night"\],\n\[data-paint="night"\] \{/);
  });
});

describe("one look", () => {
  test("[world:colours-are-role-tokens] given index.css, then the danfo theme and the comparison surfaces are gone", () => {
    expect(CSS).not.toContain('data-ui="danfo"');
    expect(CSS).not.toContain("data-surface");
  });

  test("[world:colours-are-role-tokens] given the type, then Rubik is the face at 500 and 700, latin only, with the system's behind it; Danfo stays for the wordmark", () => {
    expect(CSS).toContain('@import "@fontsource/rubik/latin-500.css";');
    expect(CSS).toContain('@import "@fontsource/rubik/latin-700.css";');
    expect(CSS).not.toMatch(/@fontsource\/rubik\/(index|[0-9]{3})\.css/);
    expect(CSS).toMatch(/--font-sans: "Rubik", system-ui,/);
    expect(CSS).toMatch(/--font-display: "Danfo",/);
  });

  test("[world:colours-are-role-tokens] given the type, then titles and money are 22 px, the body 16 and chips 12", () => {
    expect(CSS).toContain("--text-title: 22px;");
    expect(CSS).toContain("--text-body: 16px;");
    expect(CSS).toContain("--text-chip: 12px;");
  });

  test("[world:colours-are-role-tokens] given the circle pattern, then the band, its second shade and the sheet heads on them no longer carry it; only the adire class does", () => {
    const rules = [...CSS.matchAll(/\n\.([a-z0-9-]+) \{([^}]*)\}/g)].filter((match) => (match[2] ?? "").includes("var(--pattern)")).map((match) => match[1]);
    expect(rules.sort()).toEqual(["adire", "wall"]);
  });
});
