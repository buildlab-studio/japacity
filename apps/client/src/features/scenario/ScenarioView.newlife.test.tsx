// After "Start a new life" the door starts clean (account.md R-ACCOUNT-030): no name, look or
// colours of the life that ended are kept; the door opens as a first visit does.
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { App } from "../../App";
import { bootGame } from "../../authority/boot";
import { readPerson } from "../../authority/person";
import { readDoor } from "../../shared/datapage/door";
import { LOOKS } from "../../shared/frontdoor/looks";
import { say } from "../../shared/words/text";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

afterEach(() => {
  localStorage.clear();
});

describe("the door after a life ends", () => {
  test("[R-ACCOUNT-030] given a life begun as Obinna in another look and colours, when it ends, then the door opens on the first screen with a name of its own, the first look and no colours", async () => {
    let seed = 0;
    const store = bootGame({ storage: localStorage, fastClock: true, makeSeed: () => `clean-${String((seed += 1))}` });
    render(<App store={store} />);
    const box = await screen.findByRole<HTMLInputElement>("textbox", { name: say("prologue.door.name.title") }, { timeout: 10_000 });
    const other = LOOKS.find((one) => one.sex === "m" && one.id !== LOOKS[0]?.id)!;
    fireEvent.click(document.querySelector(`[data-body="m"]`)!);
    fireEvent.click(document.querySelector(`[role="radio"][data-look="${other.id}"]`)!);
    fireEvent.change(box, { target: { value: "Obinna" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.skip") }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.begin")}`) }));
    await waitFor(() => expect(readPerson()?.name).toBe("Obinna"), { timeout: 5000 });
    await waitFor(() => expect(store.getState().view?.scenario).toBe("scenario.prologue"), { timeout: 5000 });
    const end = store.getState().endLife;
    if (end === null) throw new Error("This life cannot be ended here.");
    await end();
    const name = await screen.findByRole<HTMLInputElement>("textbox", { name: say("prologue.door.name.title") }, { timeout: 10_000 });
    expect(document.querySelector("[data-gate]")?.getAttribute("data-gate")).toBe("you");
    expect(name.value).not.toBe("Obinna");
    expect(name.value.length).toBeGreaterThan(1);
    expect(document.querySelector("[data-gate]")?.getAttribute("data-look")).toBe(LOOKS[0]?.id);
    expect(readDoor()?.style).toBeUndefined();
    expect(readDoor()?.typed ?? false).toBe(false);
  });
});
