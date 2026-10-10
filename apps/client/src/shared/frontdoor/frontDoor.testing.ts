// The way through the front door for a screen test (prologue.md R-PROLOGUE-009, 013, 014): the name on the first screen
// (the filled one unless one is given), Next, a tile or a ready life, Print my page, then Begin. A tile's life fills its page and
// opens the world from it; `passThePage` taps it on. A ready life is reached only on a run Settings asked for: a test
// calls `askReadyLives` before the app is drawn.
import { fireEvent, screen, waitFor } from "@testing-library/react";

import { say } from "../words/text";

export { askReadyLives } from "./ready";

const startsWith = (key: string): RegExp => new RegExp(`^${say(key)}`);

async function atTheDoor(): Promise<void> {
  await waitFor(() => {
    if (document.querySelector("[data-gate='you'], [data-gate='life'], [data-gate='ready'], [data-gate='begun']") === null) throw new Error("No front door yet.");
  });
}

/** The name on the first screen, typed when given. */
function typeName(name: string | undefined): void {
  if (name === undefined) return;
  fireEvent.change(screen.getByRole("textbox", { name: say("prologue.door.name.title") }), { target: { value: name } });
}

/** From the first screen to the tiles; a run kept at the tiles already is left there. Types the name on the way when given. */
export async function toTheArchetypes(name?: string): Promise<void> {
  await atTheDoor();
  if (document.querySelector("[data-gate='you']") !== null) {
    typeName(name);
    fireEvent.click(screen.getByRole("button", { name: startsWith("ui.door.next") }));
  }
  await waitFor(() => {
    if (document.querySelector("[data-archetypes]") === null) throw new Error("No tiles yet.");
  });
}

/** Begin on the page, until the door has gone and the life is on screen (its page, for a tile's life). */
export async function begin(): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: startsWith("ui.door.begin") }));
  await waitFor(
    () => {
      // The page after Begin wears the door's header too, so the door's own page is the mark.
      if (document.querySelector("[data-gate='page'], [data-gate='begun']") !== null) throw new Error("The door's page is still up.");
      // A screen loaded on first use (the old month page) says it is loading until it is there.
      if (screen.queryByText(say("ui.loading")) !== null) throw new Error("The life is still opening.");
    },
    { timeout: 5000 },
  );
}

/** Past the page as the handover: its Go, once the years are in, and on until the world (or the old month page) is up. */
export async function passThePage(): Promise<void> {
  await waitFor(
    () => {
      if (document.querySelector("[data-page-handover]") === null) throw new Error("The page is still filling.");
    },
    { timeout: 10_000 },
  );
  fireEvent.click(screen.getByRole("button", { name: say("ui.prologue.start") }));
  await waitFor(() => {
    if (document.querySelector("[data-gate]") !== null) throw new Error("The page is still up.");
  });
}

/**
 * A ready life, by its scenario, on a run Settings asked for: the door opens on the ready lives; a name given is typed
 * by going Back to the first screen and Next again. Then Pick on its kind, Begin.
 */
export async function startReadyLife(scenario: string, name?: string): Promise<void> {
  await atTheDoor();
  if (name !== undefined) {
    if (document.querySelector("[data-gate='ready']") !== null) fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
    typeName(name);
    fireEvent.click(screen.getByRole("button", { name: startsWith("ui.door.next") }));
  }
  fireEvent.click(await screen.findByRole("button", { name: `${say("prologue.door.pick")}: ${say(`${scenario}.kind`)}` }));
  await begin();
}

/** A life from sixteen through an archetype's tile: the name, Next, the tile, Print my page, Begin. The life's page is left on screen. */
export async function startArchetype(archetype: string, name?: string): Promise<void> {
  await toTheArchetypes(name);
  fireEvent.click(await screen.findByRole("radio", { name: say(`prologue.archetype.${archetype}.name`) }));
  fireEvent.click(screen.getByRole("button", { name: startsWith("prologue.door.print") }));
  await begin();
}
