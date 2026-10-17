// The standard for state changes (docs/rules/world.md R-WORLD-023): what opens, closes,
// appears or expands moves by a plain CSS transition on transform and opacity only, 150 to 250 ms, never on a layout
// property; the shared sheets and cards carry it, so every screen built on them does.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { WorldSheet } from "../world/WorldSheet";
import { FullScreen } from "./FullScreen";
import { invertedTransform, motionOn, motionReduced, useMotionReduced } from "./motion";
import { stubReducedMotion } from "../testing/motion";
import { Sheet } from "./Sheet";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const SRC = join(import.meta.dirname, "..", "..");
const CSS = readFileSync(join(SRC, "index.css"), "utf8");
const COMPOSITOR = new Set(["transform", "opacity"]);
/** The shared overlays and the components that open over the world, as files. */
const SHARED = ["shared/ui/Sheet.tsx", "shared/ui/FullScreen.tsx", "shared/world/WorldSheet.tsx", "shared/world/AskSheet.tsx", "features/moment/MomentCard.tsx", "features/phone/Phone.tsx"];

/** The declarations of every rule whose selector names `.name`, outside @starting-style. */
function rulesOf(name: string): string[] {
  const found: string[] = [];
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of CSS.matchAll(rule)) {
    const selector = match[1] ?? "";
    if (new RegExp(`\\.${name}(?![\\w-])`).test(selector)) found.push(match[2] ?? "");
  }
  return found;
}

/** The properties a rule's transition names, and its duration in ms, or null when it sets no transition. */
function transitionOf(declarations: string): { properties: string[]; ms: number } | null {
  const properties = /transition-property:\s*([^;]+);/.exec(declarations)?.[1];
  const duration = /transition-duration:\s*(\d+)ms;/.exec(declarations)?.[1];
  if (properties === undefined) return /(^|;)\s*transition:/.test(declarations) ? { properties: ["(shorthand)"], ms: 0 } : null;
  return { properties: properties.split(",").map((each) => each.trim()), ms: Number(duration ?? "0") };
}

/** The motion classes a source file uses. */
function motionClasses(file: string): string[] {
  const source = readFileSync(join(SRC, file), "utf8");
  return [...new Set([...source.matchAll(/\b(motion-[a-z-]+)\b/g)].map((match) => match[1] ?? ""))].filter((name) => name !== "" && name !== "motion-ts");
}

