import { content, text } from "@japacity/content";
import type { Requirement } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { formatBand, formatMoney } from "./format";
import { requirementSentence } from "./requirement";
import { say, words } from "./text";
import { uiText } from "./ui";

describe("words", () => {
  test("given naira, then the naira sign is used whatever the locale data", () => {
    expect(formatMoney(2_500_000, "NGN")).toMatch(/^₦25,000$/);
    expect(formatMoney(120_300, "GBP")).toMatch(/^£1,203$/);
    expect(formatMoney(150, "USD")).toMatch(/^\$1\.5$/);
  });

  test("given a content key with a money param, then the brace is filled with formatted money", () => {
    const filled = words("offer.land-buyer.body", { price: 900_000_000 });
    expect(filled).toBe(text["offer.land-buyer.body"]!.replace("{price}", formatMoney(900_000_000, "NGN")));
  });

  test("given a param that is an id, then its name from content is used", () => {
    expect(words("ui.japacity.of", { route: "route.uk-masters" })).toBe(`on ${text["route.uk-masters.name"]!}`);
  });

  test("given a missing key, then the key itself shows", () => {
    expect(words("line.nobody.wrote-this")).toBe("line.nobody.wrote-this");
  });

  test("given the interface's own words, then none uses an exclamation mark or a long dash", () => {
    for (const value of Object.values(uiText)) expect(value).not.toMatch(/[!–—]/);
  });

  test("given the interface's own keys, then none hides a key content already has", () => {
    expect(Object.keys(uiText).filter((key) => key in text)).toEqual([]);
  });
});

describe("requirement sentences", () => {
  const cases: [Requirement, string][] = [
    [{ type: "quality/min", quality: "quality.tech", value: 40 }, `${text["quality.tech.name"]!} 40 or more`],
    [{ type: "quality/min", quality: "quality.edu-grade", value: 3 }, `${text["quality.edu-grade.name"]!}: ${text["quality.edu-grade.value.3"]!} or better`],
    [{ type: "document/held", document: "document.passport" }, `${text["document.passport.name"]!} in hand`],
    [{ type: "document/held", document: "document.english-test", min: 60 }, say("ui.req.document-held-band", { document: text["document.english-test.name"]!, band: formatBand(60) })],
    [{ type: "route/state", route: "route.uk-masters", in: ["heard"] }, `${text["route.uk-masters.name"]!}: ${say("ui.route.state.heard")}`],
    [{ type: "money/min", currency: "NGN", amount: 15_000_000 }, `At least ${formatMoney(15_000_000, "NGN")}`],
    [{ type: "chapter/done", chapter: "chapter.find-your-feet" }, `Finish "${text["chapter.find-your-feet.name"]!}"`],
  ];

  test.each(cases)("given %j, then it reads as a sentence with content's names", (requirement, sentence) => {
    expect(requirementSentence(requirement)).toBe(sentence);
  });

  test("given every requirement in content's activities, then each has a sentence with no raw braces", () => {
    const all = Object.values(content.activity).flatMap((entry) => entry.requires);
    for (const requirement of all) expect(requirementSentence(requirement)).not.toMatch(/[{}]/);
  });
});
