import type { Content, OfferEntry } from "@japacity/sim";
import { ContentSchema } from "@japacity/sim/schemas";
import { describe, expect, test } from "vitest";

import { content } from "./index";

/** Any string of this shape anywhere in content names an entry. */
const REFERENCE = /^(quality|activity|document|school|route|setpiece|obligation|offer|chapter|var|news|scenario|country|status|goal|era|points)\.[a-z0-9-]+$/;

/** Every table of entries, by kind. */
function tablesOf(of: Content): Record<string, Record<string, { id: string }>> {
  return {
    quality: of.quality,
    activity: of.activity,
    document: of.document,
    school: of.school,
    route: of.route,
    setpiece: of.setpiece,
    obligation: of.obligation,
    offer: of.offer,
    chapter: of.chapter,
    var: of.var,
    news: of.news,
    scenario: of.scenario,
    country: of.country,
    status: of.status,
    goal: of.goal,
    era: of.era,
    points: of.points,
    // The prologue's steps are not ids.
  };
}

/** Every string in a value, object keys included, found by walking it whole. */
function stringsIn(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string") {
    found.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value as unknown[]) stringsIn(item, found);
  } else if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      found.push(key);
      stringsIn(item, found);
    }
  }
  return found;
}

/** Every number in a value, with the path that leads to it. */
function numbersIn(value: unknown, path = "content", found: { path: string; value: number }[] = []) {
  if (typeof value === "number") {
    found.push({ path, value });
  } else if (Array.isArray(value)) {
    (value as unknown[]).forEach((item, index) => numbersIn(item, `${path}[${String(index)}]`, found));
  } else if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) numbersIn(item, `${path}.${key}`, found);
  }
  return found;
}

/** References that name no entry. */
function danglingReferences(of: Content): string[] {
  const tables = tablesOf(of);
  return stringsIn(of)
    .filter((text) => REFERENCE.test(text))
    .filter((reference) => {
      const kind = reference.slice(0, reference.indexOf("."));
      return tables[kind]?.[reference] === undefined;
    });
}

/** Every term read anywhere in a value: `{ term }` amounts and job terms. */
function termsReadIn(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value as unknown[]) termsReadIn(item, found);
  } else if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      if (key === "term" && typeof item === "string") found.push(item);
      else termsReadIn(item, found);
    }
  }
  return found;
}

/** Terms an offer's choices read that the offer never has in hand. */
function undefinedTerms(offer: OfferEntry): string[] {
  const defined = new Set(Object.keys(offer.terms));
  // offer.job learns which job it is for from the effect that opens it (offer:effect-opens-named-offer).
  if (offer.id === "offer.job") defined.add("job");
  const missing: string[] = [];
  for (const choice of offer.choices) {
    const inHand = new Set(defined);
    if (choice.pick !== null) {
      for (const term of [choice.pick.minTerm, choice.pick.maxTerm]) {
        if (!defined.has(term)) missing.push(`${offer.id} ${choice.id} picks between ${term}`);
      }
      inHand.add("amount");
    }
    const read = termsReadIn([choice.requires, choice.effects, choice.fraudEffects]);
    for (const term of read) {
      if (!inHand.has(term)) missing.push(`${offer.id} ${choice.id} reads ${term}`);
    }
  }
  return missing;
}

const northgate = content.school["school.northgate"];

