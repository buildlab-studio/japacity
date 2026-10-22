import { content, text, uiText } from "@japacity/content";
import type { Requirement } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { formatBand, formatMoney, formatRate } from "./format";
import { newGame } from "../testing/fixtures";
import { jobCardWords } from "./jobs";
import { valueWords } from "./quality";
import { requirementSentence } from "./requirement";
import { LOWER_KINDS, lowerFirst, nameOf, PROPER_WORDS, runningName, say, words } from "./text";

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
    expect(words("line.activity.hunt-missed", { job: "activity.job-teacher" })).toBe("You looked for work: Private school teacher. Nothing yet.");
    expect(words("line.document.issued", { document: "document.english-test" })).toBe("Your English test result is ready.");
    expect(words("line.activity.hunt-hired", { job: "activity.job-teacher" })).toMatch(/\. Private school teacher wants you\.$/);
  });

  test("given a missing key, then the key itself shows", () => {
    expect(words("line.nobody.wrote-this")).toBe("line.nobody.wrote-this");
  });

  test("given the interface's own words, then none uses an exclamation mark or a long dash", () => {
    for (const value of Object.values(uiText)) expect(value).not.toMatch(/[!–—]/);
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
    // A quality's gate is said by its band, never its figure (text:bands-not-figures).
    [{ type: "quality/min", quality: "quality.tech", value: 40 }, say("ui.req.band.quality.tech.1")],
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

describe("a job's gates in words", () => {
  test("[text:bands-not-figures] given every job's gates in content, when they are said, then each quality is said by its band, never its figure", () => {
    const jobs = Object.values(content.activity).filter((entry) => entry.pay !== null && entry.pay !== undefined);
    const gates = jobs.flatMap((entry) => entry.requires).filter((requirement) => requirement.type === "quality/min" || requirement.type === "quality/max");
    expect(gates.length).toBeGreaterThan(0);
    for (const gate of gates) expect(requirementSentence(gate)).not.toMatch(/\d/);
  });

  test("[text:bands-not-figures] given a job's gates, when they are said, then they read as a person would say them", () => {
    expect(requirementSentence({ type: "quality/min", quality: "quality.english", value: 50 })).toBe("More than basic English");
    expect(requirementSentence({ type: "quality/min", quality: "quality.tech", value: 60 })).toBe("Good tech");
    expect(requirementSentence({ type: "quality/min", quality: "quality.portfolio", value: 3 })).toBe("A portfolio with a few pieces");
    expect(requirementSentence({ type: "quality/min", quality: "quality.driving", value: 1 })).toBe("Someone who can drive");
    expect(say("jobs.needs", { needs: requirementSentence({ type: "quality/min", quality: "quality.english", value: 50 }) })).toBe("Needs: More than basic English");
  });

  test("[text:bands-not-figures] given a job that asks for time in another, when its gate is said, then the time reads as a person says it and the job as the person who does it", () => {
    expect(requirementSentence({ type: "activity/tenure", activities: ["activity.job-bank-officer"], months: 36 })).toBe("Three years as a bank officer");
    expect(say("jobs.needs", { needs: requirementSentence({ type: "activity/tenure", activities: ["activity.job-bank-officer"], months: 36 }) })).toBe("Needs: Three years as a bank officer");
    expect(requirementSentence({ type: "activity/tenure", activities: ["activity.job-nurse"], months: 24 })).toBe(`Two years as a ${runningName("activity.job-nurse")}`);
    expect(requirementSentence({ type: "activity/tenure", activities: ["activity.job-junior-developer", "activity.job-mid-developer"], months: 6 })).toBe(`Six months as a ${runningName("activity.job-junior-developer")} or a ${runningName("activity.job-mid-developer")}`);
    expect(requirementSentence({ type: "activity/tenure", activities: [], months: 24 })).toBe("Two years in any job");
    expect(requirementSentence({ type: "activity/tenure", activities: [], months: 1 })).toBe("One month in any job");
    expect(requirementSentence({ type: "activity/tenure", activities: [], months: 18 })).toBe("18 months in any job");
    // Every tenure gate in content reads with no "months in" a job's name.
    const gates = Object.values(content.activity).flatMap((entry) => entry.requires).filter((requirement) => requirement.type === "activity/tenure");
    expect(gates.length).toBeGreaterThan(0);
    for (const gate of gates) expect(requirementSentence(gate)).not.toMatch(/months in (?!any job)/);
  });

  test("[text:bands-not-figures] given the handover's life so far, when the portfolio is read, then it is said in words, not as a figure", () => {
    for (let value = 0; value <= (content.quality["quality.portfolio"]?.max ?? 10); value += 1) expect(valueWords("quality.portfolio", value)).not.toMatch(/\d/);
    expect(valueWords("quality.portfolio", 1)).toBe(say("ui.band.quality.portfolio.0"));
  });

  test("[text:bands-not-figures] given every quality the player is shown, when its move is told, then it is said in words, never as a figure", () => {
    // The age is a figure by nature; the degree's level and grade are named by the prologue's own lines (prologue:view-shows-step-card).
    const named = new Set(["quality.age-months", "quality.edu-level", "quality.edu-grade"]);
    const shown = Object.values(content.quality).filter((entry) => entry.shown && !named.has(entry.id));
    expect(shown.length).toBeGreaterThan(8);
    for (const entry of shown) {
      for (const value of [entry.min, entry.max]) {
        expect(words("line.quality.gain", { quality: entry.id, points: 1, value })).not.toMatch(/\d/);
        expect(valueWords(entry.id, value)).not.toMatch(/\d/);
      }
    }
  });
});

describe("the words the world's sheets borrow", () => {
  test("[world:one-action-one-sheet] given every route that flies, when the plane's line is said, then it names the country, never the route's name with an apostrophe", () => {
    const countries = new Set(Object.values(content.route).flatMap((route) => (route?.country === undefined || route.country === null ? [] : [route.country])));
    expect(countries.size).toBeGreaterThan(0);
    for (const country of countries) {
      const line = say("ui.world.depart-line", { country: say(`ui.country.place.${country}`) });
      expect(line).not.toMatch(/\{|'s\.$|ui\./);
    }
    expect(say("ui.world.depart-line", { country: say("ui.country.place.country.uk") })).toBe("The visa is in your passport. Board, and the next place is the UK.");
  });

  // The journey, not the wait (text:voice-by-surface): the asks say who is asking, never who waits.
  test("[world:one-action-one-sheet] [chapter:family-marks-the-grant] given the send-off asked at the family house, when the asks say who is asking, then Mama is named and home is the place", () => {
    expect(say("ui.world.ask-away.place.family-house")).toBe("Mama is asking for you at home.");
    expect(say("ui.world.ask-away.place.family-house")).toContain(text["family.from.mum"] ?? "-");
  });

  test("[world:things-are-tappable-models] given the night shift beside a day job, when its card words are read, then they carry its pay a month and its chance, as the board's do", () => {
    const view = newGame("scenario.graduate").view();
    const said = jobCardWords(view, "activity.night-support");
    const pay = content.activity["activity.night-support"]?.pay;
    if (pay === null || pay === undefined || typeof pay.amount !== "number") throw new Error("The night shift has no pay.");
    expect(said).toContain(formatMoney(pay.amount, pay.currency));
    expect(["jobs.chance.likely", "jobs.chance.fair", "jobs.chance.long"].some((key) => said.includes(say(key)))).toBe(true);
  });
});
