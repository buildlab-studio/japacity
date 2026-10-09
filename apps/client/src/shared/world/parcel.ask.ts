// The waybill at the cargo counter on Bode Thomas Street (docs/rules/world.md R-WORLD-006): the
// parcel's sheet takes the form of what it shows, a paper slip. It says who shipped it, to whom,
// what is in it and the clerk's charge, with the sender's note in their own words, and its one
// button collects it: the parcel offer answered with the one thing it holds. Pure: the screen
// hands in how to send and how to close.
import type { OfferView, PlayerView, ReportLine } from "@japacity/sim";

import { hasWords, nameOf, say, words } from "../words/text";
import type { Ask } from "./contract";

export const PARCEL = "offer.parcel-shipped";

export interface WaybillDeps {
  /** Sends the answer; the screen's own send, with what it does once the reply lands. */
  send: (offer: OfferView, choice: string) => Promise<ReportLine[] | null> | void;
  /** Closes the slip: not now, or done. */
  done: () => void;
  formatMoney: (amount: number, currency: string) => string;
}

/** The parcel waiting at the office, or undefined. */
export function waitingParcel(view: Pick<PlayerView, "offers">): OfferView | undefined {
  return view.offers.find((offer) => offer.entry === PARCEL);
}

/** The character's first name for the slip's To line; the prologue's life, with none in content, reads "You". */
function addressee(view: Pick<PlayerView, "scenario">): string {
  const key = `share.first-name.${view.scenario}`;
  return hasWords(key) ? say(key) : words(`${PARCEL}.waybill.you`);
}

/** The waybill's number: the parcel's own instance number, never a month. */
function numberOf(offer: OfferView): string {
  const digits = /(\d+)$/.exec(offer.id)?.[1] ?? "0";
  return `${words(`${PARCEL}.waybill.number`)} ${digits.padStart(6, "0")}`;
}

/** The slip for the parcel waiting, or null when none waits. */
export function parcelAsk(view: Pick<PlayerView, "offers" | "scenario">, deps: WaybillDeps): Ask | null {
  const offer = waitingParcel(view);
  // The view shows only the thing the parcel holds (the offer kind shuts the rest).
  const held = offer?.choices[0];
  if (offer === undefined || held === undefined) return null;
  const thing = held.id.slice(held.id.indexOf("-") + 1);
  const from = typeof offer.terms["from"] === "string" ? nameOf(offer.terms["from"]) : "";
  const handling = typeof offer.terms["handling"] === "number" ? offer.terms["handling"] : 0;
  return {
    form: "slip",
    icon: "ticket",
    who: words(`${PARCEL}.waybill.head`),
    reference: numberOf(offer),
    title: words(`${PARCEL}.title`),
    rows: [
      { label: words(`${PARCEL}.waybill.from`), value: from },
      { label: words(`${PARCEL}.waybill.to`), value: addressee(view) },
      { label: words(`${PARCEL}.waybill.contents`), value: words(`${PARCEL}.contents.${thing}`) },
      { label: words(`${PARCEL}.waybill.handling`), value: deps.formatMoney(handling, "NGN"), strong: true },
    ],
    line: `${words(`${PARCEL}.waybill.note`)} '${words(`${PARCEL}.note.${held.id}`)}'`,
    cost: { amount: handling, currency: "NGN" },
    when: "now",
    button: words(`${PARCEL}.choice.${held.id}`),
    act: () => {
      void deps.send(offer, held.id);
    },
    dismiss: deps.done,
  };
}
