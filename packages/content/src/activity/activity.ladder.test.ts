// The trades' ladders and side jobs read back against activity.md's tables: activity:each-trade-climbs-its-ladder,
// activity:capital-opens-own-work, activity:side-jobs-pay-by-tier and the employer each naira job carries for activity:naira-pay-reviewed-yearly.
import type { ActivityEntry, Id, Requirement } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { content } from "../index";
import { dollars, naira, pct } from "../units";

function entryOf(id: string): ActivityEntry {
  const entry = content.activity[id as Id<"activity">];
  if (entry === undefined) throw new Error(`No ${id} in content.`);
  return entry;
}

const NURSE_JOBS = ["activity.job-nurse", "activity.job-senior-nurse", "activity.job-ward-manager"];
const TEACHER_JOBS = ["activity.job-teacher", "activity.job-senior-teacher", "activity.job-head-of-department"];
const SUPPORT_JOBS = ["activity.job-customer-service", "activity.job-team-lead", "activity.job-remote-support", "activity.night-support"];
const FISH_JOBS = ["activity.job-fish-racks", "activity.job-fish-smoker", "activity.job-fish-trader"];
const ACCOUNTING_JOBS = [
  "activity.job-accounts-officer",
  "activity.job-chartered-accountant",
  "activity.job-finance-manager",
  "activity.job-bank-officer",
  "activity.job-bank-senior",
  "activity.job-relationship-manager",
];

const atLeast = (quality: string, value: number): Requirement => ({ type: "quality/min", quality: quality as Id<"quality">, value });
const across = (activities: string[], months: number): Requirement => ({ type: "activity/tenure", activities: activities as Id<"activity">[], months });
const held = (document: string): Requirement => ({ type: "document/held", document: document as Id<"document"> });

interface Rung {
  id: string;
  pay: ActivityEntry["pay"];
  requires: Requirement[];
  hireBp: number | null;
  employer: ActivityEntry["employer"];
}

/** activity.md, "Jobs: the ladders", row by row: pay, what it asks, the hire chance and the employer. */
const RUNGS: Rung[] = [
  { id: "activity.job-nurse", pay: { currency: "NGN", amount: naira(180000) }, requires: [atLeast("quality.care", 60)], hireBp: pct(50), employer: "formal" },
  { id: "activity.job-senior-nurse", pay: { currency: "NGN", amount: naira(280000) }, requires: [across(NURSE_JOBS, 30), atLeast("quality.care", 70)], hireBp: pct(30), employer: "formal" },
  {
    id: "activity.job-ward-manager",
    pay: { currency: "NGN", amount: naira(420000) },
    requires: [across(NURSE_JOBS, 60), atLeast("quality.care", 80), atLeast("quality.standing", 50)],
    hireBp: pct(20),
    employer: "formal",
  },
  { id: "activity.job-teacher", pay: { currency: "NGN", amount: naira(90000) }, requires: [atLeast("quality.education-level", 3)], hireBp: pct(70), employer: "informal" },
  {
    id: "activity.job-senior-teacher",
    pay: { currency: "NGN", amount: naira(220000) },
    requires: [across(TEACHER_JOBS, 18), atLeast("quality.english", 60), held("document.trcn")],
    hireBp: pct(40),
    employer: "formal",
  },
  {
    id: "activity.job-head-of-department",
    pay: { currency: "NGN", amount: naira(400000) },
    requires: [across(TEACHER_JOBS, 48), { type: "any", of: [atLeast("quality.education-level", 4), atLeast("quality.standing", 60)] }],
    hireBp: pct(20),
    employer: "formal",
  },
  { id: "activity.job-customer-service", pay: { currency: "NGN", amount: naira(110000) }, requires: [atLeast("quality.education-level", 1)], hireBp: pct(60), employer: "formal" },
  { id: "activity.job-team-lead", pay: { currency: "NGN", amount: naira(220000) }, requires: [across(SUPPORT_JOBS, 18), atLeast("quality.english", 60)], hireBp: pct(35), employer: "formal" },
  {
    id: "activity.job-remote-support",
    pay: { currency: "USD", amount: dollars(500) },
    requires: [across(SUPPORT_JOBS, 24), atLeast("quality.english", 70), atLeast("quality.tech", 20)],
    hireBp: pct(15),
    employer: undefined,
  },
  { id: "activity.job-phone-sales", pay: { currency: "NGN", amount: naira(70000) }, requires: [atLeast("quality.education-level", 1)], hireBp: pct(60), employer: "informal" },
  {
    id: "activity.job-shop-supervisor",
    pay: { currency: "NGN", amount: naira(120000) },
    requires: [across(["activity.job-phone-sales"], 12), atLeast("quality.network", 30)],
    hireBp: pct(40),
    employer: "informal",
  },
  { id: "activity.run-shop", pay: { currency: "NGN", amount: naira(180000) }, requires: [], hireBp: null, employer: "own" },
  { id: "activity.job-fish-smoker", pay: { currency: "NGN", amount: naira(120000) }, requires: [across(["activity.job-fish-racks"], 12)], hireBp: null, employer: "own" },
  { id: "activity.job-fish-trader", pay: { currency: "NGN", amount: naira(200000) }, requires: [across(FISH_JOBS, 30)], hireBp: null, employer: "own" },
  {
    id: "activity.job-bank-officer",
    pay: { currency: "NGN", amount: naira(320000) },
    requires: [atLeast("quality.education-level", 3), atLeast("quality.education-grade", 3)],
    hireBp: pct(20),
    employer: "formal",
  },
  { id: "activity.job-bank-senior", pay: { currency: "NGN", amount: naira(560000) }, requires: [across(["activity.job-bank-officer"], 36)], hireBp: pct(25), employer: "formal" },
  {
    id: "activity.job-relationship-manager",
    pay: { currency: "NGN", amount: naira(900000) },
    requires: [across(["activity.job-bank-senior"], 36), atLeast("quality.network", 50)],
    hireBp: pct(15),
    employer: "formal",
  },
  { id: "activity.job-accounts-officer", pay: { currency: "NGN", amount: naira(200000) }, requires: [atLeast("quality.education-level", 3)], hireBp: pct(50), employer: "formal" },
  {
    id: "activity.job-chartered-accountant",
    pay: { currency: "NGN", amount: naira(400000) },
    requires: [across(ACCOUNTING_JOBS, 24), held("document.ican")],
    hireBp: pct(35),
    employer: "formal",
  },
  {
    id: "activity.job-finance-manager",
    pay: { currency: "NGN", amount: naira(700000) },
    requires: [across(["activity.job-chartered-accountant"], 36), atLeast("quality.network", 40)],
    hireBp: pct(20),
    employer: "formal",
  },
  {
    id: "activity.job-junior-developer",
    pay: { currency: "NGN", amount: naira(320000) },
    requires: [atLeast("quality.tech", 30), { type: "any", of: [atLeast("quality.portfolio", 1), { type: "prologue/answered", step: "course", answer: "computer-science" }] }],
    hireBp: pct(35),
    employer: "formal",
  },
];

