// The door's name where the username came first (prologue:front-door-builds-a-person): on the sign-in path the username is
// chosen before the door, so the name starts from it where it can be a first name, and from the pool where it cannot. A
// name the player typed or rolled is never replaced, and a run kept on the device keeps its name.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { createGameStore } from "../../authority/store";
import { readDoor } from "../../shared/datapage/door";
import { LOOKS, lookOf, namesFor } from "../../shared/front-door/looks";
import { DOOR_KEY } from "../../shared/storage/storage";
import { say } from "../../shared/words/text";
import { FrontDoor } from "./FrontDoor";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

afterEach(() => {
  localStorage.clear();
});

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

describe("the door's name from the username", () => {
  test("[prologue:front-door-builds-a-person] given the door's first screen, then the name's box is labelled as the character's name, never the player's, and the dice asks for another name", () => {
    door("olamide_88");
    expect(say("prologue.door.name.title")).toBe("Your character's name");
    expect(document.querySelector("label[for='door-name']")?.textContent).toBe("Your character's name");
    expect(nameBox().id).toBe("door-name");
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

  test("[prologue:front-door-builds-a-person] given a username that makes no first name, or one the door would refuse, when the door opens, then the name is the pool's", () => {
    for (const username of ["x_99", "admin_1", "ashawo_9"]) {
      const { unmount } = door(username);
      expect(nameBox().value).toBe(poolName());
      unmount();
      localStorage.clear();
    }
  });

  test("[prologue:front-door-builds-a-person] given the username read only after the door opened, then an untouched name takes it, and a name typed before it came stays", () => {
    const first = door(null);
    expect(nameBox().value).toBe(poolName());
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

  test("[prologue:front-door-builds-a-person] given a run kept on the device with the pool's name, when the door opens again with the username, then the kept name stands", () => {
    const first = door(null);
    const kept = nameBox().value;
    first.unmount();
    door("olamide_88");
    expect(nameBox().value).toBe(kept);
  });
});
