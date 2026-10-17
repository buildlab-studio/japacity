// Luck in the offer roll: docs/rules/luck.md R-LUCK-001 to 004. Every rule
// here reads qualities, months and the place, never how little money the
// character holds, except the whip-round, whose page says so in the open.
import { BP_WHOLE, clamp, divFloor } from "../engine/int";
import type { Id, ObligationType, OfferEntry, ReadCtx, Requirement, Terms } from "../engine/types";
import { wealthInNaira } from "../place/place.logic";

const WELLBEING: Id<"quality"> = "quality.wellbeing";
const STANDING: Id<"quality"> = "quality.standing";
/** R-LUCK-002: the one rescue a life. */
export const WHIP_ROUND: Id<"offer"> = "offer.whip-round";
/** R-LUCK-007: the promo that pays when it is honest. */
const TELCO_PROMO: Id<"offer"> = "offer.telco-promo";

/** R-LUCK-002: the loans whose default rules the rescue out. Held funds are a loan too. */
const LOAN_TYPES: readonly ObligationType[] = ["loan", "group-loan", "held-funds"];

/** Every requirement in a list, the ones under `not` and `any` included. */
function flatten(requirements: readonly Requirement[]): Requirement[] {
  return requirements.flatMap((requirement): Requirement[] => {
    if (requirement.type === "not") return [requirement, ...flatten([requirement.of])];
    if (requirement.type === "any") return [requirement, ...flatten(requirement.of)];
    return [requirement];
  });
}

/** The requirement types that read money held or money moved. */
const MONEY_TYPES: readonly Requirement["type"][] = ["money/min", "money/can-pay", "wallet/total"];

/**
 * R-LUCK-001, for `checkContent`: true when a luck offer's `when` reads money,
 * directly or inside `not` or `any`. An entry that is not luck never fails.
 */
export function luckReadsMoney(entry: OfferEntry): boolean {
  if (entry.luck !== true) return false;
  return flatten(entry.when).some((requirement) => MONEY_TYPES.includes(requirement.type));
}

/** R-LUCK-003: wellbeing or standing under the line. Qualities only. */
export function isDown(read: ReadCtx): boolean {
  const { quality } = read.state;
  const { downUnder } = read.content.tuning.luck;
  return (quality[WELLBEING] ?? 0) < downUnder || (quality[STANDING] ?? 0) < downUnder;
}

/** Months since a luck offer last opened, counted from the start of the life when none ever has. */
export function monthsWithoutLuck(read: ReadCtx): number {
  const { state, content } = read;
  let last = 0;
  for (const entry of Object.values(content.offer)) {
    if (entry.luck !== true) continue;
    const opened = state.offer.lastOpened[entry.id];
    if (opened !== undefined && opened > last) last = opened;
  }
  return state.turn.month - last;
}

/** R-LUCK-004: what the dry spell adds to every luck entry's chance now. Months, never money. */
export function drySpellBp(read: ReadCtx): number {
  const { drySpellMonths, drySpellBp: perMonth, drySpellCapBp } = read.content.tuning.luck;
  const further = monthsWithoutLuck(read) - drySpellMonths;
  return further <= 0 ? 0 : Math.min(drySpellCapBp, further * perMonth);
}

/**
 * R-LUCK-003 and 004: an entry's chance after the marks. The marks
 * scale the chance the entry would otherwise roll at (its own, or the road's
 * pressure), and the dry spell is added after, so it is never doubled.
 */
export function markedChanceBp(read: ReadCtx, entry: OfferEntry, chance: number): number {
  const down = isDown(read);
  let marked = chance;
  if (down && entry.bad === true) marked = divFloor(chance, 2);
  if (down && entry.luck === true) marked = chance * 2;
  if (entry.luck === true) marked += drySpellBp(read);
  return clamp(marked, 0, BP_WHOLE);
}

/**
 * R-LUCK-002: the money and debt half of the whip-round's rule. The months
 * played and the place are in the entry's `when`. Bank and cash in every
 * currency, valued in naira at the official rate, under the line; no loan in
 * default.
 */
export function rescueDue(read: ReadCtx): boolean {
  const { state, content } = read;
  if (state.turn.month < content.tuning.luck.rescueAfterMonths || state.place.where !== "home") return false;
  if (wealthInNaira(read) >= content.tuning.luck.rescueUnder) return false;
  return !Object.values(state.obligation.items).some((item) => {
    const type = content.obligation[item.entry]?.type;
    return item.state === "defaulted" && type !== undefined && LOAN_TYPES.includes(type);
  });
}

/**
 * The tuning figures a luck offer pays, handed over as terms when it opens,
 * so the entry's effects read them and an overlay that changes the tuning
 * changes the payment (R-ENGINE-017).
 */
export function luckTerms(read: ReadCtx, entry: Id<"offer">): Terms {
  const { luck } = read.content.tuning;
  if (entry === WHIP_ROUND) return { rescue: luck.rescue };
  if (entry === TELCO_PROMO) return { promo: luck.promo };
  return {};
}
