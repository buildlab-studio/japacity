// The way through the front door for a screen test (prologue.md R-PROLOGUE-009): past the look with Next, a tile or
// a ready life, a name from the suggestions unless one is given, "Print my page", then Begin, waiting out the stamp.
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { say } from "../words/text";

/** From the first sheet to the archetypes; a run kept at the tiles already is left there. */
export async function toTheArchetypes(): Promise<void> {
  await waitFor(() => {
    if (document.querySelector("[data-gate='you'], [data-gate='begun'], [data-gate='path']") === null) throw new Error("No front door yet.");
  });
  const next = screen.queryByRole("button", { name: new RegExp(`^${say("ui.door.next")}`) });
  if (next !== null) fireEvent.click(next);
  await screen.findByRole("button", { name: new RegExp(`^${say("ui.door.ready")}`) });
}

/** The name, typed when given, else the first the pool suggests; then the page printed and Begin, until the life is on screen. */
export async function nameAndBegin(name?: string): Promise<void> {
  const box = await screen.findByRole<HTMLInputElement>("textbox", { name: say("prologue.door.name.title") });
  if (name === undefined) fireEvent.click(within(screen.getByRole("group", { name: say("prologue.door.name.suggested") })).getAllByRole("button")[0]!);
  else fireEvent.change(box, { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("prologue.door.print")}`) }));
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${say("ui.door.begin")}`) }));
  await waitFor(
    () => {
      if (document.querySelector("[data-door-progress]") !== null) throw new Error("The page is still being stamped.");
      // A screen loaded on first use (the old month page) says it is loading until it is there.
      if (screen.queryByText(say("ui.loading")) !== null) throw new Error("The life is still opening.");
    },
    { timeout: 5000 },
  );
}

/** A ready life, by its scenario: Next, the ready lives' card, Pick on its kind, a name, the page, Begin. */
export async function startReadyLife(scenario: string, name?: string): Promise<void> {
  await toTheArchetypes();
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${say("ui.door.ready")}`) }));
  fireEvent.click(await screen.findByRole("button", { name: `${say("prologue.door.pick")}: ${say(`${scenario}.kind`)}` }));
  await nameAndBegin(name);
}

/** A life from sixteen through an archetype's tile: the tile, a name, the page, Begin. */
export async function startArchetype(archetype: string, name?: string): Promise<void> {
  await toTheArchetypes();
  fireEvent.click(await screen.findByRole("button", { name: say(`prologue.archetype.${archetype}.name`) }));
  await nameAndBegin(name);
}