describe("the content check", () => {
  test("[engine:content-checked-before-play] given the whole content, when it is checked against the content schema, then it parses", () => {
    const result = ContentSchema.safeParse(content);
    expect(result.error?.issues ?? []).toEqual([]);
    expect(result.success).toBe(true);
  });

  test("[engine:content-checked-before-play] given every table, when its keys are compared with its entries' ids, then they are equal", () => {
    const tables = Object.entries(tablesOf(content));
    expect(tables.filter(([, table]) => Object.keys(table).length === 0)).toEqual([]);
    const mismatched = tables.flatMap(([kind, table]) =>
      Object.entries(table)
        .filter(([key, entry]) => entry.id !== key)
        .map(([key, entry]) => `${kind}: ${key} holds ${entry.id}`),
    );
    expect(mismatched).toEqual([]);
  });

  test("[engine:content-checked-before-play] given a copy of an entry with an id of the wrong shape, when it is checked, then it is rejected", () => {
    expect(northgate).toBeDefined();
    const bad = { ...content, school: { ...content.school, "school.North Gate": { ...northgate, id: "school.North Gate" } } };
    expect(ContentSchema.safeParse(bad).success).toBe(false);
    const wrongKind = { ...content, school: { ...content.school, "school.northgate": { ...northgate, id: "route.northgate" } } };
    expect(ContentSchema.safeParse(wrongKind).success).toBe(false);
  });

  test("[engine:content-checked-before-play] given a copy of an entry with an amount that is not whole, when it is checked, then it is rejected", () => {
    const half = 1 / 2;
    const bad = { ...content, school: { ...content.school, "school.northgate": { ...northgate, tuition: 1700000 + half } } };
    expect(ContentSchema.safeParse(bad).success).toBe(false);
  });

  test("[engine:content-checked-before-play] given a copy of an entry with a key the schema does not know, when it is checked, then it is rejected", () => {
    const bad = { ...content, school: { ...content.school, "school.northgate": { ...northgate, campus: "Seaside" } } };
    expect(ContentSchema.safeParse(bad).success).toBe(false);
  });

  test("[engine:content-checked-before-play] given the whole content, when every number in it is read, then each is a whole number", () => {
    const numbers = numbersIn(content);
    expect(numbers.length).toBeGreaterThan(100);
    expect(numbers.filter((found) => !Number.isInteger(found.value))).toEqual([]);
  });
});

describe("references", () => {
  test("[engine:content-checked-before-play] given the whole content, when every id it mentions is looked up, then each names an entry that exists", () => {
    const references = stringsIn(content).filter((text) => REFERENCE.test(text));
    expect(references.length).toBeGreaterThan(100);
    expect(danglingReferences(content)).toEqual([]);
  });

  test("[engine:content-checked-before-play] given a copy of content naming a route that does not exist, when references are looked up, then it is found", () => {
    const meetup = content.activity["activity.meetup"];
    expect(meetup).toBeDefined();
    const bad: Content = {
      ...content,
      activity: { ...content.activity, "activity.meetup": { ...meetup!, counts: ["route.ca-masters"] } },
    };
    expect(danglingReferences(bad)).toEqual(["route.ca-masters"]);
  });

  test("[engine:content-checked-before-play] given every offer, when the terms its choices read are listed, then each is defined, picked or handed over", () => {
    const missing = Object.values(content.offer).flatMap(undefinedTerms);
    expect(missing).toEqual([]);
  });

  test("[engine:content-checked-before-play] given an offer whose choice reads a term it never has, when terms are checked, then it is found", () => {
    const landBuyer = content.offer["offer.land-buyer"];
    expect(landBuyer).toBeDefined();
    const bad: OfferEntry = { ...landBuyer!, terms: {} };
    expect(undefinedTerms(bad)).toEqual(["offer.land-buyer sell reads price"]);
  });

  test("[engine:content-checked-before-play] given every offer, when its lapse choice is read, then it is null or one of its choices", () => {
    const unknown = Object.values(content.offer).filter(
      (offer) => offer.onExpire !== null && !offer.choices.some((choice) => choice.id === offer.onExpire),
    );
    expect(unknown).toEqual([]);
  });

  test("[engine:content-checked-before-play] given every entry with a list of ids inside it, when those ids are read, then none repeats", () => {
    const repeats = (ids: (string | number)[]) => new Set(ids).size !== ids.length;
    const repeated = [
      ...Object.values(content.offer).flatMap((offer) => [
        ...(repeats(offer.choices.map((choice) => choice.id)) ? [`${offer.id} choices`] : []),
        ...(repeats(offer.signs.map((sign) => sign.key)) ? [`${offer.id} signs`] : []),
      ]),
      ...Object.values(content.chapter)
        .filter((chapter) => repeats(chapter.items.map((item) => item.id)))
        .map((chapter) => `${chapter.id} items`),
      ...Object.values(content.setpiece)
        .filter((setpiece) => repeats(setpiece.questions.map((question) => question.id)))
        .map((setpiece) => `${setpiece.id} questions`),
      ...(repeats(Object.values(content.chapter).map((chapter) => chapter.order)) ? ["chapter orders"] : []),
    ];
    expect(repeated).toEqual([]);
    // A set piece cannot ask more questions than it has (route:set-piece-draws-questions draws without repeats).
    const overAsked = Object.values(content.setpiece).filter((setpiece) => setpiece.ask > setpiece.questions.length);
    expect(overAsked).toEqual([]);
  });

  test("[engine:content-checked-before-play] given every scenario, when its qualities are read, then every quality is present and within its range", () => {
    const qualities = Object.values(content.quality);
    const problems = Object.values(content.scenario).flatMap((scenario) => {
      const extra = Object.keys(scenario.qualities).filter((id) => !(id in content.quality));
      const wrong = qualities
        .filter((quality) => {
          const value = scenario.qualities[quality.id];
          return value === undefined || value < quality.min || value > quality.max;
        })
        .map((quality) => quality.id);
      return [...extra, ...wrong].map((id) => `${scenario.id} ${id}`);
    });
    expect(problems).toEqual([]);
  });
});

