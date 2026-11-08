// The front door on a desk (prologue:front-door-three-screens, prologue:printed-page-hands-over, prologue:front-door-builds-a-person): one
// layout that stays mounted while the steps change, the steps as tabs in a band, the figure and the travel data page on the
// stage filling in as the run stands, every look and every life at once in the panel, the yellow action in the panel's foot,
// and the keys. A window that is not a desk keeps the phone's screens.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { createGameStore } from "../../authority/store";
import { readDoor } from "../../shared/datapage/door";
import { DeskHost } from "../../shared/front-door/DeskHost";
import { ARCHETYPES } from "../../shared/front-door/archetypes";
import { LOOKS } from "../../shared/front-door/looks";
import { stubDesk } from "../../shared/testing/desk";
import { say } from "../../shared/words/text";
import { type DoorGuest, FrontDoor } from "./FrontDoor";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** A guest start that takes any username, for the username box on Where you live. */
const GUEST: DoorGuest = {
  check: () => null,
  fields: (value, onChange) => <input aria-label="Username" value={value} onChange={(event) => onChange(event.target.value)} data-first-field />,
  reminder: null,
  reveal: () => undefined,
  start: () => Promise.resolve(null),
  started: () => Promise.resolve(),
  lost: () => null,
};

function door(guest: DoorGuest | null = null): void {
  const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "desk-seed", now: () => 0 });
  const store = createGameStore(authority, { life: authority, lifeAgain: true, choosingLife: true });
  render(
    <GameProvider store={store}>
      <DeskHost>
        <FrontDoor guest={guest} />
      </DeskHost>
    </GameProvider>,
  );
}

const stage = (): string | null => document.querySelector("[data-gate]")?.getAttribute("data-gate") ?? null;
const field = (id: string): string => document.querySelector(`[data-desk-page] [data-field='${id}']`)?.lastElementChild?.textContent ?? "";
const nameBox = () => screen.getByRole<HTMLInputElement>("textbox", { name: say("prologue.door.name.title") });
const action = () => document.querySelector<HTMLElement>("[data-door-foot] [data-door-action]")!;
const picked = (group: string): string | null => document.querySelector(`[${group}] [role='radio'][aria-checked='true']`)?.getAttribute(group === "data-looks" ? "data-look" : "data-archetype") ?? null;
const press = (key: string, on: Element = document.body): void => {
  fireEvent.keyDown(on, { key });
};

