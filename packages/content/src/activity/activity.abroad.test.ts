import type { ActivityEntry, Requirement } from "@japacity/sim";
import { ActivityEntrySchema } from "@japacity/sim/schemas";
import { describe, expect, test } from "vitest";

import { content, text } from "../index";
import { abroadActivityTable, foreignPocketActivityTable } from "./activity.abroad.data";

const ID = /^(quality|activity|document|school|route|setpiece|obligation|offer|chapter|var|news|scenario|country|status|goal|era|points)\.[a-z0-9-]+$/;

/** Every string in a value, found by walking it whole. */
function stringsIn(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string") found.push(value);
  else if (Array.isArray(value)) for (const item of value as unknown[]) stringsIn(item, found);
  else if (typeof value === "object" && value !== null) for (const item of Object.values(value)) stringsIn(item, found);
  return found;
}

/** Ids named in a value that are not in the content. */
function dangling(value: unknown): string[] {
  return stringsIn(value)
    .filter((found) => ID.test(found))
    .filter((id) => {
      const kind = id.slice(0, id.indexOf(".")) as keyof typeof content;
      return (content[kind] as Record<string, unknown>)[id] === undefined;
    });
}

const abroad = Object.values(abroadActivityTable);
const pending = Object.values(foreignPocketActivityTable);
const all: ActivityEntry[] = [...abroad, ...pending];

