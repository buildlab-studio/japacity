// Things shipped home: on a birthday, a relative abroad ships the character something, and it
// waits at the cargo office on Bode Thomas Street (the content's offer.parcel.data.ts). The offer
// kind opens it by this rule, after the month's rolls so it moves none of them, and never by a
// roll of its own: the entry's chance is zero. Its `when` says who may send one; this file says
// when (the birthday month), who did (a computer sibling abroad, else the aunty), and which of
// the sender's things is in it (one draw on `offer`).
import { check } from "../engine/check";
import type { Id, OfferChoice, OfferEntry, OfferState, Random, ReadCtx, State, Terms } from "../engine/types";

export const PARCEL: Id<"offer"> = "offer.parcel-shipped";
/** The term naming who shipped it: a computer sibling's person entry, or the aunty's words key. */
const FROM = "from";
/** The term naming the one choice the parcel holds. */
const HOLDS = "holds";
const AUNTY = `${PARCEL}.from.aunty`;

const MONTHS_A_YEAR = 12;

/** The month the character turns a year older: the age, counted in months, is a whole number of years. */
export function birthdayMonth(state: State): boolean {
  const age = state.quality["quality.age-months"] ?? 0;
  return age > 0 && age % MONTHS_A_YEAR === 0;
}

/**
 * Who ships the parcel, or null while no relative abroad is in the story (the entry's `when`): the
 * first computer sibling whose facts put them abroad, by bond id, else the aunty abroad, who is in
 * the story once she has heard the character is travelling. A real player's sibling never sends
 * one, since the game never speaks for another life and nothing passes between lives (person.md
 * R-PEOPLE-004, R-PEOPLE-058): with only a real sibling abroad, the aunty sends it.
 */
export function parcelSender(read: ReadCtx): { sender: "sibling" | "aunty"; from: string } | null {
  const entry = read.content.offer[PARCEL];
  if (entry === undefined || !entry.when.every((requirement) => check(read, requirement).met)) return null;
  const bonds = Object.entries(read.state.people.bonds).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [, bond] of bonds) {
    if (bond.role === "sibling" && bond.stage !== "ended" && bond.with.kind === "computer" && bond.facts?.where === "abroad") return { sender: "sibling", from: bond.with.entry };
  }
  return { sender: "aunty", from: AUNTY };
}

/** The sender's choices, in content's order: those whose id starts with the sender's name. */
function choicesOf(entry: OfferEntry, sender: string): OfferChoice[] {
  return entry.choices.filter((choice) => choice.id.startsWith(`${sender}-`));
}

/**
 * What a parcel carries as it opens (R-OFFER-002): who sent it, the one choice it holds, drawn on
 * `offer` among the sender's, and the live tuning's handling charge, so an overlay moves it. A
 * `holds` handed over by the effect that opened it wins, as every handed-over term does.
 */
export function parcelTerms(read: ReadCtx, random: Random, entry: OfferEntry): Terms {
  if (entry.id !== PARCEL) return {};
  const sender = parcelSender(read) ?? { sender: "aunty" as const, from: AUNTY };
  const choices = choicesOf(entry, sender.sender);
  const held = choices.length === 0 ? null : choices[random.int("offer", choices.length)];
  return { [FROM]: sender.from, [HOLDS]: held?.id ?? "", handling: read.content.tuning.parcel.handling };
}

/** Only the thing in the parcel can be collected: every other choice of the entry is shut. */
export function parcelHolds(item: Pick<OfferState, "entry" | "terms">, choice: Pick<OfferChoice, "id">): boolean {
  return item.entry !== PARCEL || item.terms[HOLDS] === choice.id;
}
