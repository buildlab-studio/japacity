// The lively layer's motion (docs/design/09-the-lively-layer.md, section 7; world:motions-under-half-second): every tappable thing
// squashes on press, a sticker wobbles in, a chip pops, a refusal shakes three times; each on transform and opacity
// alone, under 300 ms, and a fade under reduced motion.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const CSS = readFileSync(join(import.meta.dirname, "..", "..", "..", "index.css"), "utf8");
const LIVELY = ["wobble-in", "pop", "shake"] as const;

/** The animation's duration in ms for a class written `.name { animation: name 0.26s ... }`. */
function durationOf(name: string): number {
  const found = new RegExp(`\\n\\.${name} \\{ animation: ${name} ([\\d.]+)s`).exec(CSS);
  if (found?.[1] === undefined) throw new Error(`No rule for .${name}`);
  return Math.round(Number(found[1]) * 1000);
}

/** The properties a keyframes block sets. */
function keyframeProperties(name: string): string[] {
  const at = CSS.indexOf(`@keyframes ${name} {`);
  if (at < 0) throw new Error(`No keyframes ${name}`);
  let depth = 0;
  let end = at;
  for (let index = CSS.indexOf("{", at); index < CSS.length; index += 1) {
    if (CSS[index] === "{") depth += 1;
    if (CSS[index] === "}") depth -= 1;
    if (depth === 0) {
      end = index;
      break;
    }
  }
  const body = CSS.slice(CSS.indexOf("{", at) + 1, end);
  return [...new Set([...body.matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1] ?? ""))];
}

describe("the lively motion", () => {
  test.each(LIVELY)("[world:motions-under-half-second] given .%s, then it lasts under 300 ms and moves transform and opacity alone", (name) => {
    expect(durationOf(name)).toBeLessThan(300);
    for (const property of keyframeProperties(name)) expect({ name, property, ok: property === "transform" || property === "opacity" }).toEqual({ name, property, ok: true });
  });

  test("[world:motions-under-half-second] given a refusal, then the shake goes sideways three times and comes back", () => {
    const at = CSS.indexOf("@keyframes shake {");
    const body = CSS.slice(at, CSS.indexOf("\n}", at));
    const lefts = [...body.matchAll(/translateX\(-\d+px\)/g)].length;
    const rights = [...body.matchAll(/translateX\(\d+px\)/g)].length;
    expect(lefts).toBe(3);
    expect(rights).toBe(3);
  });

  test("[world:motions-under-half-second] given anything tappable with .press, when it is held, then it squashes to 0.96 and springs back in a short transition on its scale", () => {
    expect(CSS).toMatch(/\n {2}\.press \{ transition-property: scale; transition-duration: 1\d\dms;[^}]*\}/);
    expect(CSS).toMatch(/\n {2}\.press:active \{ scale: 0\.96; \}/);
  });

  test("[world:motions-under-half-second] given reduced motion, then the wobble, the pop and the shake are each the fade", () => {
    const line = /\n {2}([^\n{]*) \{ animation: fade ([\d.]+)s ease both !important; \}/.exec(CSS);
    const classes = (line?.[1] ?? "").split(",").map((each) => each.trim());
    for (const name of LIVELY) expect(classes).toContain(`.${name}`);
  });
});
