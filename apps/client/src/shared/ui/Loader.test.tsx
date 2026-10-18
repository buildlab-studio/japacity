// engine:browser-authority-for-dev-only: every wait takes the splash's look, the words with a thin
// horizontal bar under them. The bar runs by transform alone when the share is not known, fills to it when it is, and
// stands still as a full quiet bar under reduced motion. Never a spinner.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Loader, Waiting } from "./Loader";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

const CSS = readFileSync(join(import.meta.dirname, "..", "..", "index.css"), "utf8");

/** The body of the first rule whose selector is exactly `selector`, inside `within` (the sheet by default). */
function rule(selector: string, within = CSS): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|[}\\n])\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(within);
  if (match?.[1] === undefined) throw new Error(`index.css has no ${selector}.`);
  return match[1];
}

describe("the loader (engine:browser-authority-for-dev-only)", () => {
  test("[engine:browser-authority-for-dev-only] given no known share, when the loader shows, then it is a progressbar with no value, a short segment running across it by transform alone over two seconds", () => {
    render(<Loader label="Opening your life..." />);
    const bar = screen.getByRole("progressbar", { name: "Opening your life..." });
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(bar.dataset["loader"]).toBe("busy");
    expect(rule('.loader[data-loader="busy"] > span')).toMatch(/animation:\s*loader-run 2s ease-in-out infinite/);
    const keyframes = /@keyframes loader-run \{([^\n]*)\}\n/.exec(CSS)?.[1] ?? "";
    const properties = new Set([...keyframes.matchAll(/([a-z-]+):/g)].map((property) => property[1]));
    expect([...properties]).toEqual(["transform"]);
    // A bar that runs across, never one that turns round.
    expect(keyframes).not.toMatch(/rotate/);
  });

  test("[engine:browser-authority-for-dev-only] given a known share, when the loader shows, then the bar is filled to it, held between none and all, and the progressbar carries it", () => {
    const { rerender } = render(<Loader label="Getting Ojuelegba ready" percent={42.4} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(bar.dataset["loader"]).toBe("share");
    expect(bar.querySelector("span")?.style.transform).toBe("scaleX(0.42)");
    rerender(<Loader label="Getting Ojuelegba ready" percent={140} />);
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
    rerender(<Loader label="Getting Ojuelegba ready" percent={-5} />);
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    expect(rule('.loader[data-loader="share"] > span')).toMatch(/transition:\s*transform 200ms/);
  });

  test("[engine:browser-authority-for-dev-only] given reduced motion, then the running segment stands still as a full quiet bar and the filling bar jumps without easing", () => {
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{\n((?:[^\n]*\n)*?)\}\n/g;
    const blocks = [...CSS.matchAll(reduced)].map((block) => block[1] ?? "").filter((block) => block.includes(".loader"));
    expect(blocks).toHaveLength(1);
    const busy = rule('.loader[data-loader="busy"] > span', `\n${blocks[0] ?? ""}`);
    expect(busy).toMatch(/width:\s*100%/);
    expect(busy).toMatch(/animation:\s*none/);
    expect(busy).toMatch(/opacity:\s*0\.\d+/);
    expect(rule('.loader[data-loader="share"] > span', `\n${blocks[0] ?? ""}`)).toMatch(/transition:\s*none/);
  });

  test("[engine:browser-authority-for-dev-only] given the bar's colours, then it is the band's ink on the sheet's ground, thin and rounded, and the bar is spans only so it sits inside a line", () => {
    expect(rule(".loader")).toMatch(/background:\s*var\(--sheet-line\)/);
    expect(rule(".loader")).toMatch(/height:\s*4px/);
    expect(rule(".loader")).toMatch(/border-radius:\s*999px/);
    expect(rule(".loader > span")).toMatch(/background:\s*var\(--ink\)/);
    render(<Loader label="Map" small />);
    const bar = screen.getByRole("progressbar");
    expect(bar.tagName).toBe("SPAN");
    expect(bar.querySelectorAll("*").length).toBe(1);
    expect(bar.classList.contains("loader-small")).toBe(true);
  });

  test("[engine:browser-authority-for-dev-only] given the waiting words, then they pulse as the splash's do with the bar right under the first line, and a second line comes under the bar", () => {
    render(<Waiting words="Opening your life..." more="Still opening..." />);
    const column = document.querySelector("[data-waiting]");
    const parts = [...(column?.children ?? [])].map((part) => part.className);
    expect(parts).toEqual(["splash-words", "loader", "splash-more"]);
    expect(column?.querySelector(".splash-words")?.textContent).toBe("Opening your life...");
    expect(rule(".loader-column")).toMatch(/width:\s*max-content/);
  });
});
