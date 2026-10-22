import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { COUNT_MS, Counter } from "./TopBand";
import { CUT_MS } from "./Cut";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const SRC = join(import.meta.dirname, "..", "..");
const CSS = readFileSync(join(SRC, "index.css"), "utf8");
/** The shell's motion classes in index.css, each named for its own keyframes. */
const MOTIONS = ["rise", "fade", "pop", "drop", "phone-up", "chip-in"] as const;
const HALF_SECOND_MS = 500;

/** A motion class's duration in milliseconds, read from its rule in index.css. */
function durationOf(motion: string): number {
  const found = new RegExp(`\\n\\.${motion} \\{ animation: ${motion} ([\\d.]+)s`).exec(CSS);
  if (found?.[1] === undefined) throw new Error(`No rule for .${motion} in index.css`);
  return Math.round(Number(found[1]) * 1000);
}

/** The reduced-motion block that recasts the motion classes. */
function reducedBlock(): string {
  // Each block runs to the first line that is a lone closing brace.
  const blocks = CSS.split("@media (prefers-reduced-motion: reduce)")
    .slice(1)
    .map((part) => part.slice(0, part.indexOf("\n}")));
  const block = blocks.find((part) => part.includes(".rise"));
  if (block === undefined) throw new Error("No reduced-motion block for the motion classes");
  return block;
}

describe("every shell motion is under half a second", () => {
  test.each(MOTIONS)("[world:motions-under-half-second] given the .%s class, when its animation is read, then it lasts under 500 ms", (motion) => {
    expect(durationOf(motion)).toBeLessThan(HALF_SECOND_MS);
  });

  test("[world:motions-under-half-second] given the money counter and the cut, then each takes under 500 ms", () => {
    expect(COUNT_MS).toBeLessThan(HALF_SECOND_MS);
    expect(CUT_MS).toBeLessThan(HALF_SECOND_MS);
  });

  test("[world:motions-under-half-second] given the shell's own components, when their transition durations are read, then none reaches 500 ms", () => {
    const folders = [join(SRC, "shared", "world"), join(SRC, "features", "turn")];
    const files = folders.flatMap((folder) => readdirSync(folder).filter((name) => name.endsWith(".tsx") && !name.includes(".test.")).map((name) => join(folder, name)));
    const durations = files.flatMap((file) => [...readFileSync(file, "utf8").matchAll(/duration-(\d+)/g)].map((match) => ({ file, ms: Number(match[1]) })));
    expect(durations.length).toBeGreaterThan(0);
    expect(durations.filter(({ ms }) => ms >= HALF_SECOND_MS)).toEqual([]);
  });
});

describe("reduced motion cuts to a fade", () => {
  test.each(MOTIONS)("[world:motions-under-half-second] given reduced motion, when .%s runs, then it is the fade, under 500 ms, and wins over the rule that stops every animation", (motion) => {
    const block = reducedBlock();
    const rule = /\{ animation: fade ([\d.]+)s ease both !important; \}/.exec(block);
    expect(block).toContain(`.${motion}`);
    expect(rule).not.toBeNull();
    expect(Math.round(Number(rule?.[1]) * 1000)).toBeLessThan(HALF_SECOND_MS);
  });

  test("[world:motions-under-half-second] given reduced motion, when the money changes, then the counter lands on the new figure at once", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    const format = (value: number): string => `N${String(value)}`;
    const { rerender } = render(<Counter value={100} format={format} />);
    rerender(<Counter value={900} format={format} />);
    expect(screen.getByText("N900")).toBeTruthy();
  });
});
