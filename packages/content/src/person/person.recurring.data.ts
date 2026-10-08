// The recurring people: the same few faces month
// after month, each with a voice players can quote. Their words are
// `recurring.<role>.name`, `.blurb` and `.line.<n>` in person.recurring.text.ts.
// Names come from the pool (person.names.data.ts); who holds which role is
// chosen apart from the name, and no people holds two roles that take money.
import type { NamedPerson } from "./person.names.data";

export type RecurringRole = "fx" | "landlord" | "auntie" | "agent";

export interface RecurringPerson extends NamedPerson {
  role: RecurringRole;
  /** How many quotable lines, `.line.1` up to this: three to five. */
  lines: number;
}

export const recurringPeople: RecurringPerson[] = [
  { role: "fx", name: "Ochai", people: "idoma", lines: 5, keys: ["recurring.fx.name"] },
  { role: "landlord", name: "Ovie", people: "urhobo-isoko", lines: 5, keys: ["recurring.landlord.name"] },
  { role: "auntie", name: "Ladi", people: "hausa-fulani", lines: 5, keys: ["recurring.auntie.name"] },
  { role: "agent", name: "Ameh", people: "igala", lines: 5, keys: ["recurring.agent.name"] },
];
