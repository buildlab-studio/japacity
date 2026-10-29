// world:sheets-one-frame: every sheet has one frame: a handle that closes it when dragged down past a third of its height or
// flicked down, one close button at its top right with a hit area of 44 by 44, and a tap on the handle does nothing else. On a
// laptop every sheet rises in the centre. The look's sheet, the world sheet, the account sheet and the ask's card share it.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { type BackStack, createBack } from "../back/back";
import { AskSheet } from "../world/AskSheet";
import { WorldSheet } from "../world/WorldSheet";
import { LookSheet } from "./look/LookSheet";
import { Sheet } from "./Sheet";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

let stack: BackStack;
let now = 0;

beforeEach(() => {
  history.replaceState(null, "", "/");
  stack = createBack(window);
  now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
});

afterEach(() => {
  stack.dispose();
  vi.restoreAllMocks();
});

/** The three sheets and the ask's card, each open, each telling its close to `onClose`. */
const SHEETS: readonly [string, (onClose: () => void) => ReactElement][] = [
  ["the look's sheet", (onClose) => <LookSheet open onOpenChange={(open) => (open ? undefined : onClose())} title="Your study table"><p>Inside</p></LookSheet>],
  ["the world sheet", (onClose) => <WorldSheet open onClose={onClose} label="Label" title="Title" mark="test"><p>Inside</p></WorldSheet>],
  ["the account sheet", (onClose) => <Sheet open onOpenChange={(open) => (open ? undefined : onClose())} title="Settings"><p>Inside</p></Sheet>],
  [
    "the ask's card",
    (onClose) => (
      <AskSheet
        ask={{ form: "card", icon: "food", who: "Mama Put", title: "Eat", line: "Rice and stew.", cost: null, button: "Eat", act: () => undefined, dismiss: onClose }}
        formatMoney={(amount) => String(amount)}
      />
    ),
  ],
];

const HEIGHT = 600;

/** The popup the handle moves, measured as `HEIGHT` tall. */
function popup(): HTMLElement {
  const handle = document.querySelector<HTMLElement>("[data-sheet-handle]");
  const frame = handle?.closest<HTMLElement>("[data-sheet-frame]") ?? null;
  if (frame === null) throw new Error("No sheet frame around the handle.");
  vi.spyOn(frame, "getBoundingClientRect").mockReturnValue({ height: HEIGHT, width: 400, top: 200, bottom: 800, left: 0, right: 400, x: 0, y: 200, toJSON: () => ({}) });
  return frame;
}

/** Drags the handle down by `by` pixels over `ms` milliseconds. */
function drag(by: number, ms: number): void {
  const handle = document.querySelector<HTMLElement>("[data-sheet-handle]");
  if (handle === null) throw new Error("No handle.");
  fireEvent.pointerDown(handle, { pointerId: 1, clientY: 100, button: 0 });
  now += ms;
  fireEvent.pointerMove(handle, { pointerId: 1, clientY: 100 + by });
  fireEvent.pointerUp(handle, { pointerId: 1, clientY: 100 + by });
}

function within(ui: ReactElement) {
  return render(ui);
}

