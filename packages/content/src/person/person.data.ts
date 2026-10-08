// Computer characters who can fill a slot: docs/rules/people.md "Entries". Entered by the people agents.
import type { Id, PersonEntry } from "@japacity/sim";

export const personTable: Record<Id<"person">, PersonEntry> = {};

/** The spots people meet at (R-PEOPLE-014). Entered with the persons. */
export const peopleSpots: string[] = [];
