// What stands behind the door's figure, as the screens put it there (prologue.md R-PROLOGUE-016): the backdrop under
// everything else on the screen, the band's scrim over it, and the figure, the header and the sheet on top.
import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { SCRIM } from "./backdrop";
import { Gate, GateSheet } from "./Gate";
import { Stand } from "./Stand";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

// The scenes need WebGL, which the test's document lacks: each stands in as a mark of what it would draw.
vi.mock("./BackdropScene", () => ({ default: ({ kind }: { kind: string }) => <div data-backdrop-scene={kind} /> }));
vi.mock("./Turntable", () => ({ default: () => <div data-turntable-scene /> }));
vi.mock("./FrontScene", () => ({ default: () => <div data-front-scene-scene /> }));

beforeAll(() => {
  // A document that says it can draw, so the door puts its scenes up.
  Object.assign(window, { WebGL2RenderingContext: function WebGL2RenderingContext() {} });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as ReturnType<HTMLCanvasElement["getContext"]>);
});

afterAll(() => {
  vi.restoreAllMocks();
  delete (window as { WebGL2RenderingContext?: unknown }).WebGL2RenderingContext;
});

function stand(mark: string) {
  return render(
    <Stand look="chr_ada" mark={mark} head={<div data-head />} name="Ada" caption="The nurse · 22 years old">
      <GateSheet mark={mark}>
        <p>The sheet</p>
      </GateSheet>
    </Stand>,
  );
}

describe("what stands behind the figure", () => {
  test("[R-PROLOGUE-016] given Who are you, when it opens, then the tailor's corner stands behind everything on the screen under the band's translucent scrim, and the figure, the header and the sheet stand over both", async () => {
    stand("you");
    const behind = document.querySelector<HTMLElement>("[data-backdrop]");
    const scrim = document.querySelector<HTMLElement>("[data-scrim]");
    if (behind === null || scrim === null) throw new Error("No backdrop or no scrim.");
    expect(behind.getAttribute("data-backdrop")).toBe("corner");
    expect(await screen.findByText((_, element) => element?.getAttribute("data-backdrop-scene") === "corner")).toBeTruthy();
    // Under everything: first in the screen, behind the screen's own flow, and never in the way of a finger.
    const root = document.querySelector<HTMLElement>("[data-stand]")!;
    expect(root.firstElementChild).toBe(behind);
    expect(behind.nextElementSibling).toBe(scrim);
    for (const layer of [behind, scrim]) {
      expect(layer.className).toContain("-z-10");
      expect(layer.className).toContain("pointer-events-none");
    }
    // The scrim is the theme's own band, see-through: a role, never a colour of its own (R-WORLD-021).
    expect(scrim.className).toContain("band-2");
    expect(Number(scrim.style.opacity)).toBe(SCRIM);
    expect(scrim.getAttribute("style")).not.toMatch(/#|rgb|hsl/);
  });

  test("[R-PROLOGUE-016] given Your life so far and the ready lives, when each opens, then the family compound stands behind the figure under the same scrim", async () => {
    for (const mark of ["life", "ready"]) {
      const { unmount } = stand(mark);
      expect(document.querySelector("[data-backdrop]")?.getAttribute("data-backdrop")).toBe("compound");
      expect(await screen.findByText((_, element) => element?.getAttribute("data-backdrop-scene") === "compound")).toBeTruthy();
      expect(Number(document.querySelector<HTMLElement>("[data-scrim]")?.style.opacity)).toBe(SCRIM);
      unmount();
    }
  });

  test("[R-PROLOGUE-016] given Your page before and after Begin, then the compound is dimmed under the same scrim over the scene and under the page; the prologue's own screens keep the compound as it was", () => {
    for (const mark of ["page", "begun"]) {
      const { unmount } = render(
        <Gate look="chr_ada" mark={mark} over={<div data-over />}>
          <GateSheet mark={mark}>
            <p>The page</p>
          </GateSheet>
        </Gate>,
      );
      const scene = document.querySelector("[data-front-scene]");
      const scrim = document.querySelector<HTMLElement>("[data-scrim]");
      if (scene === null || scrim === null) throw new Error(`No scene or no scrim on ${mark}.`);
      expect(scene.nextElementSibling).toBe(scrim);
      expect(Number(scrim.style.opacity)).toBe(SCRIM);
      expect(scrim.className).toContain("band-2");
      expect(scrim.compareDocumentPosition(document.querySelector("[data-over]")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      unmount();
    }
    for (const mark of ["prologue", "years", "handover"]) {
      const { unmount } = render(
        <Gate look="chr_ada" mark={mark}>
          <p>The card</p>
        </Gate>,
      );
      expect(document.querySelector("[data-scrim]")).toBeNull();
      unmount();
    }
  });
});
