// The way through the front door for a screen test (prologue.md R-PROLOGUE-009): past the look and the
// name, then a ready life by its kind, or an archetype's tile.
import { fireEvent, screen } from "@testing-library/react";

import { say } from "../../shared/words/text";

/** From the first sheet to the archetypes. */
export async function toTheArchetypes(): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${say("ui.door.next")}`) }));
}

/** A ready life, by its scenario: Next, the ready lives' card, then Begin on its kind. */
export async function startReadyLife(scenario: string): Promise<void> {
  await toTheArchetypes();
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${say("ui.door.ready")}`) }));
  fireEvent.click(await screen.findByRole("button", { name: `${say("ui.door.begin")}: ${say(`${scenario}.kind`)}` }));
}

/** A life from sixteen through an archetype's tile. */
export async function startArchetype(archetype: string): Promise<void> {
  await toTheArchetypes();
  fireEvent.click(await screen.findByRole("button", { name: say(`prologue.archetype.${archetype}.name`) }));
}
