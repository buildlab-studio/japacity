// Things shipped home, as content holds them (offer.parcel.data.ts and its words).
import { describe, expect, test } from "vitest";

import { content, text } from "../index";
import { PARCEL, SENDERS, THINGS } from "./offer.parcel.data";

const entry = content.offer[PARCEL]!;
const { parcel } = content.tuning;

describe("the parcel offer", () => {
  test("[R-OFFER-005] given the parcel entry, when it is read, then it belongs at home, is never rolled, waits three months and lapses into nothing", () => {
    expect(entry).toMatchObject({ group: "life", where: "home", chanceBp: 0, expiresAfter: 3, onExpire: null, fraudBp: 0, signs: [] });
    expect(parcel.handling).toBe(150000);
  });

  test("[R-OFFER-003] given each of the parcel's choices, when its effects are read, then it first takes the handling charge from the naira, cash first, and then gives one thing", () => {
    expect(entry.choices.map((choice) => choice.id)).toEqual(SENDERS.flatMap((sender) => THINGS.map((thing) => `${sender}-${thing}`)));
    for (const choice of entry.choices) {
      expect(choice.effects[0]).toEqual({ type: "money/take", currency: "NGN", pocket: "any", amount: { term: "handling" }, reason: "upkeep" });
      expect(choice.effects.length).toBeGreaterThan(1);
      expect(choice.requires).toEqual([]);
    }
    expect(entry.terms["handling"]).toBe(parcel.handling);
  });
});

describe("the parcel's words", () => {
  const ours = Object.entries(text).filter(([key]) => key.startsWith(`${PARCEL}.`) || key.startsWith("line.obligation.relief.parcel-shipped."));

  test("[R-ENGINE-014] given every choice, when its words are looked up, then it has a button, a results line, the sender's note, and its thing has a line on the waybill", () => {
    for (const choice of entry.choices) {
      for (const part of ["choice", "said", "note"]) expect(text[`${PARCEL}.${part}.${choice.id}`], `${part}.${choice.id}`).toBeTruthy();
    }
    for (const thing of THINGS) expect(text[`${PARCEL}.contents.${thing}`]).toBeTruthy();
    expect(text[`${PARCEL}.from.aunty.name`]).toBeTruthy();
  });

  test("[R-WORLD-003] given the parcel's nudge, when it is counted, then it is one sentence of at most eight words", () => {
    const nudge = text[`${PARCEL}.nudge`] ?? "";
    expect(nudge.split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(nudge).not.toMatch(/[.!?]./);
  });

  test("[R-WORLD-006] given the board and the notice over the cargo booth, when they are read, then neither carries a figure of money", () => {
    for (const key of [`${PARCEL}.board`, `${PARCEL}.notice`]) {
      expect(text[key]).toBeTruthy();
      expect(text[key]).not.toMatch(/[₦$£€\d]/);
    }
  });

  test("[R-ENGINE-014] given every parcel word, when it is read, then the narrator never exclaims (the dashes are the words check's)", () => {
    expect(ours.length).toBeGreaterThan(30);
    expect(ours.filter(([, words]) => /!/.test(words)).map(([key]) => key)).toEqual([]);
  });
});
