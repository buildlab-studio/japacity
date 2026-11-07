// The way through the front door for a screen test (prologue:front-door-builds-a-person, prologue:front-door-three-screens, prologue:printed-page-hands-over): the name on the first screen
// (typed when given, else rolled with the dice, since the box starts empty), Next, a tile and Next to Where you live, or a ready life's Pick, then Begin. A tile's life fills its page and
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

/** The name on the first screen: typed when given, else the dice rolled for one where the box is empty. */
function typeName(name: string | undefined): void {
  const box = screen.getByRole<HTMLInputElement>("textbox", { name: say("prologue.door.name.title") });
  if (name !== undefined) fireEvent.change(box, { target: { value: name } });
  else if (box.value === "") fireEvent.click(screen.getByRole("button", { name: say("ui.door.reroll") }));
}

/** From the first screen to the tiles; a run kept at the tiles already is left there. Gives the name on the way: typed when given, else rolled. */
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
      // A screen loaded on first use says it is loading until it is there.
      if (screen.queryByText(say("ui.loading")) !== null) throw new Error("The life is still opening.");
    },
    { timeout: 5000 },
  );
}

/** Past the page as the handover: its Go, once the years are in, and on until the gate has left the screen. */
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
 * A ready life, by its scenario, on a run Settings asked for: the door opens on the ready lives; the name is given (typed
 * when given, else rolled) by going Back to the first screen and Next again. Then Pick on its kind, Begin.
 */
export async function startReadyLife(scenario: string, name?: string): Promise<void> {
  await atTheDoor();
  if (document.querySelector("[data-gate='ready']") !== null) fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
  if (document.querySelector("[data-gate='you']") !== null) {
    typeName(name);
    fireEvent.click(screen.getByRole("button", { name: startsWith("ui.door.next") }));
  }
  fireEvent.click(await screen.findByRole("button", { name: `${say("prologue.door.pick")}: ${say(`${scenario}.kind`)}` }));
  await begin();
}

/** From the tiles to Where you live: Next on the second screen. */
function toWhereYouLive(): void {
  fireEvent.click(screen.getByRole("button", { name: startsWith("ui.door.next") }));
}

/** A life from sixteen through an archetype's tile: the name, Next, the tile, Next to Where you live, Begin. The life's page is left on screen. */
export async function startArchetype(archetype: string, name?: string): Promise<void> {
  await toTheArchetypes(name);
  fireEvent.click(await screen.findByRole("radio", { name: say(`prologue.archetype.${archetype}.name`) }));
  toWhereYouLive();
  await begin();
}
