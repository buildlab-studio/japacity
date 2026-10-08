import type { Id, Moment, PersonFacts, Proposal } from "../engine/types";

/** What the people kind records: docs/rules/people.md. */
export type PeopleEvent =
  | { type: "people/invited"; slot: string; looking: string; fill: string | null }
  | { type: "people/linked"; slot: string; bond: string; pair: string; facts: PersonFacts }
  | { type: "people/courted"; bond: string; with: string; role: "partner" | "sibling" }
  | { type: "people/moment-added"; bond: string; moment: Moment }
  | { type: "people/moments-synced"; bond: string; moments: Moment[] }
  | { type: "people/proposed"; bond: string; proposal: Proposal }
  | { type: "people/proposal-received"; bond: string; proposal: Proposal }
  | { type: "people/answered"; bond: string; step: Proposal["step"]; yes: boolean }
  | { type: "people/agreed"; bond: string; step: Proposal["step"]; route: Id<"route"> | null; lead: "me" | "them" | null; month: number }
  | { type: "people/declined"; bond: string; step: Proposal["step"] }
  | { type: "people/withdrawn"; bond: string }
  | { type: "people/consented"; bond: string; countFunds: boolean; standInMay: boolean }
  | { type: "people/ended"; bond: string; by: "me" | "them" | "absence" | "block" | "drift"; month: number }
  | { type: "people/facts-updated"; bond: string; facts: PersonFacts }
  | { type: "people/gossip-heard"; bond: string }
  | { type: "people/stand-in-changed"; bond: string; stage: "warned" | "on" | null }
  | { type: "people/request-shared"; offer: Id<"offer"> }
  // Added by the people kind: the sibling draw (R-PEOPLE-047), a card taken back (R-PEOPLE-010), gossip that reaches a partner (R-PEOPLE-041).
  | { type: "people/siblings-drawn"; siblings: { slot: string; bond: string; person: Id<"person">; facts: PersonFacts }[] }
  | { type: "people/invite-withdrawn"; slot: string }
  | { type: "people/gossip-spread"; bond: string; about: string }
  // A computer's yes to marrying that waits for December (R-PEOPLE-049).
  | { type: "people/wedding-waits"; bond: string };
