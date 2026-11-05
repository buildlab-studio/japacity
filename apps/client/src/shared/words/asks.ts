// Who asks (text:voice-by-surface): the asker's name an ask's card and the month's results both show, so the two never
// name the same person two ways.
import { content } from "@japacity/content";
import type { OfferView as Offer } from "@japacity/sim";

import { hasWords, say } from "./text";

/**
 * An ask that may be a scam: an entry with a fraud share (the road's pitch, the message that says you have won, a sponsor
 * that may not be one). Its sender is an unknown number, and its card has no main button (advice:scams-show-their-tells).
 */
export function mayBeScam(offer: Pick<Offer, "entry">): boolean {
  return (content.offer[offer.entry]?.fraudBp ?? 0) > 0;
}

/** Who asks, by the offer's group: content names no speaker for each ask. */
const ASKER_BY_GROUP: Readonly<Record<string, string>> = { family: "Mama", job: "The board", money: "A friend", life: "Someone you know", road: "The agent", abroad: "A friend", return: "Mama" };

/** The asker's name: the ask's own where content names one, an unknown number for a scam, else by the group. */
export function askerOf(offer: Pick<Offer, "entry">): string {
  if (hasWords(`${offer.entry}.who`)) return say(`${offer.entry}.who`);
  if (mayBeScam(offer)) return say("ui.ask.unknown");
  return ASKER_BY_GROUP[content.offer[offer.entry]?.group ?? ""] ?? say("ui.ask.someone");
}
