// What the way home would cost and how it would read, worked out from the view
// and content's country table before the player commits. The engine still
// decides (R-PLACE-004 to 007); these figures only say what to expect.
import { content } from "@japacity/content";
import type { Currency, Id, PlayerView, ReturnShape } from "@japacity/sim";

import { atBankRate, nairaForFee } from "./cost";
import { CURRENCIES } from "./format";

type Money = { currency: Currency; amount: number };

/** The currency of the country the character is in, or null at home and on the road. */
export function localCurrency(view: Pick<PlayerView, "place">): Currency | null {
  const { where, country } = view.place;
  if (where !== "abroad" || country === null) return null;
  return content.country[country]?.currency ?? null;
}

/**
 * A settled, citizen or permanent resident status: it never expires and is not
 * the country's overstayer. The same reading the status kind makes.
 */
export function isKept(status: Id<"status">): boolean {
  const entry = content.status[status];
  if (entry === undefined) return false;
  return entry.months === null && content.country[entry.country]?.overstayer !== status;
}

/** No status, or only the country's overstayer status, which is no permission to be there. */
export function holdsNoStatus(view: Pick<PlayerView, "place" | "status">): boolean {
  if (view.status === null) return true;
  const country = view.place.country;
  return country !== null && content.country[country]?.overstayer === view.status.entry;
}

export interface WayHome {
  /** The fare today, in the country's currency: the view's `fareHome`, the December factor already in it (R-PLACE-009). */
  fare: Money;
  /** The fare off peak, from the country's entry. */
  offPeak: Money;
  /** Where the fare comes from: the country's own money, naira at the bank rate, or nobody. */
  paidFrom: "local" | "naira" | null;
  /** The naira the fare takes when it is bought from naira, with the bank's charge. */
  naira: number;
  /** The shape the return would take today. Null when there is no way home today. */
  shape: ReturnShape | null;
  /** Standing at home on the day: the shape's own figure plus the capital in the naira bank. */
  standing: number;
}

/** Every pocket's bank and cash, in kobo at the bank rate. */
function wealthInNaira(view: Pick<PlayerView, "pockets" | "rates">): number {
  return CURRENCIES.reduce((sum, currency) => {
    const pocket = view.pockets[currency];
    return sum + atBankRate(view, currency, pocket.bank + pocket.cash);
  }, 0);
}

function capitalBonus(nairaBank: number): number {
  const numbers = content.tuning.return;
  const above = nairaBank - content.tuning.place.brokeLine;
  return above <= 0 ? 0 : Math.min(numbers.capitalCap, Math.floor(above / numbers.capitalPer));
}

/** The way home from where the character is today, or null when not abroad. */
export function wayHome(view: Pick<PlayerView, "place" | "status" | "pockets" | "rates">): WayHome | null {
  const country = view.place.country;
  const entry = country === null ? undefined : content.country[country];
  if (view.place.where !== "abroad" || entry === undefined) return null;
  const offPeak: Money = { currency: entry.currency, amount: entry.fare };
  const fare: Money = view.place.fareHome ?? offPeak;
  const pocket = view.pockets[fare.currency];
  const naira = nairaForFee(view, fare.currency, fare.amount);
  const paidFrom =
    pocket.bank + pocket.cash >= fare.amount
      ? "local"
      : content.tuning.place.fareFromNaira && fare.currency !== "NGN" && view.pockets.NGN.bank >= naira
        ? "naira"
        : null;
  const none = holdsNoStatus(view);
  let shape: ReturnShape | null;
  let nairaBank = view.pockets.NGN.bank;
  if (paidFrom === null) shape = none ? "assisted" : null;
  else {
    const spent = paidFrom === "local" ? atBankRate(view, fare.currency, fare.amount) : naira;
    if (paidFrom === "naira") nairaBank -= naira;
    if (wealthInNaira(view) - spent < content.tuning.place.brokeLine) shape = "broke";
    else if (view.status !== null && isKept(view.status.entry)) shape = "with-papers";
    else shape = "by-choice";
  }
  const standing = shape === null ? 0 : content.tuning.return.standing[shape] + capitalBonus(nairaBank);
  return { fare, offPeak, paidFrom, naira, shape, standing };
}