describe("activities abroad", () => {
  test("[R-ENGINE-014] given the activities abroad and the ones held for the foreign pockets, when checked against the schema, then each parses and its key is its id", () => {
    expect(abroad.length).toBeGreaterThan(25);
    expect(pending.map((entry) => entry.id)).toEqual([
      "activity.community-ca",
      "activity.community-uae",
      "activity.learn-tech-ca",
      "activity.rent-flat-ca",
      "activity.december-home-ca",
      "activity.december-home-uae",
    ]);
    for (const [key, entry] of [...Object.entries(abroadActivityTable), ...Object.entries(foreignPocketActivityTable)]) {
      expect(ActivityEntrySchema.safeParse(entry).error?.issues ?? []).toEqual([]);
      expect(entry.id).toBe(key);
    }
  });

  test("[R-ENGINE-014] [R-ABROAD-001] given the activities abroad, when the content is read, then every one is in it, the ones priced in the new pockets included", () => {
    expect(abroad.filter((entry) => content.activity[entry.id] !== entry).map((entry) => entry.id)).toEqual([]);
    expect(pending.filter((entry) => content.activity[entry.id] !== entry).map((entry) => entry.id)).toEqual([]);
  });

  test("[R-ENGINE-014] given the activities held for the foreign pockets, when every id they name is looked up, then each exists", () => {
    const own = new Set(Object.keys(foreignPocketActivityTable));
    expect(dangling(foreignPocketActivityTable).filter((id) => !own.has(id))).toEqual([]);
  });

  test("[R-ENGINE-014] given every activity abroad, when its place is read, then it applies abroad and first requires being in its own country", () => {
    const wrong = all.filter((entry) => {
      const first: Requirement | undefined = entry.requires[0];
      const country = entry.country ?? undefined;
      return (
        entry.where !== "abroad" ||
        first?.type !== "place/is" ||
        first.where !== "abroad" ||
        first.country !== country ||
        (country !== undefined && content.country[country] === undefined)
      );
    });
    expect(wrong.map((entry) => entry.id)).toEqual([]);
  });

  test("[R-ENGINE-014] given every activity abroad, when its costs are read, then each is in its country's currency", () => {
    const wrong = all.flatMap((entry) => {
      if (entry.country === undefined || entry.country === null) return entry.cost.length === 0 ? [] : [`${entry.id} has a cost and no country`];
      const currency = content.country[entry.country]?.currency;
      return entry.cost.filter((cost) => cost.currency !== currency).map((cost) => `${entry.id} costs ${cost.currency}`);
    });
    expect(wrong).toEqual([]);
  });

  test("[R-ENGINE-014] given every job abroad, when its pay is read, then it is in its country's currency", () => {
    const jobs = all.filter((entry) => entry.slot === "main");
    expect(jobs).toHaveLength(17);
    const wrong = jobs.filter((entry) => entry.pay?.currency !== content.country[entry.country!]?.currency);
    expect(wrong.map((entry) => entry.id)).toEqual([]);
  });

  test("[R-ENGINE-014] given every activity abroad, when its words are looked up, then it has a name and a blurb, and no two free-slot names or blurbs are the same", () => {
    const missing = all.flatMap((entry) => [`${entry.id}.name`, `${entry.id}.blurb`]).filter((key) => (text[key] ?? "").trim() === "");
    expect(missing).toEqual([]);
    // Every free-slot activity can show in one list, so each must read differently.
    const free = Object.values(content.activity).filter((entry) => entry.slot === "free");
    for (const field of ["name", "blurb"]) {
      const words = free.map((entry) => text[`${entry.id}.${field}`]);
      expect(words.filter((line, index) => words.indexOf(line) !== index)).toEqual([]);
    }
  });

  test("[R-ENGINE-014] given the activities abroad, when figures from ladders.md and car.md are read back, then each matches the page", () => {
    const activity = { ...content.activity, ...foreignPocketActivityTable };
    // Pay a year: the band 5 nurse £31,300, the warehouse £23,000, the student job £10,400, Canada's developer C$95,000, the farm €9,600.
    expect(activity["activity.job-uk-nurse"]?.pay).toEqual({ currency: "GBP", amount: 3130000 });
    expect(activity["activity.job-uk-warehouse"]?.pay).toEqual({ currency: "GBP", amount: 2300000 });
    expect(activity["activity.job-uk-retail-part"]).toMatchObject({ part: true, pay: { currency: "GBP", amount: 1040000 }, hireBp: 5500 });
    expect(activity["activity.job-ca-dev"]?.pay).toEqual({ currency: "CAD", amount: 9500000 });
    expect(activity["activity.job-it-farm-cash"]).toMatchObject({ cash: true, withheldBp: 2500, pay: { currency: "EUR", amount: 960000 } });
    // The care worker's visiting-round bonus, £3,000 a year; the sponsor's salary is the pay.
    expect(activity["activity.job-uk-care"]).toMatchObject({ carBonus: 300000, hireBp: null, pay: { currency: "GBP", amount: { term: "salary" } } });
    // The Gulf contract's salary is a month: twelve of them make the year.
    expect(activity["activity.job-gulf-guard"]?.pay).toEqual({ currency: "AED", amount: { term: "salary", bp: 120000 } });
    expect(activity["activity.job-uk-kitchen-cash"]).toMatchObject({ cash: true, withheldBp: 1500 });
    // The NMC tests cost £1,170.
    expect(activity["activity.nmc-tests"]?.cost).toEqual([{ currency: "GBP", amount: 117000, reason: "fee-test" }]);
    // The car: 10% of £9,500 down, the rest on finance.
    expect(activity["activity.buy-car-finance"]?.cost).toEqual([{ currency: "GBP", amount: 95000, reason: "car-deposit" }]);
    expect(activity["activity.buy-car-finance"]?.effects).toEqual([{ type: "obligation/open", obligation: "obligation.car", principal: 855000 }]);
    // A flat's deposit is one month: £950.
    expect(activity["activity.rent-flat-uk"]?.cost).toEqual([{ currency: "GBP", amount: 95000, reason: "rent" }]);
    // December home: the fare both ways times the factor. £620 x 2 x 2.5, C$1,350 x 2 x 2.2, AED 1,900 x 2 x 1.8.
    expect(activity["activity.december-home-uk"]?.cost).toEqual([{ currency: "GBP", amount: 310000, reason: "fare" }]);
    expect(activity["activity.december-home-ca"]?.cost).toEqual([{ currency: "CAD", amount: 594000, reason: "fare" }]);
    expect(activity["activity.december-home-uae"]?.cost).toEqual([{ currency: "AED", amount: 684000, reason: "fare" }]);
    // Ngozi's pay: a staff nurse at ₦180,000 a month (route-gates.md).
    expect(activity["activity.job-nurse"]?.pay).toEqual({ currency: "NGN", amount: 18000000 });
  });

  test("[R-ENGINE-014] given the December fares, when they are worked out from the countries, then each activity charges the fare both ways times the factor", () => {
    const december = { "country.uk": "activity.december-home-uk", "country.canada": "activity.december-home-ca", "country.uae": "activity.december-home-uae" } as const;
    for (const [country, id] of Object.entries(december)) {
      const entry = content.country[country as keyof typeof december];
      const cost = ({ ...content.activity, ...foreignPocketActivityTable })[id]?.cost[0]?.amount;
      expect(cost).toBe((entry!.fare * 2 * entry!.decemberFactorBp) / 10000);
    }
  });
});