describe("state changes move on the compositor (R-WORLD-023)", () => {
  test("[R-WORLD-023] given every motion class in index.css, when its transition is read, then it names transform or opacity only and lasts 150 to 250 ms", () => {
    const names = [...new Set([...CSS.matchAll(/\.(motion-[a-z-]+)/g)].map((match) => match[1] ?? ""))];
    expect(names.length).toBeGreaterThanOrEqual(8);
    const wrong: string[] = [];
    for (const name of names) {
      const transitions = rulesOf(name).map(transitionOf).filter((each) => each !== null);
      if (transitions.length === 0) wrong.push(`${name}: no transition`);
      for (const { properties, ms } of transitions) {
        for (const property of properties) if (!COMPOSITOR.has(property)) wrong.push(`${name}: ${property}`);
        if (ms < 150 || ms > 250) wrong.push(`${name}: ${String(ms)} ms`);
      }
    }
    expect(wrong).toEqual([]);
  });

  test("[R-WORLD-023] given the folded rows, when their transition is read, then it is on transform and opacity only, from just above, in 150 to 250 ms", () => {
    const rule = /\ndetails > :not\(summary\) \{([^}]*)\}/.exec(CSS)?.[1] ?? "";
    const transition = transitionOf(rule);
    expect(transition?.properties).toEqual(["transform", "opacity"]);
    expect(transition?.ms).toBeGreaterThanOrEqual(150);
    expect(transition?.ms).toBeLessThanOrEqual(250);
    expect(CSS).toContain("@starting-style { details[open] > :not(summary)");
  });

  test.each(SHARED)("[R-WORLD-023] given %s, when its classes are read, then every transition it declares is a motion class on transform or opacity, and none animates a layout property", (file) => {
    // The code only: comments say "transition" in words.
    const source = readFileSync(join(SRC, file), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(motionClasses(file).length).toBeGreaterThan(0);
    expect(motionClasses(file).filter((name) => rulesOf(name).length === 0)).toEqual([]);
    // No utility transition of its own: a bare `transition`, `transition-all`, or a list naming anything but transform and opacity.
    const utilities = [...source.matchAll(/(?<![.\w-])transition(-[\w[\],-]+)?(?=[\s"`])/g)].map((match) => match[0]);
    const listed = utilities.flatMap((utility) => /^transition-\[(.+)\]$/.exec(utility)?.[1]?.split(",") ?? (utility === "transition-transform" || utility === "transition-opacity" ? [] : [utility]));
    expect(listed.filter((property) => !COMPOSITOR.has(property))).toEqual([]);
  });

  test("[R-WORLD-023] given the shared sheet open, then its backdrop fades and its panel rises by the motion classes, and Base UI marks their first frame", () => {
    render(
      <Sheet open onOpenChange={() => undefined} title="A sheet">
        <p>Body</p>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("motion-sheet");
    expect(document.querySelector(".motion-scrim")).not.toBeNull();
  });

  test("[R-WORLD-023] given a world sheet and a full-screen card open, then each carries its motion class: the world sheet sinks back, the full screen fades", () => {
    render(
      <WorldSheet open onClose={() => undefined} label="Label" title="Title" mark="test">
        <p>Body</p>
      </WorldSheet>,
    );
    expect(document.querySelector("[data-world-sheet='test']")?.className).toContain("motion-sink");
    cleanup();
    render(
      <FullScreen open onClose={() => undefined} title="Moment">
        <p>Card</p>
      </FullScreen>,
    );
    expect(screen.getByRole("dialog").className).toContain("motion-scrim");
  });

  test("[R-WORLD-023] given reduced motion, then nothing waits on a motion: the page says none is drawn, and every transition is cut", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    expect(motionOn()).toBe(false);
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    expect(motionOn()).toBe(true);
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\*,\s*\*::before,\s*\*::after \{\s*transition: none !important;/);
  });

  test("[R-WORLD-023] given the phone's reduced-motion setting, when the helper reads it, then it says so; where the page cannot answer it says no, so the camera's own ease goes on as before", () => {
    stubReducedMotion(true);
    expect(motionReduced()).toBe(true);
    expect(motionOn()).toBe(false);
    stubReducedMotion(false);
    expect(motionReduced()).toBe(false);
    expect(motionOn()).toBe(true);
    vi.stubGlobal("matchMedia", undefined);
    expect(motionReduced()).toBe(false);
    expect(motionOn()).toBe(false);
  });

  test("[R-WORLD-023] given the game open, when the player turns reduced motion on and off in their phone's settings, then the frame loop's reading follows at once", () => {
    const setting = stubReducedMotion(false);
    const seen: { current: boolean | null } = { current: null };
    function Reader() {
      const reduced = useMotionReduced();
      seen.current = reduced.current;
      return <p data-reduced={String(reduced.current)}>{String(reduced.current)}</p>;
    }
    const { rerender } = render(<Reader />);
    expect(seen.current).toBe(false);
    act(() => setting.set(true));
    rerender(<Reader />);
    expect(seen.current).toBe(true);
    act(() => setting.set(false));
    rerender(<Reader />);
    expect(seen.current).toBe(false);
  });

  test("[R-WORLD-018] [R-WORLD-023] given a box laid out where another stood, when it is inverted, then the transform draws it back over the first box, turned as it stood, in the functions the resting transforms use", () => {
    const first = { x: 36, y: 227, width: 340, height: 600 };
    const last = { x: 8, y: 8, width: 396, height: 823 };
    expect(invertedTransform(first, last, -2)).toBe(`translate(0px, ${String(227 + 300 - (8 + 411.5))}px) rotate(-2deg) scale(${String(340 / 396)}, ${String(600 / 823)})`);
    expect(invertedTransform(last, last, 0)).toBe("translate(0px, 0px) rotate(0deg) scale(1, 1)");
    for (const rest of ["handset-rest", "handset-grown", "handset-away"]) expect(rulesOf(rest).join("")).toMatch(/transform: translate\([^)]+\) rotate\([^)]+\) scale\([^)]+\);/);
  });
});