describe("the trades' ladders", () => {
  test("[activity:each-trade-climbs-its-ladder] given activity.md's ladders table, when each rung is read, then its pay, what it asks, its hire chance and its employer are the table's", () => {
    for (const rung of RUNGS) {
      const entry = entryOf(rung.id);
      expect({ id: rung.id, slot: entry.slot, pay: entry.pay, requires: entry.requires, hireBp: entry.hireBp, employer: entry.employer }).toEqual({ ...rung, slot: "main" });
    }
  });

  test("[activity:each-trade-climbs-its-ladder] given each trade's rungs above the first, when their requirements are read, then each asks months across the trade's jobs, so the months carry from rung to rung", () => {
    for (const [first, above] of [
      ["activity.job-nurse", ["activity.job-senior-nurse", "activity.job-ward-manager"]],
      ["activity.job-teacher", ["activity.job-senior-teacher", "activity.job-head-of-department"]],
      ["activity.job-customer-service", ["activity.job-team-lead", "activity.job-remote-support"]],
      ["activity.job-fish-racks", ["activity.job-fish-smoker", "activity.job-fish-trader"]],
    ] as const) {
      for (const id of above) {
        const tenure = entryOf(id).requires.find((requirement) => requirement.type === "activity/tenure");
        expect(tenure?.type === "activity/tenure" ? tenure.activities : []).toContain(first);
      }
    }
  });

  test("[activity:naira-pay-reviewed-yearly] [activity:capital-opens-own-work] given every naira job at home, when its employer is read, then each names one; no dollar job and no job abroad does, and a side job names only own work", () => {
    const wrong = Object.values(content.activity).filter((entry) => {
      const nairaJob = entry.slot === "main" && entry.pay?.currency === "NGN" && entry.where !== "abroad";
      if (nairaJob) return entry.employer === undefined;
      if (entry.slot === "side") return entry.employer !== undefined && entry.employer !== "own";
      return entry.employer !== undefined;
    });
    expect(wrong.map((entry) => entry.id)).toEqual([]);
    expect(entryOf("activity.pos-stand").employer).toBe("own");
    expect(entryOf("activity.job-fish-racks").employer).toBe("informal");
  });
});