describe.each(SHEETS)("%s", (_name, draw) => {
  test("[world:sheets-one-frame] given it open, then it has one close at its top right with a 44 px hit area, and its handle is no button: a tap on it does nothing", () => {
    const onClose = vi.fn();
    within(draw(onClose));
    const closes = screen.getAllByRole("button", { name: "Close" });
    expect(closes).toHaveLength(1);
    const close = closes[0];
    expect(close?.className).toContain("size-11");
    expect(close?.className).toContain("right-");
    expect(close?.className).toContain("top-");
    const handle = document.querySelector<HTMLElement>("[data-sheet-handle]");
    expect(handle).not.toBeNull();
    expect(handle?.tagName).not.toBe("BUTTON");
    if (handle !== null) fireEvent.click(handle);
    expect(onClose).not.toHaveBeenCalled();
    if (close !== undefined) fireEvent.click(close);
    expect(onClose).toHaveBeenCalled();
  });

  test("[world:sheets-one-frame] given its handle dragged down past a third of its height, then it closes; under a third and slowly, it settles back", () => {
    const onClose = vi.fn();
    within(draw(onClose));
    const frame = popup();
    drag(HEIGHT / 3 - 20, 900);
    expect(onClose).not.toHaveBeenCalled();
    expect(frame.style.transform).toBe("");
    drag(HEIGHT / 3 + 20, 900);
    expect(onClose).toHaveBeenCalled();
  });

  test("[world:sheets-one-frame] given its handle flicked down, then it closes though the drag was short", () => {
    const onClose = vi.fn();
    within(draw(onClose));
    popup();
    drag(60, 40);
    expect(onClose).toHaveBeenCalled();
  });

  test("[world:sheets-one-frame] given a laptop, then it rises in the centre at a phone's width, never from the side", () => {
    within(draw(() => undefined));
    const frame = document.querySelector<HTMLElement>("[data-sheet-frame]");
    expect(frame?.className).toContain("mx-auto");
    expect(frame?.className).toContain("max-w-[430px]");
    expect(frame?.className).toContain("bottom-0");
    expect(frame?.className).not.toMatch(/lg:right-0|lg:inset-y-0/);
  });

  test("[world:back-closes-topmost] given it open, when Back is pressed, then it closes", async () => {
    const onClose = vi.fn();
    within(draw(onClose));
    await waitFor(() => expect((history.state as Record<string, unknown> | null)?.japacityBack).toBe(1));
    act(() => history.back());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

test("[world:sheets-one-frame] given a laptop, then no sheet's motion comes in from the side: the account sheet rises and sinks at the foot as the others do", () => {
  const css = readFileSync(join(import.meta.dirname, "..", "..", "index.css"), "utf8");
  const sheetRules = [...css.matchAll(/\.motion-(sheet|rise|sink)\[data-(starting|ending)-style\][^{]*\{([^}]*)\}/g)].map((match) => match[3] ?? "");
  expect(sheetRules.length).toBeGreaterThan(0);
  expect(sheetRules.filter((body) => body.includes("translateX"))).toEqual([]);
});

/** The nearest ancestor of `element` inside the sheet's popup that scrolls, by its class, or null when none does. */
function scrollerOf(element: Element): HTMLElement | null {
  for (let at = element.parentElement; at !== null && !at.hasAttribute("data-sheet-frame"); at = at.parentElement) {
    if (/\boverflow-y-auto\b/.test(at.className)) return at;
  }
  return null;
}

describe.each([
  ["the world sheet", () => <WorldSheet open onClose={() => undefined} label="Label" title="Title" mark="test" foot={<button type="button">Main</button>}><p>Inside</p></WorldSheet>],
  ["the account sheet", () => <Sheet open onOpenChange={() => undefined} title="Settings" foot={<button type="button">Main</button>}><p>Inside</p></Sheet>],
] as const)("%s's head and foot", (_name, draw) => {
  test("[world:sheets-one-frame] [world:reach-and-read] given a body taller than the sheet, when the body scrolls, then the handle, the title, the close and the foot's main button stay in view: only the body scrolls", () => {
    within(draw());
    const frame = document.querySelector<HTMLElement>("[data-sheet-frame]");
    expect(frame?.className).not.toMatch(/\boverflow-y-auto\b/);
    const inside = screen.getByText("Inside");
    const body = scrollerOf(inside);
    expect(body).not.toBeNull();
    const close = screen.getByRole("button", { name: "Close" });
    const title = screen.getByRole("dialog").querySelector("h2");
    const handle = document.querySelector("[data-sheet-handle]");
    const main = screen.getByRole("button", { name: "Main" });
    for (const fixed of [close, title, handle, main]) {
      expect(fixed).not.toBeNull();
      expect(scrollerOf(fixed!)).toBeNull();
      expect(body!.contains(fixed)).toBe(false);
    }
    // The foot stands under the body, the head over it.
    expect(body!.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(body!.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });
});

