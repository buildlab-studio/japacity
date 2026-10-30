// The door's name for a signed-in account (prologue:front-door-builds-a-person): the username was chosen before the door, on the
// sign-in path or for an earlier life, so the name starts from it where it can be a first name; where it cannot, the box
// starts empty with three names from the pool under it and the dice. A name the player typed or rolled is never
// replaced, and a run kept on the device keeps its name. A door with no account fills the pool's name.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { createGameStore } from "../../authority/store";
import { keepDoor, readDoor } from "../../shared/datapage/door";
import { LOOKS, lookOf, namesFor, NAMES_SHOWN } from "../../shared/front-door/looks";
import { DOOR_KEY } from "../../shared/storage/storage";
import { say } from "../../shared/words/text";
import { FrontDoor } from "./FrontDoor";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

afterEach(() => {
  localStorage.clear();
});

/** The door for a signed-in account, its username known or still being read (null); `signedIn` false is a door with no account. */
function door(username: string | null, signedIn = true) {
  const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "run-seed", now: () => 0 });
  const store = createGameStore(authority, { life: authority, lifeAgain: true, choosingLife: true });
  const shown = (given: string | null) => (
    <GameProvider store={store}>
      <FrontDoor username={given} signedIn={signedIn} />
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

describe("the door's name from the username", () => {
  test("[prologue:front-door-builds-a-person] given the door's first screen, then the name's box is labelled as the character's name, never the player's, says what the name is for, and the dice asks for another name", () => {
    door("olamide_88");
    expect(say("prologue.door.name.title")).toBe("Character name");
    expect(document.querySelector("label[for='door-name']")?.textContent).toBe("Character name");
    expect(nameBox().id).toBe("door-name");
    expect(nameBox().placeholder).toBe("Name");
    expect(document.querySelector("[data-door-name-hint]")?.textContent).toBe("What people in your story call you. Type one or take one.");
    expect(nameBox().getAttribute("aria-describedby")).toBe("door-name-hint");
    expect(screen.getByRole("button", { name: "Another name" })).toBeDefined();
    expect(screen.getByRole("heading", { name: say("ui.life.title") })).toBeDefined();
  });

  test("[prologue:front-door-builds-a-person] given a username chosen before the door, when the door opens, then its name starts from the username where that is a first name, and the run keeps it", () => {
    for (const [username, name] of [
      ["Olamide", "Olamide"],
      ["olamide_88", "Olamide"],
      ["OLAMIDE", "Olamide"],
    ] as const) {
      const { unmount } = door(username);
      expect(nameBox().value).toBe(name);
      expect(readDoor()?.name).toBe(name);
      unmount();
      localStorage.clear();
    }
  });

  test("[prologue:front-door-builds-a-person] given a username that makes no first name, or one the door would refuse, when the door opens, then the box starts empty with three names from the pool under it and the dice, never a random fill", () => {
    for (const username of ["x_99", "admin_1", "ashawo_9"]) {
      const { unmount } = door(username);
      expect(nameBox().value).toBe("");
      expect(readDoor()?.name).toBe("");
      expect(suggested()).toEqual(namesFor(lookSex(), keptRoll()));
      expect(suggested()).toHaveLength(NAMES_SHOWN);
      expect(screen.getByRole("button", { name: say("ui.door.reroll") })).toBeDefined();
      unmount();
      localStorage.clear();
    }
  });

  test("[prologue:front-door-builds-a-person] given the empty box on a signed-in account, when a suggestion is taken, then it is the name, kept with the run, and a look of the other sex keeps it", () => {
    door("x_99");
    const taken = suggested()[1]!;
    fireEvent.click(screen.getByRole("button", { name: taken }));
    expect(nameBox().value).toBe(taken);
    expect(readDoor()?.name).toBe(taken);
    expect(suggested()).toEqual([]);
    const other = LOOKS.find((one) => one.sex !== lookSex())!;
    fireEvent.click(document.querySelector<HTMLElement>(`[role="radio"][data-look="${other.id}"]`)!);
    expect(nameBox().value).toBe(taken);
  });

  test("[prologue:front-door-builds-a-person] given the empty box on a signed-in account, when a look of the other sex is picked, then the box stays empty and the suggestions follow the look", () => {
    door("x_99");
    const other = LOOKS.find((one) => one.sex !== lookSex())!;
    fireEvent.click(document.querySelector<HTMLElement>(`[role="radio"][data-look="${other.id}"]`)!);
    expect(nameBox().value).toBe("");
    expect(suggested()).toEqual(namesFor(other.sex, keptRoll()));
  });

  test("[prologue:front-door-builds-a-person] given a life ended on a signed-in account, when the door opens for the next life, then its name starts from the username, or the box starts empty where the username makes no name, never the last life's or a random one", () => {
    for (const [username, name] of [
      ["Olamide", "Olamide"],
      ["olamide_88", "Olamide"],
      ["x_99", ""],
    ] as const) {
      keepDoor({ stage: "begun", look: LOOKS[1]!.id, archetype: null, ready: null, name: "Obinna", typed: true, roll: 7, age: 0 });
      const { unmount } = door(username);
      expect(nameBox().value).toBe(name);
      expect(readDoor()?.stage).toBe("you");
      expect(suggested()).toHaveLength(name === "" ? NAMES_SHOWN : 0);
      unmount();
      localStorage.clear();
    }
  });

  test("[prologue:front-door-builds-a-person] given a door with no account (offline, or Play's path before the username is asked), when it opens, then the name is the pool's and no suggestion list shows", () => {
    door(null, false);
    expect(nameBox().value).toBe(poolName());
    expect(nameBox().value).not.toBe("");
    expect(suggested()).toEqual([]);
  });

  test("[prologue:front-door-builds-a-person] given the username read only after the door opened, then an untouched name takes it, and a name typed before it came stays", () => {
    const first = door(null);
    expect(nameBox().value).toBe("");
    first.known("olamide_88");
    expect(nameBox().value).toBe("Olamide");
    expect(readDoor()?.name).toBe("Olamide");
    first.unmount();
    localStorage.clear();

    const second = door(null);
    fireEvent.change(nameBox(), { target: { value: "Ifeoma" } });
    second.known("olamide_88");
    expect(nameBox().value).toBe("Ifeoma");
  });

  test("[prologue:front-door-builds-a-person] given the name from the username, then a look of the other sex keeps it, the dice gives the pool's names, and a rolled name is not put back when the username is read again", () => {
    const { known } = door("olamide_88");
    const other = LOOKS.find((one) => one.sex !== lookSex())!;
    fireEvent.click(document.querySelector<HTMLElement>(`[role="radio"][data-look="${other.id}"]`)!);
    expect(nameBox().value).toBe("Olamide");
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.reroll") }));
    expect(nameBox().value).toBe(poolName());
    known("olamide");
    expect(nameBox().value).toBe(poolName());
  });

  test("[prologue:front-door-builds-a-person] given a name typed and the page reloaded, when the door opens again with the username, then the run kept on the device keeps the typed name", () => {
    const first = door("olamide_88");
    fireEvent.change(nameBox(), { target: { value: "Ifeoma" } });
    first.unmount();
    door("olamide_88");
    expect(nameBox().value).toBe("Ifeoma");
  });

  test("[prologue:front-door-builds-a-person] given the username read only after the door opened, when it makes no first name, then the box stays empty with the suggestions", () => {
    const first = door(null);
    first.known("x_99");
    expect(nameBox().value).toBe("");
    expect(suggested()).toHaveLength(NAMES_SHOWN);
  });

  test("[prologue:front-door-builds-a-person] given a run kept on the device with a rolled name, when the door opens again with the username, then the kept name stands", () => {
    const first = door(null);
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.reroll") }));
    const kept = nameBox().value;
    expect(kept).toBe(poolName());
    first.unmount();
    door("olamide_88");
    expect(nameBox().value).toBe(kept);
  });
});
