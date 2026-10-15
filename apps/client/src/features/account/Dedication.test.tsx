// The third light on the start screen's wire, the dedication page it opens, and a light of the player's own
// (docs/rules/account.md R-ACCOUNT-032 and R-ACCOUNT-033; world.md R-WORLD-023 for the stillness).
import { DEDICATION, DEDICATION_NICKNAME } from "@japacity/content";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { Dedication, lineRows } from "./Dedication";

const OWNERS_LINE = "Dedicated to my best friend, Osoko Emmanuel (July 1998 to June 2026). From Al-Ameen.";

type Animated = { frames: Keyframe[]; options: KeyframeAnimationOptions; on: Element };

let animated: Animated[] = [];

function moving(reduced: boolean): void {
  animated = [];
  Element.prototype.animate = function (this: Element, frames: Keyframe[] | PropertyIndexedKeyframes | null, options?: number | KeyframeAnimationOptions) {
    animated.push({ frames: frames as Keyframe[], options: options as KeyframeAnimationOptions, on: this });
    return { cancel: () => undefined, startTime: null } as unknown as Animation;
  };
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query.includes("reduce"), addEventListener: () => undefined, removeEventListener: () => undefined }));
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(Element.prototype, "animate");
  delete document.documentElement.dataset.paint;
});