describe("spot checks against the rule pages", () => {
  test("[engine:content-checked-before-play] given the content, when figures from the rule pages are read back, then each matches the page", () => {
    // route.md: Northgate tuition £17,000, Kingsmere band 7.0.
    expect(northgate?.tuition).toBe(1700000);
    expect(content.school["school.kingsmere"]?.minBand).toBe(70);
    // activity.md: the remote job pays $2,800; the English test costs ₦285,500.
    expect(content.activity["activity.job-remote-dev"]?.pay).toEqual({ currency: "USD", amount: 280000 });
    expect(content.activity["activity.sit-english-test"]?.cost).toEqual([
      { currency: "NGN", amount: 28550000, reason: "fee-test" },
    ]);
    // route:visa-application-needs: the visa fee and surcharge are read from the world.
    expect(content.activity["activity.apply-for-visa"]?.cost).toEqual([
      { currency: "GBP", amount: { var: "var.uk-visa-fee" }, reason: "fee-visa" },
      { currency: "GBP", amount: { var: "var.uk-surcharge" }, reason: "fee-surcharge" },
    ]);
    // scenario.md: the graduate has ₦355,000 in the bank (four months of living), the banker's passport 22 months, the developer sends ₦60,000 home.
    expect(content.scenario["scenario.graduate"]?.pockets.NGN).toEqual({ bank: 35500000, cash: 2500000 });
    expect(content.scenario["scenario.banker"]?.documents).toEqual([
      { document: "document.passport", monthsLeft: 22, value: null },
    ]);
    expect(content.scenario["scenario.developer"]?.obligations).toContainEqual({
      obligation: "obligation.home-support",
      amount: 6000000,
    });
    // rate.md: start rates and the living line.
    expect(content.tuning.rate.start).toEqual({ GBP: 175800, USD: 133150, CAD: 97000, AED: 36255, EUR: 155800 });
    expect(content.var["var.uk-living-line"]?.start).toBe(117100);
    // news.md: the rise sets the living line to £1,203.
    expect(content.news["news.uk-living-rise"]?.standIn.sets).toEqual([{ var: "var.uk-living-line", value: 120300 }]);
    // offer.md: the roof comes up 2.5% of months; Mr Kunle is a fraud 35 times in 100.
    expect(content.offer["offer.roof"]?.chanceBp).toBe(250);
    expect(content.offer["offer.held-funds-agent"]?.fraudBp).toBe(3500);
    // route.md: the flight is ₦1,600,000, the deposit fee kept is £500.
    expect(content.tuning.route.flight).toEqual({ currency: "NGN", amount: 160000000 });
    expect(content.tuning.route.depositAdminFee).toBe(50000);
    // wallet.md: cash deposits over ₦500,000 are flagged.
    expect(content.tuning.wallet.flagDepositAbove).toBe(50000000);
  });

  test("[engine:content-checked-before-play] given the content, when an empty slot's rest is compared with the rest activity, then they give the same", () => {
    expect(content.activity["activity.rest"]?.effects).toEqual([
      { type: "quality/add", quality: "quality.wellbeing", amount: content.tuning.quality.wellbeingRest },
    ]);
  });
});
