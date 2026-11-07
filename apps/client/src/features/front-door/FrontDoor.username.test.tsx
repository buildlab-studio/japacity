// The door's name box (prologue:front-door-builds-a-person, prologue:front-door-three-screens): it starts empty on every path and never
// fills itself. Its placeholder suggests a name: from the username chosen before the door where that is a first name, else
// the pool's for the look's sex. Only the dice puts a name in the box, or a tap on one of the pool's three under it; a name
// typed, rolled or taken is never replaced, and a run kept on the device keeps its name. Begin with the box empty goes
// back to it, focused, saying the story needs a name. The box takes the focus as the screen opens, unless a sheet stands over it.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { createGameStore } from "../../authority/store";
import { keepDoor, readDoor } from "../../shared/datapage/door";
import { LOOKS, lookOf, namesFor, NAMES_SHOWN } from "../../shared/front-door/looks";
import { DOOR_KEY } from "../../shared/storage/storage";
import { stubPointer } from "../../shared/testing/pointer";
import { say } from "../../shared/words/text";
import { FrontDoor } from "./FrontDoor";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

afterEach(() => {
  localStorage.clear();
  document.querySelectorAll("[data-over-sheet]").forEach((sheet) => sheet.remove());
  vi.unstubAllGlobals();
});

/** The door, its username known, still being read or never asked before the door (null). */
function door(username: string | null) {
  const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "run-seed", now: () => 0 });
  const store = createGameStore(authority, { life: authority, lifeAgain: true, choosingLife: true });
  const shown = (given: string | null) => (
    <GameProvider store={store}>
      <FrontDoor username={given} />
    </GameProvider>
  );
  const { rerender, unmount } = render(shown(username));
  return { known: (given: string | null) => rerender(shown(given)), unmount };
}

const nameBox = () => screen.getByRole<HTMLInputElement>("textbox", { name: say("prologue.door.name.title") });
const keptRoll = (): number => (JSON.parse(localStorage.getItem(DOOR_KEY) ?? "{}") as { roll?: number }).roll ?? -1;
const lookSex = (): "f" | "m" => lookOf(document.querySelector("[data-gate]")?.getAttribute("data-look"))!.sex;
const poolName = (): string => namesFor(lookSex(), keptRoll())[0]!;
/** The names offered under the box, in order. */
const suggested = (): string[] => [...document.querySelectorAll("[data-door-suggested] button")].map((button) => button.textContent ?? "");
const dice = () => screen.getByRole("button", { name: say("ui.door.reroll") });
const otherLook = () => LOOKS.find((one) => one.sex !== lookSex())!;
const pickLook = (id: string) => fireEvent.click(document.querySelector<HTMLElement>(`[role="radio"][data-look="${id}"]`)!);
const next = () => fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.next")}`) }));

