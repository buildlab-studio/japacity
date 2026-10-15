// The third light on the start screen's wire, the dedication page it opens, and a light of the player's own
// (docs/rules/account.md R-ACCOUNT-032 and R-ACCOUNT-033; world.md R-WORLD-023 for the stillness).
import { DEDICATION, DEDICATION_NICKNAME } from "@japacity/content";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { countInto } from "../../shared/analytics/start";
import { forgetOwnLightRead, OWN_LIGHT_KEY, readOwnLight } from "../../shared/frontdoor/ownLight";
import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { BREATH_MS } from "./bulb";
import { Dedication, lineRows } from "./Dedication";
import { OWN_ON_WIRE, THIRD, ThirdLight } from "./ThirdLight";
import { ABROAD, TwoLights } from "./TwoLights";

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

beforeEach(() => {
  forgetOwnLightRead();
});

afterEach(() => {
  localStorage.clear();
  forgetOwnLightRead();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(Element.prototype, "animate");
  delete document.documentElement.dataset.paint;
});

const page = () => screen.queryByRole("dialog", { name: say("ui.dedication.page") });
const thirdTap = () => document.querySelector<HTMLElement>("[data-third-light-tap]")!;

function keepLight(light: { name: string; from: number | null; to: number | null }): void {
  localStorage.setItem(OWN_LIGHT_KEY, JSON.stringify(light));
  forgetOwnLightRead();
}

