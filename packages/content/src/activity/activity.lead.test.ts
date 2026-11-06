// The lead's words (activity:missed-hunt-opens-a-lead): every job a hunt at home may name has the place a lead names and
// what it costs the trade, Lanre gives the lead, and nothing in them says the job is sure.
import { describe, expect, test } from "vitest";

import { content, text } from "../index";

/** The jobs a hunt at home may name: a main or side job with a hiring chance that is not abroad's alone. */
const HOME_HUNTS = Object.values(content.activity).filter((entry) => entry.hireBp !== null && (entry.slot === "main" || entry.slot === "side") && entry.where !== "abroad");
const LEAD_KEYS = ["line.activity.hunt-lead", "line.activity.hunt-word", "offer.job-lead", "offer.job-word"];

describe("the lead's words", () => {
  test("[activity:missed-hunt-opens-a-lead] given every job a hunt at home may name, when its lead words are looked up, then it has the place a lead names and what a lead costs its trade", () => {
    expect(HOME_HUNTS.length).toBeGreaterThan(10);
    const missing = HOME_HUNTS.flatMap((entry) => [`${entry.id}.lead.name`, `${entry.id}.lead-cost.name`]).filter((key) => (text[key] ?? "").trim() === "");
    expect(missing).toEqual([]);
  });

  test("[activity:missed-hunt-opens-a-lead] given the lead's words, when they are read, then Lanre gives the lead, the place names no business, and nothing says the job is sure", () => {
    expect(text["offer.job-lead.who"]).toBe("Lanre");
    expect(text["offer.job-word.who"]).toBe("Lanre");
    const words = Object.entries(text).filter(([key]) => LEAD_KEYS.some((prefix) => key.startsWith(prefix)) || /\.lead(-cost)?\.name$/.test(key));
    expect(words.length).toBeGreaterThan(2 * HOME_HUNTS.length);
    expect(words.filter(([, line]) => /\b(sure|certain|guarantee[ds]?|promise[ds]?|for sure)\b/i.test(line)).map(([key]) => key)).toEqual([]);
    expect(text["activity.job-nurse.lead-cost.name"]).toBe("it will not count for the wards");
  });
});
