// The japa type's words and the ticket stub's (decision 0018; docs/rules/share.md R-SHARE-004 to 006):
// six labels, each with one line in a person's voice, and the stub's four field names. None carries a
// figure, a currency, an airline's or an airport's word, or anything a bank or a government would print.
import { describe, expect, test } from "vitest";

import { japaTypes, text } from "../index";

const MONEY = /[₦£$€]|\bnaira\b|\bpounds?\b|\bdollars?\b|\beuros?\b|\bkobo\b|\d/i;
const OFFICIAL = /alert|credit|debit|transaction|receipt|ref(?:erence)?\b|account no|balance|transfer|embassy|home office|ministry|approved|stamp/i;
const TRAVEL = /airline|airways|barcode|boarding pass|\bseat\b|\bgate\b|flight (?:no|number)|booking|e-ticket|terminal|passport/i;
const FIELDS = ["from", "to", "months", "japacity"] as const;

function stubWords(): string[] {
  return [...FIELDS.map((field) => text[`share.stub.${field}`] ?? ""), text["share.stub.home"] ?? "", text["share.stub.kicker"] ?? "", text["share.stub.ready"] ?? "", text["share.stub.badge"] ?? ""];
}

describe("the japa type's words", () => {
  test("[R-SHARE-004] given the six types of decision 0018, when their words are looked up, then each has a name and one line", () => {
    expect([...japaTypes]).toEqual(["careful-saver", "hustler", "night-reader", "family-anchor", "gambler", "long-way-round"]);
    expect(japaTypes.map((type) => text[`share.type.${type}.name`])).toEqual(["The Careful Saver", "The Hustler", "The Night Reader", "The Family Anchor", "The Gambler", "The Long Way Round"]);
    for (const type of japaTypes) {
      const line = text[`share.type.${type}.line`] ?? "";
      expect(line.trim()).not.toBe("");
      // One line: a sentence or two, short enough for the badge.
      expect(line.length).toBeLessThanOrEqual(60);
    }
  });

  test("[R-SHARE-005] [R-SHARE-006] given the types' words and the stub's, when searched, then none carries a figure, a sum, an official word or a ticket's machinery", () => {
    const all = [...japaTypes.flatMap((type) => [text[`share.type.${type}.name`] ?? "", text[`share.type.${type}.line`] ?? ""]), ...stubWords()];
    for (const words of all) {
      expect(words).not.toMatch(MONEY);
      expect(words).not.toMatch(OFFICIAL);
      expect(words).not.toMatch(TRAVEL);
    }
  });

  test("[R-SHARE-004] given the stub, when its words are looked up, then it names FROM, TO, MONTHS and JAPACITY, and home is Lagos", () => {
    expect(FIELDS.map((field) => text[`share.stub.${field}`])).toEqual(["From", "To", "Months", "Japacity"]);
    expect(text["share.stub.home"]).toBe("Lagos");
    for (const words of stubWords()) expect(words.trim()).not.toBe("");
  });
});
