// Ask titles in the person's voice (docs/design/09-the-games-look.md section 4): every ask names who asks, its title is at most three words in their voice and never a rule's label, its line is
// one sentence, and the registers hold (text:voice-by-surface): an office abroad, a bank, a school or a court speaks plain English,
// never Pidgin. The scam text's shout is the one exception text:voice-by-surface allows, and it stays an unknown number.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { faceMark } from "../../shared/ui/look/Face";
import { say } from "../../shared/words/text";
import { askerOf } from "./OfferView";

const offers = Object.keys(content.offer);
/** The lines a scam shouts, one of text:voice-by-surface's exceptions. */
const SHOUTS = new Set(["offer.telco-promo"]);
/** The askers who speak plain English: offices, firms, the school, the court and the bank. */
const PLAIN = new Set(["Your bank", "The school", "A hospital trust", "A care home", "A tech firm", "An agency", "Your manager", "The assistance office", "The court", "The migration agency", "The employer", "Your employer", "A recruiter"]);
/** Pidgin's tells: none in a plain speaker's words. */
const PIDGIN = /\b(o|abeg|wahala|don|dey|na|fit|sef|oga|abi)\b/i;

describe("the ask in the person's voice", () => {
  test("[text:voice-by-surface] given every ask in content, when its title is read, then it is at most three words and never one of the bare labels", () => {
    const long = offers.filter((id) => (text[`${id}.title`] ?? "").split(/\s+/).length > 3);
    expect(long).toEqual([]);
    // The bare labels and rule words are never an ask's title.
    const labels = ["Salary loan", "Fuel scarcity", "Social assistance", "A job offer", "Harvest pledge", "Join the savings circle (ajo)", "Olokun Microfinance: proof of funds", "The family meeting"];
    expect(offers.map((id) => text[`${id}.title`]).filter((title) => labels.includes(title ?? ""))).toEqual([]);
  });

  test("[text:voice-by-surface] given every ask in content, when who asks is read, then each names its person, and only the scam text is an unknown number", () => {
    const unnamed = offers.filter((id) => askerOf({ entry: id as never }) === say("ui.ask.someone"));
    expect(unnamed).toEqual([]);
    expect(askerOf({ entry: "offer.telco-promo" })).toBe(say("ui.ask.unknown"));
    expect([askerOf({ entry: "offer.salary-loan" }), askerOf({ entry: "offer.brother-fees" }), askerOf({ entry: "offer.fuel-scarcity" })]).toEqual(["Your bank", "Your brother", "The conductor"]);
  });

  test("[text:voice-by-surface] [text:bands-not-figures] given every ask's line, when it is read, then it is one sentence and says no percentage", () => {
    const sentences = (line: string): number => line.split(/(?<=[.?!])['"]?\s+(?=['"]?[A-Z])/).length;
    const long = offers.filter((id) => !SHOUTS.has(id) && sentences(text[`${id}.body`] ?? "") > 1);
    expect(long).toEqual([]);
    expect(offers.filter((id) => (text[`${id}.body`] ?? "").includes("%"))).toEqual([]);
  });

  test("[text:voice-by-surface] given an ask from an office, a firm, the school, the court or the bank, when its title and line are read, then they are plain English with no Pidgin", () => {
    const plain = offers.filter((id) => PLAIN.has(askerOf({ entry: id as never })));
    expect(plain.length).toBeGreaterThan(8);
    const broken = plain.filter((id) => PIDGIN.test(`${text[`${id}.title`] ?? ""} ${text[`${id}.body`] ?? ""}`));
    expect(broken).toEqual([]);
  });
});

describe("the ask's quotes and mark", () => {
  test("[text:voice-by-surface] given every ask's line, when it is read, then speech wears curly double quotes and no straight single quote opens a quoted part", () => {
    const straight = offers.filter((id) => /(^|[\s:(])'/.test(text[`${id}.body`] ?? ""));
    expect(straight).toEqual([]);
    expect(text["offer.brother-fees.body"]?.startsWith("“")).toBe(true);
    expect(text["offer.brother-fees.body"]?.endsWith("”")).toBe(true);
    expect(text["offer.land-buyer.body"]).toContain("“I will pay");
  });

  test("[text:voice-by-surface] given who asks, when the mark is drawn, then it carries the first letter of who they are, never of Your or The", () => {
    expect(faceMark("Your brother").initial).toBe("B");
    expect(faceMark("The conductor").initial).toBe("C");
    expect(faceMark("A recruiter").initial).toBe("R");
    expect(faceMark("Mama").initial).toBe("M");
    expect(faceMark("Your brother").colour).toBe(faceMark("Your brother").colour);
  });
});
