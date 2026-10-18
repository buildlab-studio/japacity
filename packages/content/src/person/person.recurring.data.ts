// The recurring people: the same few faces month
// after month, each with a voice players can quote. Their words are
// `recurring.<role>.name`, `.blurb` and `.line.<n>` in person.recurring.text.ts.
// Names come from the pool (person.names.data.ts); who holds which role is
// chosen apart from the name, and no people holds two roles that take money.
import type { NamedPerson } from "./person.names.data";

/** advice:advisers-are-invented-people: the agents at the stop (`tout`, `runner`, `middleman`), the desk upstairs (`agent`) and the adviser. */
export type RecurringRole = "fx" | "landlord" | "auntie" | "agent" | "tout" | "runner" | "middleman" | "adviser";

export interface RecurringPerson extends NamedPerson {
  role: RecurringRole;
  /** How many quotable lines, `.line.1` up to this: three to five. */
  lines: number;
}

export const recurringPeople: RecurringPerson[] = [
  { role: "fx", name: "Ochai", people: "idoma", lines: 5, keys: ["recurring.fx.name"] },
  { role: "landlord", name: "Ovie", people: "urhobo-isoko", lines: 5, keys: ["recurring.landlord.name"] },
  { role: "auntie", name: "Ladi", people: "hausa-fulani", lines: 5, keys: ["recurring.auntie.name"] },
  { role: "agent", name: "Ameh", people: "igala", lines: 5, keys: ["recurring.agent.name", "offer.agent-office.who.1.name"] },
  { role: "tout", name: "Efosa", people: "edo", lines: 3, keys: ["recurring.tout.name", "offer.agent-stop.who.1.name"] },
  { role: "runner", name: "Timi", people: "ijaw", lines: 3, keys: ["recurring.runner.name", "offer.agent-stop.who.2.name"] },
  { role: "middleman", name: "Nsikak", people: "efik-ibibio", lines: 3, keys: ["recurring.middleman.name", "offer.agent-stop.who.3.name"] },
  { role: "adviser", name: "Yagana", people: "kanuri", lines: 3, keys: ["recurring.adviser.name"] },
];
