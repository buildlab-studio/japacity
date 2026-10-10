// The chosen row's own tokens (world.md R-WORLD-021; the design): a list's pick is a role,
// `--pick`, `--on-pick` and `--pick-mark`, set in both themes, never a colour written in a component.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const CSS = readFileSync(join(import.meta.dirname, "..", "..", "index.css"), "utf8");

/** The declarations of the first block whose selector is exactly `selector`. */
function block(selector: string): string {
  const at = CSS.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`No ${selector} block.`);
  return CSS.slice(at, CSS.indexOf("}", at));
}

describe("the pick tokens", () => {
  test("[R-WORLD-021] given both themes, then each sets the pick, the words on it and the mark on it as role tokens, and Tailwind names them as colours", () => {
    for (const selector of [":root", ':root[data-ui="danfo"]']) {
      for (const token of ["--pick", "--on-pick", "--pick-mark"]) expect({ selector, token, set: new RegExp(`${token}:\\s*[^;]+;`).test(block(selector)) }).toEqual({ selector, token, set: true });
    }
    for (const token of ["pick", "on-pick", "pick-mark"]) expect(CSS).toContain(`--color-${token}: var(--${token});`);
  });
});