const page = () => screen.queryByRole("dialog", { name: say("ui.dedication.page") });
describe("the dedication page", () => {
  test("[R-ACCOUNT-032] [R-CITY-021] given the page, then it holds the light with soksonjr under it, the owner's line verbatim from content, Sun re o. under the line, one button and a close", () => {
    render(<Dedication open onClose={() => undefined} />);
    const shown = page()!;
    expect(DEDICATION).toBe(OWNERS_LINE);
    expect(DEDICATION_NICKNAME).toBe("soksonjr");
    expect(shown.querySelector("[data-dedication-name]")?.textContent).toBe("soksonjr");
    expect(shown.querySelector("[data-dedication-line]")?.textContent).toBe(OWNERS_LINE);
    // Set in the design's four rows, cut from content's own line, never retyped.
    expect(lineRows(DEDICATION)).toHaveLength(4);
    expect(lineRows(DEDICATION).join("")).toBe(DEDICATION);
    expect(lineRows("A line with none of the marks")).toEqual(["A line with none of the marks"]);
    const rest = shown.querySelector("[data-dedication-rest]")!;
    expect(rest.textContent).toBe("Sun re o.");
    expect(shown.querySelector("[data-dedication-line]")?.compareDocumentPosition(rest)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(shown.querySelector("[data-dedication-glow='big']")).not.toBeNull();
    const buttons = within(shown).getAllByRole("button");
    expect(buttons.map((button) => button.textContent || button.getAttribute("aria-label"))).toEqual(["Light one for yours", "Close"]);
    // The page is the night's navy at any hour.
    expect(shown.dataset.paint).toBe("night");
  });

  test("[R-ACCOUNT-032] given the page open, when close is tapped, then it closes", () => {
    const closed = vi.fn();
    render(<Dedication open onClose={closed} />);
    fireEvent.click(within(page()!).getByRole("button", { name: "Close" }));
    expect(closed).toHaveBeenCalledTimes(1);
  });

  test("[R-ACCOUNT-032] [R-WORLD-023] given reduced motion, then the page's light holds still; otherwise it breathes by opacity alone", () => {
    moving(true);
    const still = render(<Dedication open onClose={() => undefined} />);
    expect(animated).toHaveLength(0);
    still.unmount();
    moving(false);
    render(<Dedication open onClose={() => undefined} />);
    expect(animated.length).toBeGreaterThan(0);
    for (const { frames } of animated) for (const frame of frames) expect(Object.keys(frame).filter((key) => key !== "offset")).toEqual(["opacity"]);
  });
});

/** Opens the sheet from the page and fills it in. */
function fill(name: string, from = "", to = ""): HTMLElement {
  fireEvent.click(within(page()!).getByRole("button", { name: "Light one for yours" }));
  const sheet = screen.getByRole("dialog", { name: "Light one for yours" });
  fireEvent.change(within(sheet).getByRole("textbox", { name: "Their name" }), { target: { value: name } });
  fireEvent.change(within(sheet).getByRole("textbox", { name: "First year" }), { target: { value: from } });
  fireEvent.change(within(sheet).getByRole("textbox", { name: "Last year" }), { target: { value: to } });
  return sheet;
}

const lightIt = (sheet: HTMLElement) => within(sheet).getByRole("button", { name: "Light it" });
const problems = (sheet: HTMLElement) => [...sheet.querySelectorAll("[data-light-problem]")].map((line) => line.textContent);

describe("light one for yours", () => {
  test("[R-ACCOUNT-033] given the sheet, then it asks a name and the years if wanted, says the light stays on this phone, and Light it waits for a name", () => {
    render(<Dedication open onClose={() => undefined} year={2026} />);
    const sheet = fill("");
    expect(within(sheet).getByRole("textbox", { name: "Their name" }).getAttribute("maxlength")).toBe("40");
    expect(within(sheet).getByRole("group", { name: "Years, if you want" })).not.toBeNull();
    expect(sheet.textContent).toContain("Kept on this phone only. Nobody else sees it.");
    expect(lightIt(sheet)).toHaveProperty("disabled", true);
    expect(problems(sheet)).toEqual([]);
  });

  test("[R-ACCOUNT-033] given the sheet's limits at each edge, then four words light and five say so; 1900 and this year light, 1899 and next year say so; an end before the start says so", () => {
    render(<Dedication open onClose={() => undefined} year={2026} />);
    const sheet = fill("Mama Nkechi Grace Obi", "1900", "2026");
    expect(lightIt(sheet)).toHaveProperty("disabled", false);
    expect(problems(sheet)).toEqual([]);
    fireEvent.change(within(sheet).getByRole("textbox", { name: "Their name" }), { target: { value: "Mama Nkechi Grace Obi Ade" } });
    expect(problems(sheet)).toEqual(["Four words at most."]);
    expect(lightIt(sheet)).toHaveProperty("disabled", true);
    fireEvent.change(within(sheet).getByRole("textbox", { name: "Their name" }), { target: { value: "Mama Nkechi" } });
    fireEvent.change(within(sheet).getByRole("textbox", { name: "First year" }), { target: { value: "1899" } });
    expect(problems(sheet)).toEqual(["A year from 1900 to 2026."]);
    fireEvent.change(within(sheet).getByRole("textbox", { name: "First year" }), { target: { value: "1951" } });
    fireEvent.change(within(sheet).getByRole("textbox", { name: "Last year" }), { target: { value: "2027" } });
    expect(problems(sheet)).toEqual(["A year from 1900 to 2026."]);
    fireEvent.change(within(sheet).getByRole("textbox", { name: "Last year" }), { target: { value: "1950" } });
    expect(problems(sheet)).toEqual(["The last year cannot come before the first."]);
    fireEvent.change(within(sheet).getByRole("textbox", { name: "Last year" }), { target: { value: "1951" } });
    expect(problems(sheet)).toEqual([]);
  });

  test("[R-ACCOUNT-033] given a name and years, when Light it is pressed, then the light hangs beside the big one with its words under it, and no button offers a second", async () => {
    const fetching = vi.spyOn(globalThis, "fetch");
    render(<Dedication open onClose={() => undefined} year={2026} />);
    const sheet = fill("Mama Nkechi", "1951", "2024");
    await act(async () => {
      fireEvent.click(lightIt(sheet));
      await Promise.resolve();
    });
    const shown = page()!;
    expect(shown.querySelector("[data-own-light-words]")?.textContent).toBe("Mama Nkechi, 1951 to 2024");
    expect(shown.querySelector("[data-dedication-glow='own']")).not.toBeNull();
    // Under the owner's: the big light keeps its name and line, and the player's light follows it.
    expect(shown.querySelector("[data-dedication-name]")?.textContent).toBe("soksonjr");
    expect(shown.querySelector("[data-dedication-name]")?.compareDocumentPosition(shown.querySelector("[data-own-light-words]")!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(shown).queryByRole("button", { name: "Light one for yours" })).toBeNull();
    expect(shown.querySelector("[data-dedication-kept]")?.textContent).toBe("Kept on this phone only. Nobody else sees it.");
    expect(fetching).not.toHaveBeenCalled();
  });

  test("[R-ACCOUNT-033] given a light lit, when it is tapped on the page, then Put it out shows, and pressing it removes the light and the page offers to light one again", async () => {
    render(<Dedication open onClose={() => undefined} year={2026} />);
    const sheet = fill("Mama Nkechi", "1951", "2024");
    await act(async () => {
      fireEvent.click(lightIt(sheet));
      await Promise.resolve();
    });
    const shown = page()!;
    expect(within(shown).queryByRole("button", { name: "Put it out" })).toBeNull();
    fireEvent.click(within(shown).getByRole("button", { name: "Mama Nkechi, 1951 to 2024" }));
    fireEvent.click(within(shown).getByRole("button", { name: "Put it out" }));
    expect(shown.querySelector("[data-own-light-words]")).toBeNull();
    expect(within(shown).getByRole("button", { name: "Light one for yours" })).not.toBeNull();
  });
});
