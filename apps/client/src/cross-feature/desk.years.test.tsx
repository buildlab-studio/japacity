// The years and the handover on a desk (prologue:printed-page-hands-over, prologue:front-door-three-screens): after Begin the desk the door
// stood on stays mounted, the figure and the page on its stage never drawn again; the panel takes the years, the page fills
// through them and prints in place at the handover with the life's thing slapped on it, Go in the foot where Begin stood, and
// Enter is Go. Across the door and the prologue, so it stands here.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { App } from "../app/App";
import { bootGame } from "../authority/boot";
import { stubDesk } from "../shared/testing/desk";
import { say } from "../shared/words/text";
// Registers Testing Library's cleanup for this file.
import "../shared/testing/render";

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

const action = () => document.querySelector<HTMLElement>("[data-door-foot] [data-door-action]");
const gate = (): string | null => document.querySelector("[data-door-desk]")?.getAttribute("data-gate") ?? null;

/** The door on a desk through its three steps to Where you live, the nurse picked and a name rolled. */
async function toWhereYouLive(): Promise<void> {
  render(<App store={bootGame({ storage: localStorage, fastClock: true, makeSeed: () => "desk-years" })} />);
  fireEvent.click(await screen.findByRole("button", { name: say("ui.door.reroll") }));
  fireEvent.click(action()!);
  await waitFor(() => expect(gate()).toBe("life"));
  fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.nurse.name") }));
  fireEvent.click(action()!);
  await waitFor(() => expect(gate()).toBe("page"));
}

describe("the years on a desk", () => {
  test("[prologue:printed-page-hands-over] [prologue:front-door-three-screens] given a desk at Where you live, when Begin is pressed, then the desk stays mounted through the years to the handover: the same band, stage, figure and page, the page printed in place with the life's thing on it, the figure cheering, every step done with no way back, and Go in the foot", async () => {
    stubDesk();
    await toWhereYouLive();
    const desk = document.querySelector("[data-door-desk]");
    const figure = document.querySelector("[data-desk-stage] [data-figure]");
    const page = document.querySelector("[data-desk-page] [data-page]");
    expect(figure?.getAttribute("data-figure-view")).toBe("figure");
    expect(document.querySelector("[data-desk-page] .drop")).toBeNull();
    const begin = action()!;
    fireEvent.click(begin);
    await waitFor(() => expect(gate()).toBe("handover"), { timeout: 10_000 });
    expect(document.querySelector("[data-door-desk]")).toBe(desk);
    expect(document.querySelector("[data-desk-stage] [data-figure]")).toBe(figure);
    expect(document.querySelector("[data-desk-page] [data-page]")).toBe(page);
    // Printed in place: the fields drop in, the life's thing is slapped on the page, and no stamp lands before a visa.
    expect(document.querySelector("[data-desk-page] .drop")).not.toBeNull();
    expect(document.querySelector("[data-desk-page] [data-model]")).not.toBeNull();
    expect(document.querySelector("[data-desk-page] [data-stamp]")).toBeNull();
    expect(figure?.getAttribute("data-figure-view")).toBe("cheer");
    // The band: every step done, none a way back; the panel: the years, Go in the foot where Begin stood.
    expect([...document.querySelectorAll("[data-door-tabs] [data-door-tab]")].map((tab) => tab.getAttribute("data-door-tab"))).toEqual(["done", "done", "done"]);
    expect(document.querySelector("[data-door-tabs] button")).toBeNull();
    expect(document.querySelector("[data-door-panel] [data-years]")).not.toBeNull();
    expect(action()?.textContent).toMatch(new RegExp(`^${say("ui.prologue.start")}`));
    expect(document.querySelector("[data-door-panel] [data-door-foot]")?.contains(action())).toBe(true);
    // No 600 px column after Begin.
    expect(document.querySelector("[data-sheet-column] [data-page]")).toBeNull();
  });

  test("[prologue:printed-page-hands-over] given the handover on a desk, when Enter is pressed, then it is Go: the world opens and the desk is gone", async () => {
    stubDesk();
    await toWhereYouLive();
    fireEvent.click(action()!);
    await waitFor(() => expect(gate()).toBe("handover"), { timeout: 10_000 });
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(document.body, { key: "Enter" });
    await waitFor(() => expect(document.querySelector("[data-door-desk]")).toBeNull(), { timeout: 10_000 });
    expect(document.querySelector("[data-page-handover]")).toBeNull();
  });

  test("[prologue:printed-page-hands-over] given a window that is not a desk, when Begin is pressed, then the years and the handover stand in the door's frame as on a phone, with no desk", async () => {
    render(<App store={bootGame({ storage: localStorage, fastClock: true, makeSeed: () => "desk-years" })} />);
    fireEvent.click(await screen.findByRole("button", { name: say("ui.door.reroll") }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.next")}`) }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${say("ui.door.next")}`) }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${say("ui.door.begin")}`) }));
    await waitFor(() => expect(document.querySelector("[data-page-handover]")).not.toBeNull(), { timeout: 10_000 });
    expect(document.querySelector("[data-door-desk]")).toBeNull();
    expect(document.querySelector("[data-gate='handover'][data-door-frame] [data-sheet-column] [data-page]")).not.toBeNull();
  });
});
