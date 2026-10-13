// "Make it yours" on the door's first screen (prologue.md R-PROLOGUE-015): under the look strip, opened on a tap (the
// door's round 2), swatches for the skin, the hair and the top, and a printed top's fabric, each starting as the look
// was made, with the way back to as made. The style is kept with the person beside the save, the page prints the look in it, and none of it reaches the
// simulation.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority, SAVE_KEY } from "../../authority/local";
import { readPerson } from "../../authority/person";
import { createGameStore, type GameStore } from "../../authority/store";
import { DOOR_KEY, readDoor } from "../datapage/door";
import { say } from "../words/text";
import { ScenarioView } from "../../features/scenario/ScenarioView";
import { forgetOwnColours, type OwnColours, reportOwn, SWATCHES } from "./style";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

afterEach(() => {
  localStorage.clear();
  act(forgetOwnColours);
});

function memoryStorage() {
  const items = new Map<string, string>();
  return { items, getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

function door(save = memoryStorage()): GameStore {
  const authority = localAuthority({ fastClock: true, storage: save, makeSeed: () => "colours-seed", now: () => 0 });
  const store = createGameStore(authority, { life: authority, lifeAgain: true, choosingLife: true });
  render(
    <GameProvider store={store}>
      <ScenarioView />
    </GameProvider>,
  );
  return store;
}

const lookShown = (): string => document.querySelector("[data-gate]")?.getAttribute("data-look") ?? "";
/** Opens "Make it yours" under the look strip. */
const openYours = (): void => {
  fireEvent.click(screen.getByRole("button", { name: say("ui.door.yours") }));
};
const swatch = (part: string, colour: string) => document.querySelector<HTMLElement>(`[data-swatches='${part}'] [data-swatch='${colour}']`)!;
const chosen = (part: string): string | null => document.querySelector(`[data-swatches='${part}'] [aria-checked='true']`)?.getAttribute("data-swatch") ?? null;

/** What the figure on the plinth reads of a look in a cream senator: skin, hair, a top not among the swatches, no print. */
const SENATOR: OwnColours = { skin: "skin4", hair: "hair", top: "cream", fabric: null };

describe("Make it yours", () => {
  test("[R-PROLOGUE-015] given the first screen, \"Make it yours\" opened and the figure read, then under the look strip are the skin, the hair and the top, each with the look's own colour chosen, and no fabric for a plain top", () => {
    door();
    expect(document.querySelector("[data-yours]")).toBeNull();
    // Shut until it is opened: the figure read alone shows no rows.
    act(() => reportOwn(lookShown(), SENATOR));
    expect(document.querySelector("[data-yours]")).toBeNull();
    expect(screen.getByRole("button", { name: say("ui.door.yours") }).getAttribute("aria-expanded")).toBe("false");
    openYours();
    expect(screen.getByRole("button", { name: say("ui.door.yours") }).getAttribute("aria-expanded")).toBe("true");
    const rows = document.querySelector("[data-yours]");
    expect(rows).not.toBeNull();
    expect(document.querySelector("[data-looks]")!.compareDocumentPosition(rows!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("heading", { name: say("ui.door.yours") })).not.toBeNull();
    expect([...rows!.querySelectorAll("[data-yours-row]")].map((row) => row.getAttribute("data-yours-row"))).toEqual(["skin", "hair", "top"]);
    expect(chosen("skin")).toBe("skin4");
    expect(chosen("hair")).toBe("hair");
    // The look's own top, cream, is not a swatch of the list, so it stands first and chosen.
    expect([...document.querySelectorAll("[data-swatches='top'] [data-swatch]")].map((one) => one.getAttribute("data-swatch"))).toEqual(["cream", ...SWATCHES.top]);
    expect(chosen("top")).toBe("cream");
    expect(swatch("top", "cream").getAttribute("aria-label")).toBe(say("ui.door.yours.swatch.made", { part: say("ui.door.yours.top"), n: 1 }));
    expect(document.querySelector("[data-fabrics]")).toBeNull();
    expect(document.querySelector("[data-yours-made]")).toBeNull();
  });

  test("[R-PROLOGUE-015] given a head with no hair to read and a printed top, then there is no hair row and the fabric row starts at the look's own print", () => {
    door();
    openYours();
    act(() => reportOwn(lookShown(), { skin: "skin3", hair: null, top: "indigo", fabric: "ankara" }));
    expect(document.querySelector("[data-yours-row='hair']")).toBeNull();
    expect([...document.querySelectorAll("[data-fabrics] [data-fabric]")].map((one) => one.textContent)).toEqual(["Plain", "Ankara", "Adire", "Aso-oke"]);
    expect(document.querySelector("[data-fabrics] [aria-checked='true']")?.getAttribute("data-fabric")).toBe("ankara");
    fireEvent.click(document.querySelector<HTMLElement>("[data-fabric='adire']")!);
    expect(readDoor()?.style).toEqual({ fabric: "adire" });
    // Picking the look's own print again is as made.
    fireEvent.click(document.querySelector<HTMLElement>("[data-fabric='ankara']")!);
    expect(readDoor()?.style).toBeUndefined();
  });

  test("[R-PROLOGUE-015] given picks, then each is kept with the run, picking the look's own colour takes that part back, and Back to as made takes all of them back", () => {
    door();
    openYours();
    act(() => reportOwn(lookShown(), SENATOR));
    fireEvent.click(swatch("skin", "skin1"));
    fireEvent.click(swatch("hair", "gold"));
    fireEvent.click(swatch("top", "teal"));
    expect(chosen("skin")).toBe("skin1");
    expect(chosen("top")).toBe("teal");
    expect(readDoor()?.style).toEqual({ skin: "skin1", hair: "gold", top: "teal" });
    fireEvent.click(swatch("hair", "hair"));
    expect(readDoor()?.style).toEqual({ skin: "skin1", top: "teal" });
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.yours.made") }));
    expect(readDoor()?.style).toBeUndefined();
    expect(chosen("skin")).toBe("skin4");
    expect(chosen("top")).toBe("cream");
    expect(JSON.parse(localStorage.getItem(DOOR_KEY) ?? "{}")).not.toHaveProperty("style");
  });

  test("[R-PROLOGUE-015] [R-PROLOGUE-009] given a style, when Begin starts the life, then the style is kept with the look and the name beside the save, and the save and the simulation hold none of it", async () => {
    const save = memoryStorage();
    const store = door(save);
    const look = lookShown();
    openYours();
    act(() => reportOwn(look, SENATOR));
    fireEvent.click(swatch("skin", "skin1"));
    fireEvent.click(swatch("top", "charcoal"));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.skip")}`) }));
    await waitFor(() => expect(document.querySelector("[data-door-home]")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.begin")}`) }));
    await waitFor(() => expect(store.getState().choosingLife).toBe(false), { timeout: 4000 });
    expect(readPerson()).toMatchObject({ look, style: { skin: "skin1", top: "charcoal" } });
    const kept = save.items.get(SAVE_KEY) ?? "";
    expect(kept.length).toBeGreaterThan(0);
    for (const word of ["style", "skin1", "charcoal", look]) expect(kept).not.toContain(word);
    expect(JSON.stringify(store.getState().view)).not.toContain("charcoal");
  });
});
