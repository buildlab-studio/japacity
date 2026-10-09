import { content, text } from "@japacity/content";
import type { Requirement } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { formatBand, formatMoney, formatRate } from "./format";
import { requirementSentence } from "./requirement";
import { LOWER_KINDS, lowerFirst, nameOf, PROPER_WORDS, runningName, say, words } from "./text";
import { uiText } from "./ui";

describe("words", () => {
  test("given naira, then the naira sign is used whatever the locale data", () => {
    expect(formatMoney(2_500_000, "NGN")).toMatch(/^₦25,000$/);
    expect(formatMoney(120_300, "GBP")).toMatch(/^£1,203$/);
  });

  test("given kobo, pence or cents, then money shows in whole major units and only a rate keeps two decimals", () => {
    expect(formatMoney(7_805_951, "NGN")).toBe("₦78,060");
    expect(formatMoney(150, "USD")).toBe("$2");
    expect(formatMoney(4, "NGN")).toBe("₦0");
    expect(formatRate(179_316, "NGN")).toBe("₦1,793.16");
  });

  test("given a content key with a money param, then the brace is filled with formatted money", () => {
    const filled = words("offer.land-buyer.body", { price: 900_000_000 });
    expect(filled).toBe(text["offer.land-buyer.body"]!.replace("{price}", formatMoney(900_000_000, "NGN")));
  });

  test("given a param that is an id, then its name from content is used, lower-cased in running text", () => {
    expect(words("ui.japacity.of", { route: "route.uk-masters" })).toBe(`on ${lowerFirst(text["route.uk-masters.name"]!)}`);
    expect(words("line.activity.hunt-missed", { job: "activity.job-teacher" })).toBe("You look for work: Private school teacher. Nothing yet.");
    expect(words("line.document.issued", { document: "document.english-test" })).toBe("Your English test result is ready.");
    expect(words("line.activity.hunt-hired", { job: "activity.job-teacher" })).toMatch(/\. Private school teacher wants you\.$/);
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

describe("names mid-sentence", () => {
  const firstWord = (name: string) => name.split(/[\s,']/)[0] ?? "";
  const isAcronym = (word: string) => word.length > 1 && word === word.toUpperCase();
  // Every id content names in a kind whose names run lowered mid-sentence.
  const lowered = Object.keys(text)
    .filter((key) => key.endsWith(".name") && LOWER_KINDS.has(key.split(".")[0] ?? ""))
    .map((key) => key.slice(0, -".name".length));
  /** True when content writes the word with a capital mid-sentence and never in lower case: a proper noun, as "Bank" in a bank's name is not. */
  const capitalMidSentence = (word: string) =>
    Object.values(text).some((value) => new RegExp(`[a-z,] ${word}\\b`).test(value)) &&
    !Object.values(text).some((value) => new RegExp(`\\b${word.toLowerCase()}\\b`).test(value));

  test("given every name content lowers mid-sentence, when its first word is one content writes with a capital mid-sentence, then the name keeps its capital", () => {
    const proper = lowered.filter((id) => {
      const first = firstWord(nameOf(id));
      return !isAcronym(first) && capitalMidSentence(first);
    });
    expect(proper.length).toBeGreaterThan(0);
    expect(proper.filter((id) => runningName(id) !== nameOf(id))).toEqual([]);
    expect(proper.filter((id) => !PROPER_WORDS.has(firstWord(nameOf(id))))).toEqual([]);
  });

  test("given every country in content, then a name that starts with it keeps its capital", () => {
    const countries = Object.keys(content.country).map((id) => firstWord(nameOf(id)));
    expect(countries.filter((first) => !PROPER_WORDS.has(first))).toEqual([]);
  });

  test("given a name that starts with a common word, then it is lowered mid-sentence, and an acronym is not", () => {
    const common = lowered.filter((id) => {
      const first = firstWord(nameOf(id));
      return !isAcronym(first) && !PROPER_WORDS.has(first);
    });
    expect(common.length).toBeGreaterThan(0);
    expect(common.filter((id) => runningName(id) !== lowerFirst(nameOf(id)) || runningName(id).charAt(0) !== nameOf(id).charAt(0).toLowerCase())).toEqual([]);
    expect(runningName("document.tb-certificate")).toBe(nameOf("document.tb-certificate"));
  });

  test("given every word kept as proper, then content writes it with a capital somewhere", () => {
    const all = Object.values(text).join(" ");
    expect([...PROPER_WORDS].filter((word) => !new RegExp(`\\b${word}\\b`).test(all))).toEqual([]);
  });
});

describe("requirement sentences", () => {
  const cases: [Requirement, string][] = [
    [{ type: "quality/min", quality: "quality.tech", value: 40 }, `${text["quality.tech.name"]!} 40 or more`],
    [{ type: "quality/min", quality: "quality.edu-grade", value: 3 }, `${text["quality.edu-grade.name"]!}: ${text["quality.edu-grade.value.3"]!} or better`],
    [{ type: "document/held", document: "document.passport" }, `${text["document.passport.name"]!} in hand`],
    [{ type: "document/held", document: "document.english-test", min: 60 }, say("ui.req.document-held-band", { document: text["document.english-test.name"]!, band: formatBand(60) })],
    [{ type: "route/state", route: "route.uk-masters", in: ["heard"] }, `Hear of ${lowerFirst(text["route.uk-masters.name"]!)} first`],
    [{ type: "route/state", route: "route.uk-masters", in: ["applying", "granted"] }, `${text["route.uk-masters.name"]!}: ${say("ui.route.state.applying")} or ${say("ui.route.state.granted")}`],
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
