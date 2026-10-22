// The front door's frame (prologue:front-door-three-screens): the head row on the sky's own ground over the body, and the foot
// saying when the body has more below the fold, so a panel cut there reads as a page that scrolls.
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { SHEET_COLUMN_PX } from "../ui/lively/SheetColumn";
import { DoorFrame } from "./DoorFrame";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

/** Gives the body the sizes a browser would lay it out at; the test DOM lays nothing out. */
function sized(body: HTMLElement, { scrollHeight, clientHeight, scrollTop }: { scrollHeight: number; clientHeight: number; scrollTop: number }): void {
  Object.defineProperty(body, "scrollHeight", { configurable: true, value: scrollHeight });
  Object.defineProperty(body, "clientHeight", { configurable: true, value: clientHeight });
  Object.defineProperty(body, "scrollTop", { configurable: true, writable: true, value: scrollTop });
}

describe("the door's frame", () => {
  test("[prologue:front-door-three-screens] given a door screen, then its head row stands on the sky's own ground above the body, so nothing scrolled shows through it", () => {
    render(
      <DoorFrame mark="you" title="Your name" lockup onSkip={() => undefined} at={0} foot={<button type="button">Next</button>}>
        <p>Body</p>
      </DoorFrame>,
    );
    const head = document.querySelector<HTMLElement>("[data-door-progress]")!;
    expect(head.className).toContain("door-sky");
    expect(head.className).toContain("relative");
    expect(head.className).toContain("z-10");
  });

  test("[prologue:front-door-three-screens] given a body taller than its room, when it is scrolled to its end, then the foot says there is more below until the end shows", () => {
    render(
      <DoorFrame mark="life" title="Your life so far" at={1} foot={<button type="button">Next</button>}>
        <p>Body</p>
      </DoorFrame>,
    );
    const body = document.querySelector<HTMLElement>("[data-door-body]")!;
    const foot = document.querySelector<HTMLElement>("[data-door-foot]")!;
    sized(body, { scrollHeight: 1200, clientHeight: 600, scrollTop: 0 });
    fireEvent.scroll(body);
    expect(foot.hasAttribute("data-door-more")).toBe(true);
    expect(foot.querySelector("[data-door-fold]")?.className).toContain("opacity-100");
    sized(body, { scrollHeight: 1200, clientHeight: 600, scrollTop: 600 });
    fireEvent.scroll(body);
    expect(foot.hasAttribute("data-door-more")).toBe(false);
    expect(foot.querySelector("[data-door-fold]")?.className).toContain("opacity-0");
  });

  test("[prologue:front-door-three-screens] given a door screen on a wide screen, then it stands in the door's reading column, the one the start and age sheets use, wider than the thumbs' lane", () => {
    render(
      <DoorFrame mark="page" title="Where you live" onSkip={() => undefined} at={2} foot={<button type="button">Begin</button>}>
        <p>Body</p>
      </DoorFrame>,
    );
    const column = document.querySelector("[data-door-frame] > [data-sheet-column]");
    expect(column).not.toBeNull();
    expect(column?.classList.contains("centred-column")).toBe(true);
    expect(column?.classList.contains(`max-w-[${String(SHEET_COLUMN_PX)}px]`)).toBe(true);
    expect(column?.querySelector("[data-door-body]")).not.toBeNull();
    expect(column?.querySelector("[data-door-foot]")).not.toBeNull();
  });
});