describe("the door on a desk", () => {
  test("[prologue:front-door-three-screens] given a window that is not a desk, when the door opens, then the phone's screen stands: its column and dots, no band of steps and no stage", () => {
    door();
    expect(stage()).toBe("you");
    expect(document.querySelector("[data-door-desk]")).toBeNull();
    expect(document.querySelector("[data-door-dots]")).not.toBeNull();
    expect(document.querySelector("[data-sheet-column]")).not.toBeNull();
  });

  test("[prologue:front-door-three-screens] given a desk, when the door opens, then the band holds Back's place, the lockup and the three steps as tabs named by their headings with the first now, the stage holds the figure and the page, and the panel holds the heading, every look at once with Make it yours open, and the yellow action at its foot", () => {
    stubDesk();
    door();
    expect(stage()).toBe("you");
    expect(document.querySelector("[data-door-desk]")).not.toBeNull();
    expect(document.querySelector("[data-door-dots]")).toBeNull();
    const tabs = [...document.querySelectorAll("[data-door-tabs] li")].map((tab) => tab.textContent);
    expect(tabs).toEqual([`1${say("ui.life.title")}`, `2${say("ui.door.life")}`, `3${say("ui.door.home")}`]);
    expect(document.querySelector("[data-door-tabs] [aria-current='step']")?.textContent).toBe(`1${say("ui.life.title")}`);
    expect(screen.getAllByRole("img", { name: say("ui.game") })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(say("ui.life.title"));
    expect(document.querySelector("[data-desk-stage] [data-figure]")).not.toBeNull();
    expect(document.querySelector("[data-desk-stage] [data-page]")).not.toBeNull();
    // Every look at once, as a grid, never a strip that scrolls sideways.
    expect(document.querySelectorAll("[data-looks] [role='radio']")).toHaveLength(LOOKS.length);
    expect(document.querySelector("[data-looks]")?.hasAttribute("data-looks-grid")).toBe(true);
    expect(document.querySelector("[data-yours-open]")?.getAttribute("aria-expanded")).toBe("true");
    expect(action().textContent).toMatch(new RegExp(`^${say("ui.door.next")}`));
    expect(document.querySelector("[data-door-panel] [data-door-action]")).toBe(action());
  });

  test("[prologue:front-door-builds-a-person] [prologue:printed-page-hands-over] given a desk with the name box empty, then the page's name row is its dots, never the suggestion, and the box holds the focus; a name typed is printed on the page as it is typed", () => {
    stubDesk();
    door();
    expect(nameBox().value).toBe("");
    expect(nameBox().placeholder).not.toBe("");
    expect(field("name")).toBe(say("prologue.page.empty"));
    expect(document.querySelector("[data-desk-page]")?.textContent).not.toContain(nameBox().placeholder);
    expect(document.activeElement).toBe(nameBox());
    fireEvent.change(nameBox(), { target: { value: "Ọlámídé" } });
    expect(field("name")).toBe("Ọlámídé");
  });

  test("[prologue:printed-page-hands-over] given a desk, when the run goes through its steps, then the page fills as each step is reached, unprinted and unstamped, and the stage stays mounted: the age, the path and what it was with the lives, the strip's district with the homes; FROM, FAMILY and READY wait as dots", async () => {
    stubDesk();
    door();
    const figure = document.querySelector("[data-desk-stage] [data-figure]");
    for (const id of ["age", "path", "was", "from", "family"]) expect(field(id)).toBe(say("prologue.page.empty"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.reroll") }));
    fireEvent.click(action());
    await waitFor(() => expect(stage()).toBe("life"));
    const tile = ARCHETYPES[0]!;
    expect(field("path")).toBe(say(`prologue.archetype.${tile.id}.name`));
    expect(field("was")).toBe(say(`prologue.archetype.${tile.id}.was`));
    expect(field("age")).toMatch(/^\d+ yrs$/);
    expect(document.querySelector("[data-desk-page] [data-page-strip]")?.textContent).not.toContain("SURULERE");
    fireEvent.click(action());
    await waitFor(() => expect(stage()).toBe("page"));
    expect(document.querySelector("[data-desk-page] [data-page-strip]")?.textContent).toMatch(/[A-Z]{4,}<<\d+Y/);
    expect(field("from")).toBe(say("prologue.page.empty"));
    expect(field("family")).toBe(say("prologue.page.empty"));
    expect(document.querySelector("[data-desk-page] [data-field='ready'] .num")?.textContent).toBe(say("prologue.page.empty"));
    expect(document.querySelector("[data-desk-page] .drop")).toBeNull();
    expect(document.querySelector("[data-desk-page] [data-stamp]")).toBeNull();
    // One figure for the whole run: the stage was never laid out again.
    expect(document.querySelector("[data-desk-stage] [data-figure]")).toBe(figure);
  });

  test("[prologue:front-door-three-screens] given a desk on Your life so far, then every life shows at once as a two-column grid of tiles with no pager, the picked one checked, the age card under them in the panel, and the stage shows the picked life; a tile tapped is picked, and a done step's tab goes back to it", async () => {
    stubDesk();
    door();
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.reroll") }));
    fireEvent.click(action());
    await waitFor(() => expect(stage()).toBe("life"));
    expect(document.querySelectorAll("[data-archetypes] [role='radio']")).toHaveLength(ARCHETYPES.length);
    expect(document.querySelector("[data-archetypes]")?.hasAttribute("data-lives-grid")).toBe(true);
    expect(document.querySelector("[data-door-pager]")).toBeNull();
    expect(document.querySelector("[data-door-panel] [data-door-age]")).not.toBeNull();
    expect(document.querySelector("[data-desk-life]")?.getAttribute("data-desk-life")).toBe(ARCHETYPES[0]!.id);
    const nurse = ARCHETYPES.find((one) => one.id === "nurse")!;
    fireEvent.click(screen.getByRole("radio", { name: say(`prologue.archetype.${nurse.id}.name`) }));
    expect(picked("data-archetypes")).toBe("nurse");
    expect(document.querySelector("[data-desk-life]")?.getAttribute("data-desk-life")).toBe("nurse");
    expect(field("path")).toBe(say("prologue.archetype.nurse.name"));
    // The first step is done: its tab carries the tick and takes the run back to it.
    fireEvent.click(document.querySelector<HTMLElement>("[data-door-tab='done']")!);
    await waitFor(() => expect(stage()).toBe("you"));
  });

  test("[prologue:front-door-three-screens] given a desk, when the arrows are pressed, then the look moves to the one after, before and a row down; R rolls the name; Enter is the yellow action; the arrows move the lives on Your life so far", async () => {
    stubDesk();
    door();
    (document.activeElement as HTMLElement | null)?.blur();
    const first = picked("data-looks");
    expect(first).toBe(LOOKS[0]!.id);
    press("ArrowRight");
    expect(picked("data-looks")).toBe(LOOKS[1]!.id);
    press("ArrowLeft");
    expect(picked("data-looks")).toBe(LOOKS[0]!.id);
    press("ArrowDown");
    const columns = Number(document.querySelector("[data-looks]")?.getAttribute("data-columns"));
    expect(columns).toBeGreaterThan(1);
    expect(picked("data-looks")).toBe(LOOKS[columns]!.id);
    press("ArrowUp");
    expect(picked("data-looks")).toBe(LOOKS[0]!.id);
    // Before the first, nothing moves.
    press("ArrowLeft");
    expect(picked("data-looks")).toBe(LOOKS[0]!.id);
    expect(nameBox().value).toBe("");
    press("r");
    expect(nameBox().value).not.toBe("");
    expect(readDoor()?.name).toBe(nameBox().value);
    press("Enter");
    await waitFor(() => expect(stage()).toBe("life"));
    expect(picked("data-archetypes")).toBe(ARCHETYPES[0]!.id);
    press("ArrowRight");
    expect(picked("data-archetypes")).toBe(ARCHETYPES[1]!.id);
    press("ArrowDown");
    expect(picked("data-archetypes")).toBe(ARCHETYPES[3]!.id);
    press("Enter");
    await waitFor(() => expect(stage()).toBe("page"));
  });

  test("[prologue:front-door-three-screens] given a desk, when the arrows, R and Enter are pressed while the name box or the username box holds the focus, then none of them is taken by the door: the look, the life and the step stay, and no name is rolled", async () => {
    stubDesk();
    door(GUEST);
    nameBox().focus();
    for (const key of ["ArrowRight", "ArrowDown", "r", "R"]) press(key, nameBox());
    expect(picked("data-looks")).toBe(LOOKS[0]!.id);
    expect(nameBox().value).toBe("");
    expect(stage()).toBe("you");
    fireEvent.change(nameBox(), { target: { value: "Ada" } });
    // Enter in the box is the box's own, Next, once: the door does not take it again for a second step.
    press("Enter", nameBox());
    await waitFor(() => expect(stage()).toBe("life"));
    expect(stage()).toBe("life");
    fireEvent.click(action());
    await waitFor(() => expect(stage()).toBe("page"));
    const username = screen.getByRole<HTMLInputElement>("textbox", { name: "Username" });
    username.focus();
    const home = document.querySelector("[data-door-home] [role='radio'][aria-checked='true']")?.getAttribute("data-home");
    for (const key of ["ArrowRight", "ArrowLeft", "r", "R"]) press(key, username);
    expect(document.querySelector("[data-door-home] [role='radio'][aria-checked='true']")?.getAttribute("data-home")).toBe(home);
    expect(readDoor()?.name).toBe("Ada");
    expect(stage()).toBe("page");
  });

  test("[prologue:front-door-three-screens] given a desk, then the line of keys stands in the panel's foot on a fine pointer, and not on a coarse one", () => {
    stubDesk();
    door();
    expect(document.querySelector("[data-door-foot] [data-door-keys]")).not.toBeNull();
    cleanup();
    localStorage.clear();
    stubDesk({ fine: false });
    door();
    expect(document.querySelector("[data-door-desk]")).not.toBeNull();
    expect(document.querySelector("[data-door-keys]")).toBeNull();
  });
});
