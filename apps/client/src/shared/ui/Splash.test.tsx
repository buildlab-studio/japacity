// engine:browser-authority-for-dev-only (the splash): the page's first paint is the splash, written in
// index.html, and the opening screen renders the same markup from one component. index.html is the one source of the
// splash's style and of the mark's drawing; these tests hold the page and the component equal, the drawing equal to the
// brand's small mark, the colours equal to the day paint's tokens, and the inline bytes under their budget.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { say } from "../words/text";
import { MARK_ID, Splash } from "./Splash";

const CLIENT = join(import.meta.dirname, "..", "..", "..");
const PAGE = readFileSync(join(CLIENT, "index.html"), "utf8");
const CSS = readFileSync(join(CLIENT, "src", "index.css"), "utf8");
const SMALL_MARK = readFileSync(join(CLIENT, "public", "brand", "japacity-mark-small-light.svg"), "utf8");

/** The first match's first group, or a failure naming what was looked for. */
function found(pattern: RegExp, what: string): string {
  const match = pattern.exec(PAGE);
  if (match?.[1] === undefined) throw new Error(`index.html has no ${what}.`);
  return match[1];
}

/** What the page paints inside #root before its script runs. */
const ROOT = found(/<div id="root">([\s\S]*?)<\/div>\s*<script/, "#root");
/** The inline style in the page's head. */
const STYLE = found(/<style>([\s\S]*?)<\/style>/, "inline style");
/** The hidden drawing the splash's mark points at, defined once outside #root so React's renders keep it. */
const SYMBOL = found(new RegExp(`(<svg[^>]*><symbol id="${MARK_ID}"[\\s\\S]*?</symbol></svg>)`), "mark symbol");

/** The drawing's shapes: every circle and path, in order, as written. */
function shapes(svg: string): string[] {
  return [...svg.matchAll(/<(?:circle|path)\b[^>]*\/>/g)].map((shape) => shape[0]);
}

describe("the splash (engine:browser-authority-for-dev-only)", () => {
  test("[engine:browser-authority-for-dev-only] given index.html, then what it paints inside #root is the splash component's own markup, so nothing jumps when the script mounts", () => {
    expect(ROOT.trim()).toBe(renderToStaticMarkup(<Splash />));
  });

  test("[engine:browser-authority-for-dev-only] given index.html's splash, then its only words are the game's name, never Opening your life, since the page cannot know yet whether this device keeps a life", () => {
    const words = ROOT.replace(/<[^>]+>/g, "").trim();
    expect(words).toBe(say("ui.game"));
    expect(PAGE).not.toContain(say("ui.loading"));
  });

  test("[engine:browser-authority-for-dev-only] given the mark's drawing in index.html, then it is the brand's small mark, shape for shape, drawn inline and never fetched", () => {
    expect(shapes(SMALL_MARK).length).toBeGreaterThan(0);
    expect(shapes(SYMBOL)).toEqual(shapes(SMALL_MARK));
    expect(SYMBOL).toContain('viewBox="0 0 512 512"');
    expect(ROOT).toContain(`href="#${MARK_ID}"`);
    expect(ROOT).not.toMatch(/<img|src=/);
  });

  test("[engine:browser-authority-for-dev-only] [world:colours-are-role-tokens] given the splash's style, then every colour is a role token whose first-paint fallback is the day paint's own value, and the body takes the game's ground", () => {
    const day = /\n:root \{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? "";
    const used = [...STYLE.matchAll(/var\((--[\w-]+),\s*(#[0-9a-f]{3,6})\)/gi)];
    expect(used.length).toBeGreaterThan(0);
    for (const [, name, fallback] of used) expect({ name, fallback }).toEqual({ name, fallback: new RegExp(`\\s${name ?? ""}:\\s*(#[0-9a-f]{3,6});`, "i").exec(day)?.[1] });
    // No colour stands bare outside a token's fallback.
    expect(STYLE.replace(/var\(--[\w-]+,\s*#[0-9a-f]{3,6}\)/gi, "")).not.toMatch(/#[0-9a-f]{3,6}\b|rgba?\(/i);
    expect(STYLE).toMatch(/body\{[^}]*background:var\(--sheet,/);
  });

  test("[engine:browser-authority-for-dev-only] given the splash's words, then they pulse softly by opacity alone over two seconds, and stand still under reduced motion", () => {
    const keyframes = found(/@keyframes splash-pulse\{([\s\S]*?\})\}/, "pulse");
    const properties = new Set([...keyframes.matchAll(/([a-z-]+):/g)].map((property) => property[1]));
    expect([...properties]).toEqual(["opacity"]);
    expect(STYLE).toMatch(/\.splash-words\{[^}]*animation:splash-pulse 2s /);
    expect(STYLE).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\.splash-words\{animation:none\}\}/);
  });

  test("[engine:browser-authority-for-dev-only] given the inline style and the mark's drawing, then together they stay under 1.5 KB", () => {
    const bytes = Buffer.byteLength(STYLE) + Buffer.byteLength(SYMBOL) + Buffer.byteLength(ROOT);
    expect(bytes).toBeLessThan(1536);
  });

  test("[engine:browser-authority-for-dev-only] given the splash, then its column starts a little over a fifth of the way down, so the mark and the name sit about a third down, clear of the thumb row", () => {
    expect(STYLE).toMatch(/\.splash\{[^}]*padding:22vh /);
  });
});
