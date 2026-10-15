// The plane cut (docs/rules/world.md R-WORLD-037): the painted map at night, one layer over it with the plane on its
// dashed line and the city's sticker; the plane moves by transform alone for the cut's time, and stands still at the
// line's end under reduced motion. Nothing but the plane and the line is drawn over the paper the map already has.
import { render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { along, PlaneCut, planePath, STILL_AT } from "./PlaneCut";

vi.mock("../../../shared/three/manifest", async (original) => ({ ...(await original<typeof import("../../../shared/three/manifest")>()), loadManifest: () => Promise.resolve({ files: {} }) }));

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
});

/** The page's answer to reduced motion: asked for, or not. */
function motion(reduced: boolean): void {
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: reduced, addEventListener: () => undefined, removeEventListener: () => undefined }) });
}

const SLOT = { country: "country.uk", city: "London", small: "One way from Lagos", line: "The plane lifts off. Lagos gets small.", ms: 3000 };

describe("the plane cut", () => {
  test("[R-WORLD-037] given reduced motion, then the night paper, the dashed line, the plane standing still at the line's end and the city's sticker show, with no animation", () => {
    motion(true);
    const animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
    const { container } = render(<PlaneCut {...SLOT} />);
    expect(container.querySelector("[data-plane-cut]")?.getAttribute("data-plane-cut")).toBe("still");
    expect(container.querySelector(".paper[data-paint='night'] [data-paper-svg]")).not.toBeNull();
    expect(container.querySelector("[data-plane-line] path")?.getAttribute("stroke-dasharray")).toBeTruthy();
    expect(container.querySelector("[data-plane-at]")?.getAttribute("data-plane-at")).toBe("still");
    expect(container.querySelector("[data-plane-city]")?.textContent).toContain("London");
    expect(animate).not.toHaveBeenCalled();
    // Still at the line's visible end: high on the screen, past halfway along it.
    const { at } = along(planePath("country.uk"), STILL_AT);
    expect(at[1]).toBeGreaterThan(0);
    expect(at[1]).toBeLessThan(844 / 2);
  });

  test("[R-WORLD-037] given motion, then the plane lifts along the line once, for the cut's time, by transform keyframes alone", () => {
    motion(false);
    const animate = vi.fn(() => ({ cancel: () => undefined }));
    Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
    const { container } = render(<PlaneCut {...SLOT} />);
    expect(container.querySelector("[data-plane-cut]")?.getAttribute("data-plane-cut")).toBe("moving");
    expect(animate).toHaveBeenCalledTimes(1);
    const [frames, timing] = animate.mock.calls[0] as unknown as [Record<string, string>[], KeyframeAnimationOptions];
    expect(frames.length).toBeGreaterThan(2);
    for (const frame of frames) expect(Object.keys(frame)).toEqual(["transform"]);
    expect(timing.duration).toBe(SLOT.ms);
  });

  test("[R-WORLD-037] given each country, then the line leaves the airport and runs off the top of the screen, leaning the way the country lies", () => {
    for (const country of ["country.uk", "country.canada", "country.uae", "country.italy"]) {
      const path = planePath(country);
      expect(path.from[1]).toBeGreaterThan(path.to[1]);
      expect(path.to[1]).toBeLessThan(0);
    }
    expect(planePath("country.uae").to[0]).toBeGreaterThan(planePath("country.uae").from[0]);
    expect(planePath("country.canada").to[0]).toBeLessThan(planePath("country.canada").from[0]);
  });
});
