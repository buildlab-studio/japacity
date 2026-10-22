// The waybill at the cargo counter on Bode Thomas Street (world:one-action-one-sheet): the
// parcel's sheet takes the form of what it shows, a paper slip. It says who shipped it, to whom,
// what is in it and the clerk's charge, with the sender's note in their own words, and its one
// button collects it: the parcel offer answered with the one thing it holds. Pure: the screen
// hands in how to send and how to close.
import type { OfferView, PlayerView, ReportLine } from "@japacity/sim";

import { readPerson } from "../front-door/person";
import { nameOf, words } from "../words/text";
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
function waitingParcel(view: Pick<PlayerView, "offers">): OfferView | undefined {
  return view.offers.find((offer) => offer.entry === PARCEL);
}

/** The slip's To line: the kept person's first name (account:person-kept-with-character); "You" with none, since no life carries a name of its own in content (scenario.md). */
function addressee(): string {
  const given = readPerson()?.name.trim() ?? "";
  return given !== "" ? given : words(`${PARCEL}.waybill.you`);
}

/** The waybill's number: the parcel's own instance number, never a month. */
function numberOf(offer: OfferView): string {
  const digits = /(\d+)$/.exec(offer.id)?.[1] ?? "0";
  return `${words(`${PARCEL}.waybill.number`)} ${digits.padStart(6, "0")}`;
}

/** The slip for the parcel waiting, or null when none waits. */
export function parcelAsk(view: Pick<PlayerView, "offers">, deps: WaybillDeps): Ask | null {
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
      { label: words(`${PARCEL}.waybill.to`), value: addressee() },
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