describe("the third light", () => {
  test("[R-ACCOUNT-032] given the start screen's wire, then a third small light hangs past abroad, says nothing until tapped, and the two lights stay a picture nothing in can be tapped", () => {
    render(
      <div className="relative">
        <TwoLights shown={{ from: "server", home: 700, abroad: 150 }} />
        <ThirdLight />
      </div>,
    );
    expect(THIRD.x).toBeGreaterThan(ABROAD.x);
    const layer = document.querySelector<HTMLElement>("[data-third-light]")!;
    // Small: smaller than the two lights' glass (14).
    expect(THIRD.r).toBeLessThan(14);
    // It says nothing: no words on the screen, only its name for a screen reader, and one way to tap it.
    expect(layer.textContent).toBe("");
    expect(within(layer).getAllByRole("button")).toEqual([thirdTap()]);
    expect(thirdTap().getAttribute("aria-label")).toBe(say("ui.dedication.light"));
    // The two lights' picture is untouched: it holds nothing to tap.
    const lights = document.querySelector<HTMLElement>("[data-two-lights]")!;
    expect(lights.contains(layer)).toBe(false);
    expect(lights.querySelectorAll("button, a, input, [role='button']")).toHaveLength(0);
    expect(page()).toBeNull();
  });

  test("[R-ACCOUNT-032] given the night, then the third light is drawn exactly as by day: warm, and never out", () => {
    const day = render(<ThirdLight />);
    const byDay = document.querySelector("[data-third-light]")!.innerHTML;
    expect(document.querySelector("[data-dedication-glow='third']")).not.toBeNull();
    day.unmount();
    document.documentElement.dataset.paint = "night";
    render(<ThirdLight />);
    expect(document.querySelector("[data-third-light]")!.innerHTML).toBe(byDay);
    expect(document.querySelector<HTMLElement>("[data-dedication-glow='third']")!.style.background).toContain("radial-gradient");
  });

  test("[R-ACCOUNT-032] [R-WORLD-023] given motion, then the glow breathes about every four seconds by opacity alone; given reduced motion, then it is drawn and holds still", () => {
    moving(false);
    const live = render(<ThirdLight />);
    expect(animated).toHaveLength(1);
    const [breath] = animated;
    expect(breath!.on).toBe(document.querySelector("[data-dedication-glow='third']"));
    expect(breath!.options).toMatchObject({ duration: BREATH_MS, iterations: Infinity, direction: "alternate" });
    expect(BREATH_MS).toBe(4_000);
    for (const frame of breath!.frames) expect(Object.keys(frame).filter((key) => key !== "offset")).toEqual(["opacity"]);
    live.unmount();

    moving(true);
    render(<ThirdLight />);
    expect(animated).toHaveLength(0);
    const glow = document.querySelector<HTMLElement>("[data-dedication-glow='third']")!;
    expect(glow.hasAttribute("data-still")).toBe(true);
  });

  test("[R-ACCOUNT-032] given the third light, when it is tapped, then the dedication page opens; nothing is counted and nothing is sent", async () => {
    const counted: string[] = [];
    const quiet = countInto({ count: (event: string, key?: string) => void counted.push(`${event} ${key ?? ""}`) } as unknown as Parameters<typeof countInto>[0]);
    const fetching = vi.spyOn(globalThis, "fetch");
    const beacon = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, sendBeacon: beacon });
    render(<ThirdLight />);
    expect(page()).toBeNull();
    fireEvent.click(thirdTap());
    // The page comes in its own chunk on the first tap.
    expect(await screen.findByRole("dialog", { name: say("ui.dedication.page") })).not.toBeNull();
    expect(counted).toEqual([]);
    expect(fetching).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
    quiet();
  });
});

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

  test("[R-ACCOUNT-033] given a name and years, when Light it is pressed, then the light is kept on the device only, hangs beside the big one with its words under it, and no button offers a second", async () => {
    const fetching = vi.spyOn(globalThis, "fetch");
    render(<Dedication open onClose={() => undefined} year={2026} />);
    const sheet = fill("Mama Nkechi", "1951", "2024");
    await act(async () => {
      fireEvent.click(lightIt(sheet));
      await Promise.resolve();
    });
    expect(readOwnLight()).toEqual({ name: "Mama Nkechi", from: 1951, to: 2024 });
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

  test("[R-ACCOUNT-033] given a light kept, when it is tapped on the page, then Put it out shows, and pressing it removes the light from the device and the page offers to light one again", () => {
    keepLight({ name: "Mama Nkechi", from: 1951, to: 2024 });
    render(<Dedication open onClose={() => undefined} />);
    const shown = page()!;
    expect(within(shown).queryByRole("button", { name: "Put it out" })).toBeNull();
    fireEvent.click(within(shown).getByRole("button", { name: "Mama Nkechi, 1951 to 2024" }));
    fireEvent.click(within(shown).getByRole("button", { name: "Put it out" }));
    expect(localStorage.getItem(OWN_LIGHT_KEY)).toBeNull();
    expect(shown.querySelector("[data-own-light-words]")).toBeNull();
    expect(within(shown).getByRole("button", { name: "Light one for yours" })).not.toBeNull();
  });

  test("[R-ACCOUNT-033] given a light kept, then it hangs on the start screen's wire beside the third light, smaller, and its name and years show on tap", () => {
    keepLight({ name: "Mama Nkechi", from: 1951, to: 2024 });
    render(<ThirdLight />);
    expect(OWN_ON_WIRE.r).toBeLessThan(THIRD.r);
    expect(Math.abs(OWN_ON_WIRE.x - THIRD.x)).toBeLessThan(48);
    expect(document.querySelector("[data-dedication-glow='own']")).not.toBeNull();
    expect(document.querySelector("[data-own-light-name]")).toBeNull();
    const own = screen.getByRole("button", { name: "Mama Nkechi, 1951 to 2024" });
    fireEvent.click(own);
    expect(document.querySelector("[data-own-light-name]")?.textContent).toBe("Mama Nkechi, 1951 to 2024");
    fireEvent.click(own);
    expect(document.querySelector("[data-own-light-name]")).toBeNull();
  });

  test("[R-ACCOUNT-033] given a light lit on the page opened from the wire, then the wire shows it at once; put out, then it is gone from the wire", async () => {
    render(<ThirdLight />);
    expect(document.querySelector("[data-own-light='wire']")).toBeNull();
    fireEvent.click(thirdTap());
    await screen.findByRole("dialog", { name: say("ui.dedication.page") });
    const sheet = fill("Mama Nkechi");
    await act(async () => {
      fireEvent.click(lightIt(sheet));
      await Promise.resolve();
    });
    expect(document.querySelector("[data-own-light='wire']")?.getAttribute("aria-label")).toBe("Mama Nkechi");
    fireEvent.click(within(page()!).getByRole("button", { name: "Mama Nkechi" }));
    fireEvent.click(within(page()!).getByRole("button", { name: "Put it out" }));
    expect(document.querySelector("[data-own-light='wire']")).toBeNull();
  });
});