describe("the side jobs", () => {
  /** activity.md, "Side jobs": the trade's side job, its pay, what it asks, its hire chance and its toll. */
  const SIDE: { id: string; pay: ActivityEntry["pay"]; requires: Requirement[]; hireBp: number | null; wellbeing: number }[] = [
    { id: "activity.home-care-visits", pay: { currency: "NGN", amount: naira(80000) }, requires: [held("document.nursing-licence")], hireBp: pct(50), wellbeing: -5 },
    { id: "activity.weekend-tutoring", pay: { currency: "NGN", amount: naira(80000) }, requires: [atLeast("quality.education-level", 3)], hireBp: pct(50), wellbeing: -4 },
    {
      id: "activity.night-support",
      pay: { currency: "USD", amount: dollars(250) },
      requires: [atLeast("quality.english", 60), { type: "any", of: [across(SUPPORT_JOBS, 6), atLeast("quality.tech", 40)] }],
      hireBp: pct(30),
      wellbeing: -6,
    },
    { id: "activity.phone-repairs", pay: { currency: "NGN", amount: naira(50000) }, requires: [atLeast("quality.tech", 20)], hireBp: pct(50), wellbeing: -4 },
    {
      id: "activity.canoe-deliveries",
      pay: { currency: "NGN", amount: naira(80000) },
      requires: [{ type: "obligation/has", obligationType: "upkeep", obligation: "obligation.upkeep-makoko" }],
      hireBp: pct(70),
      wellbeing: -5,
    },
    { id: "activity.pos-stand", pay: { currency: "NGN", amount: naira(60000) }, requires: [], hireBp: null, wellbeing: -2 },
    { id: "activity.bookkeeping", pay: { currency: "NGN", amount: naira(70000) }, requires: [atLeast("quality.education-level", 3)], hireBp: pct(40), wellbeing: -4 },
    { id: "activity.ride-driving", pay: { currency: "NGN", amount: naira(120000) }, requires: [atLeast("quality.driving", 1)], hireBp: pct(45), wellbeing: -7 },
  ];

  test("[activity:each-trade-climbs-its-ladder] [activity:side-jobs-pay-by-tier] given activity.md's side jobs table, when each is read, then its pay, what it asks, its hire chance and its toll are the table's", () => {
    for (const side of SIDE) {
      const entry = entryOf(side.id);
      expect({ id: side.id, slot: entry.slot, pay: entry.pay, requires: entry.requires, hireBp: entry.hireBp, effects: entry.effects }).toEqual({
        id: side.id,
        slot: "side",
        pay: side.pay,
        requires: side.requires,
        hireBp: side.hireBp,
        effects: [{ type: "quality/add", quality: "quality.wellbeing", amount: side.wellbeing }],
      });
    }
  });
});

describe("own work opened with its capital", () => {
  test("[activity:capital-opens-own-work] given the kiln, the fish trade and the POS stand, when their acts are read, then each is a now-act that takes its capital under goods and starts its work, asking what activity.md asks", () => {
    const kiln = entryOf("activity.buy-kiln");
    expect(kiln).toMatchObject({ slot: "free", when: "now", where: "home", cost: [{ currency: "NGN", amount: naira(100000), reason: "goods" }], effects: [{ type: "activity/start-job", job: "activity.job-fish-smoker" }] });
    expect(kiln.requires).toEqual([across(["activity.job-fish-racks"], 12), { type: "not", of: { type: "job/is", activities: ["activity.job-fish-smoker"] } }]);
    const trade = entryOf("activity.start-fish-trade");
    expect(trade).toMatchObject({ slot: "free", when: "now", where: "home", cost: [{ currency: "NGN", amount: naira(300000), reason: "goods" }], effects: [{ type: "activity/start-job", job: "activity.job-fish-trader" }] });
    expect(trade.requires).toEqual([across(["activity.job-fish-racks", "activity.job-fish-smoker"], 30), { type: "not", of: { type: "job/is", activities: ["activity.job-fish-trader"] } }]);
    const pos = entryOf("activity.open-pos-stand");
    expect(pos).toMatchObject({ slot: "free", when: "now", where: "home", cost: [{ currency: "NGN", amount: naira(300000), reason: "goods" }], effects: [{ type: "activity/start-job", job: "activity.pos-stand" }] });
    // "No side job" is the side slot the stand fills, which the activity kind holds it to.
    expect(pos.requires).toEqual([{ type: "job/is", activities: ["activity.job-bank-officer", "activity.job-bank-senior", "activity.job-relationship-manager"] }]);
  });

  test("[activity:capital-opens-own-work] [home:home-is-the-home-point] given Makoko and Ojuelegba, when what they stage is read, then Makoko stages the fish trade's ladder and its side job, and Ojuelegba the POS stand", () => {
    const makoko = content.place["place.makoko"];
    expect(makoko?.stages).toEqual(expect.arrayContaining(["activity.job-fish-racks", "activity.buy-kiln", "activity.start-fish-trade", "activity.canoe-deliveries"]));
    expect(content.place["place.ojuelegba"]?.stages).toContain("activity.open-pos-stand");
  });
});