describe("the door's name box", () => {
  test("[prologue:front-door-builds-a-person] given the door's first screen, then the name's box is labelled as the character's name, never the player's, says what the name is for, and the dice asks for another name", () => {
    door("olamide_88");
    expect(say("prologue.door.name.title")).toBe("Character name");
    expect(document.querySelector("label[for='door-name']")?.textContent).toBe("Character name");
    expect(nameBox().id).toBe("door-name");
    expect(document.querySelector("[data-door-name-hint]")?.textContent).toBe("What people in your story call you.");
    expect(nameBox().getAttribute("aria-describedby")).toBe("door-name-hint");
    expect(screen.getByRole("button", { name: "Another name" })).toBeDefined();
    expect(screen.getByRole("heading", { name: say("ui.life.title") })).toBeDefined();
  });

  test("[prologue:front-door-builds-a-person] given a username chosen before the door, when the door opens, then the box is empty and its placeholder suggests the username's first name, never its value", () => {
    for (const [username, name] of [
      ["Olamide", "Olamide"],
      ["olamide_88", "Olamide"],
      ["OLAMIDE", "Olamide"],
    ] as const) {
      const { unmount } = door(username);
      expect(nameBox().value).toBe("");
      expect(nameBox().placeholder).toBe(name);
      expect(readDoor()?.name).toBe("");
      expect(suggested()).toHaveLength(NAMES_SHOWN);
      unmount();
      localStorage.clear();
    }
  });

  test("[prologue:front-door-builds-a-person] given a username that makes no first name, or one the door would refuse, when the door opens, then the box is empty, the pool's name for the look is its placeholder, and three of the pool's names stand under it with the dice", () => {
    for (const username of ["x_99", "admin_1", "ashawo_9"]) {
      const { unmount } = door(username);
      expect(nameBox().value).toBe("");
      expect(nameBox().placeholder).toBe(poolName());
      expect(readDoor()?.name).toBe("");
      expect(suggested()).toEqual(namesFor(lookSex(), keptRoll()));
      expect(suggested()).toHaveLength(NAMES_SHOWN);
      expect(dice()).toBeDefined();
      unmount();
      localStorage.clear();
    }
  });

  test("[prologue:front-door-builds-a-person] given a door with no account (offline, or Play's path before the username is asked), when it opens, then the box is empty with the pool's name as its placeholder and three names under it", () => {
    door(null);
    expect(nameBox().value).toBe("");
    expect(nameBox().placeholder).toBe(poolName());
    expect(readDoor()?.name).toBe("");
    expect(suggested()).toEqual(namesFor(lookSex(), keptRoll()));
  });

  test("[prologue:front-door-builds-a-person] given the empty box, then its placeholder is styled as a placeholder, in a lighter ink than a typed name", () => {
    door(null);
    expect(nameBox().className).toMatch(/placeholder:text-text-2/);
    expect(nameBox().className).toMatch(/(^| )text-text( |$)/);
  });

  test("[prologue:front-door-builds-a-person] given a life ended on a signed-in account, when the door opens for the next life, then the box is empty, never the last life's name, with the username's or the pool's suggestion as its placeholder", () => {
    for (const [username, name] of [
      ["olamide_88", "Olamide"],
      ["x_99", null],
    ] as const) {
      keepDoor({ stage: "begun", look: LOOKS[1]!.id, archetype: null, ready: null, name: "Obinna", typed: true, roll: 7, age: 0 });
      const { unmount } = door(username);
      expect(nameBox().value).toBe("");
      expect(nameBox().placeholder).toBe(name ?? poolName());
      expect(readDoor()?.stage).toBe("you");
      expect(suggested()).toHaveLength(NAMES_SHOWN);
      unmount();
      localStorage.clear();
    }
  });

  test("[prologue:front-door-builds-a-person] given the empty box, when a look of the other sex is picked, then the box stays empty and the placeholder and the names under it follow the look", () => {
    door(null);
    const other = otherLook();
    pickLook(other.id);
    expect(nameBox().value).toBe("");
    expect(nameBox().placeholder).toBe(namesFor(other.sex, keptRoll())[0]);
    expect(suggested()).toEqual(namesFor(other.sex, keptRoll()));
  });

  test("[prologue:front-door-builds-a-person] given the empty box, when the dice is rolled, then a name from the pool is in the box, kept with the run, and a look of the other sex keeps it", () => {
    door("x_99");
    fireEvent.click(dice());
    const rolled = poolName();
    expect(nameBox().value).toBe(rolled);
    expect(readDoor()?.name).toBe(rolled);
    expect(suggested()).toEqual([]);
    pickLook(otherLook().id);
    expect(nameBox().value).toBe(rolled);
  });

  test("[prologue:front-door-builds-a-person] given the empty box, when one of the names under it is taken, then it is the name, kept with the run, and a look of the other sex keeps it", () => {
    door("x_99");
    const taken = suggested()[1]!;
    fireEvent.click(screen.getByRole("button", { name: taken }));
    expect(nameBox().value).toBe(taken);
    expect(readDoor()?.name).toBe(taken);
    expect(suggested()).toEqual([]);
    pickLook(otherLook().id);
    expect(nameBox().value).toBe(taken);
  });

  test("[prologue:front-door-builds-a-person] given the username read only after the door opened, then the empty box's placeholder takes it and the box stays empty, and a name typed before it came stays", () => {
    const first = door(null);
    expect(nameBox().placeholder).toBe(poolName());
    first.known("olamide_88");
    expect(nameBox().placeholder).toBe("Olamide");
    expect(nameBox().value).toBe("");
    expect(readDoor()?.name).toBe("");
    first.unmount();
    localStorage.clear();

    const second = door(null);
    fireEvent.change(nameBox(), { target: { value: "Ifeoma" } });
    second.known("olamide_88");
    expect(nameBox().value).toBe("Ifeoma");
  });

  test("[prologue:front-door-builds-a-person] given a name typed and the page reloaded, when the door opens again with the username, then the run kept on the device keeps the typed name", () => {
    const first = door("olamide_88");
    fireEvent.change(nameBox(), { target: { value: "Ifeoma" } });
    first.unmount();
    door("olamide_88");
    expect(nameBox().value).toBe("Ifeoma");
  });

  test("[prologue:front-door-builds-a-person] given a run kept on the device with a rolled name, when the door opens again with the username, then the kept name stands", () => {
    const first = door(null);
    fireEvent.click(dice());
    const kept = nameBox().value;
    expect(kept).toBe(poolName());
    first.unmount();
    door("olamide_88");
    expect(nameBox().value).toBe(kept);
  });

  test("[prologue:front-door-builds-a-person] given a name typed, when the box is emptied, then three of the pool's names for the look show under it again, and they go once a name is typed or one is taken", () => {
    door(null);
    fireEvent.change(nameBox(), { target: { value: "Ife" } });
    expect(suggested()).toEqual([]);
    fireEvent.change(nameBox(), { target: { value: "" } });
    expect(suggested()).toEqual(namesFor(lookSex(), keptRoll()));
    const taken = suggested()[2]!;
    fireEvent.click(screen.getByRole("button", { name: taken }));
    expect(nameBox().value).toBe(taken);
    expect(suggested()).toEqual([]);
  });

  test("[prologue:front-door-builds-a-person] given the box empty, when Next and Next then Begin are pressed, then Begin does not take the placeholder: the run goes back to the first screen with the box empty, focused and saying the story needs a name", async () => {
    door("olamide_88");
    next();
    expect(document.querySelector("[data-gate='life']")).not.toBeNull();
    next();
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${say("ui.door.begin")}`) }));
    expect(document.querySelector("[data-gate='you']")).not.toBeNull();
    expect(nameBox().value).toBe("");
    expect(readDoor()?.name).toBe("");
    expect(document.activeElement).toBe(nameBox());
    expect(say("prologue.door.name.needed")).toBe("Your story needs a name.");
    expect(screen.getByRole("alert").textContent).toBe("Your story needs a name.");
    expect(nameBox().getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(nameBox(), { target: { value: "Ifeoma" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("[prologue:front-door-builds-a-person] given the door's first screen opening on a desktop, then the name box takes the focus as the first field to fill; with a sheet standing over the door, the sheet keeps it", () => {
    stubPointer("fine");
    const first = door(null);
    expect(document.activeElement).toBe(nameBox());
    first.unmount();
    localStorage.clear();

    const sheet = document.createElement("div");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("data-over-sheet", "");
    const button = document.createElement("button");
    sheet.append(button);
    document.body.append(sheet);
    button.focus();
    door(null);
    expect(document.activeElement).toBe(button);
  });
});

describe("the name box on a touch phone", () => {
  test("[prologue:front-door-builds-a-person] given the door's first screen opening on a touch phone, then the name box waits unfocused, so no keyboard rises over the photo card; Begin with it empty goes back and focuses it", async () => {
    stubPointer("coarse");
    door("olamide_88");
    expect(document.activeElement).not.toBe(nameBox());
    expect(nameBox().placeholder).not.toBe("");
    next();
    next();
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${say("ui.door.begin")}`) }));
    expect(document.querySelector("[data-gate='you']")).not.toBeNull();
    expect(document.activeElement).toBe(nameBox());
    expect(screen.getByRole("alert").textContent).toBe(say("prologue.door.name.needed"));
  });
});

describe("Shuffle and the name", () => {
  test("[prologue:front-door-three-screens] given a name in the box, when Shuffle is pressed, then the name stands; given the box empty, it stays empty", () => {
    door(null);
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.shuffle.all") }));
    expect(nameBox().value).toBe("");
    expect(nameBox().placeholder).toBe(poolName());
    fireEvent.change(nameBox(), { target: { value: "Ifeoma" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.shuffle.all") }));
    expect(nameBox().value).toBe("Ifeoma");
  });
});
