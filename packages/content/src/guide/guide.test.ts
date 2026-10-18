import type { Content, GuideEntry, Id } from "@japacity/sim";
import { time } from "@japacity/sim";
import { ContentSchema } from "@japacity/sim/schemas";
import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import { content, text } from "../index";
import { addMonths, guideChecks, guideKeys, parseDay, staleGuides } from "./guide.check";
import { GUIDE_SECTIONS } from "./guide.data";

const MASTERS: Id<"guide"> = "guide.uk-masters";
const masters = content.guide[MASTERS]!;

function withGuide(guide: GuideEntry): Content {
  return { ...content, guide: { ...content.guide, [guide.id]: guide } };
}

function without(id: Id<"guide">): Content {
  const guide = { ...content.guide };
  delete guide[id];
  return { ...content, guide };
}

/** Every words line a guide shows. */
function guideWords(): string[] {
  return Object.values(content.guide).flatMap((guide) => guideKeys(guide.id, guide.sections).map((key) => text[key] ?? ""));
}

describe("the guides", () => {
  test("[guide:guide-entry-fields] given the guides, when they are checked, then each has a title, sections with words, dated sources and a checked date", () => {
    expect(Object.keys(content.guide).sort()).toEqual([
      "guide.agents",
      // The two family guides cover the people routes (guide:every-route-has-a-guide).
      "guide.ca-family",
      "guide.canada-points",
      "guide.global-talent",
      "guide.gulf-work",
      "guide.numbers",
      "guide.proof-of-funds",
      "guide.rates",
      "guide.road",
      "guide.uk-care",
      "guide.uk-family",
      "guide.uk-masters",
      "guide.uk-skilled",
    ]);
    expect(ContentSchema.shape.guide.safeParse(content.guide).success).toBe(true);
    expect(guideChecks(content, text)).toEqual([]);
  });

  test("[guide:guide-entry-fields] given a guide with no source, when the guides are checked, then it is named", () => {
    expect(guideChecks(withGuide({ ...masters, sources: [] }), text)).toEqual(["guide.uk-masters: has no source (guide:guide-entry-fields)."]);
  });

  test("[guide:guide-entry-fields] given a source with a date that is not on the calendar, when the guides are checked, then it is named", () => {
    const [first] = masters.sources;
    const bad = withGuide({ ...masters, sources: [{ ...first!, readOn: "2026-02-30" }] });
    expect(guideChecks(bad, text)).toEqual([`guide.uk-masters: ${first!.url} has no date read (guide:guide-entry-fields).`]);
  });

  test("[guide:guide-entry-fields] given a source read after the guide was checked, when the guides are checked, then it is named", () => {
    const [first] = masters.sources;
    const bad = withGuide({ ...masters, checkedOn: "2026-10-06", sources: [{ ...first!, readOn: "2026-10-07" }] });
    expect(guideChecks(bad, text)).toEqual([`guide.uk-masters: ${first!.url} was read after the guide was checked (guide:guide-entry-fields).`]);
  });

  test("[guide:guide-entry-fields] given a guide whose section has no words, when the guides are checked, then the key is named", () => {
    const bad = withGuide({ ...masters, sections: [...masters.sections, "extra"] });
    expect(guideChecks(bad, text)).toEqual(["guide.uk-masters: guide.uk-masters.section.extra has no words."]);
  });

  test("[guide:guide-entry-fields] given a guide that names something not a kind, when the guides are checked, then it is named", () => {
    expect(guideChecks(withGuide({ ...masters, kinds: ["route", "rate"] }), text)).toEqual(["guide.uk-masters: rate is not a kind."]);
  });

  test("[guide:guide-entry-fields] given every guide title, when it is read, then it says what people search for, not the game's own words", () => {
    const titles = Object.keys(content.guide).map((id) => text[`${id}.title`] ?? "");
    expect(titles.filter((title) => /japacity/i.test(title) && !/game/i.test(title))).toEqual([]);
    expect(text["guide.uk-masters.title"]).toMatch(/UK student visa/);
  });
});

describe("a guide for every route", () => {
  test("[guide:every-route-has-a-guide] given every route, when its guide is looked up, then exactly one guide covers it with the three parts", () => {
    for (const route of Object.keys(content.route)) {
      const covering = Object.values(content.guide).filter((guide) => (guide.routes as string[]).includes(route));
      expect({ route, guides: covering.length }).toEqual({ route, guides: 1 });
      expect(covering[0]?.sections).toEqual(GUIDE_SECTIONS);
    }
  });

  test("[guide:every-route-has-a-guide] given a route with no guide, when the guides are checked, then the route is named", () => {
    expect(guideChecks(without(MASTERS), text)).toEqual(["route.uk-masters: has 0 guides, not one (guide:every-route-has-a-guide)."]);
  });

  test("[guide:every-route-has-a-guide] given a route's guide missing a part, when the guides are checked, then it is named", () => {
    const bad = withGuide({ ...masters, sections: ["real", "next"] });
    expect(guideChecks(bad, text)).toEqual(["guide.uk-masters: a route's guide needs the parts real, game, next (guide:every-route-has-a-guide)."]);
  });

  test("[guide:every-route-has-a-guide] given a second guide on the same route, when the guides are checked, then the route is named", () => {
    const twin = { ...masters, id: "guide.uk-masters-again" as Id<"guide"> };
    const problems = guideChecks({ ...content, guide: { ...content.guide, [twin.id]: twin } }, { ...text, ...Object.fromEntries(guideKeys(twin.id, twin.sections).map((key) => [key, "Words."])) });
    expect(problems).toEqual(["route.uk-masters: has 2 guides, not one (guide:every-route-has-a-guide)."]);
  });
});

describe("what a guide never says", () => {
  test("[guide:guides-never-advise] given the opening every guide shows, when it is read, then it is the page's words with the date", () => {
    expect(text["guide.page.opening"]).toBe("General information, checked on {date}. Not immigration, legal or financial advice.");
  });

  test("[guide:guides-never-advise] given every guide's words, when they are read, then none says who qualifies, recommends anyone or carries an advert", () => {
    const words = guideWords();
    expect(words.length).toBeGreaterThan(30);
    const banned = [/you (?:will )?qualify/i, /you are eligible/i, /recommend/i, /we suggest/i, /contact (?:us|our)/i, /our partner/i, /sponsored by/i, /advert/i, /discount code/i];
    expect(words.filter((line) => banned.some((pattern) => pattern.test(line)))).toEqual([]);
  });
});

describe("staleness", () => {
  const months = content.tuning.guide.staleMonths;
  const checkedOn = "2026-04-08";
  const one = withGuide({ ...masters, checkedOn, sources: masters.sources.map((source) => ({ ...source, readOn: checkedOn })) });

  test("[guide:guides-show-checked-date] given a guide checked exactly staleMonths ago, when the stale guides are listed, then it is not among them", () => {
    expect(months).toBe(6);
    const edge = addMonths(parseDay(checkedOn)!, months);
    expect(edge).toEqual({ year: 2026, month: 10, day: 8 });
    expect(staleGuides(one, "2026-10-08")).not.toContain(MASTERS);
  });

  test("[guide:guides-show-checked-date] given a guide checked staleMonths and one day ago, when the stale guides are listed, then it is listed", () => {
    expect(staleGuides(one, "2026-10-09")).toContain(MASTERS);
  });

  test("[guide:guides-show-checked-date] given a guide checked on the last day of a long month, when months are added, then the day is held to the short month's end", () => {
    const august = withGuide({ ...masters, checkedOn: "2026-08-31", sources: masters.sources.map((source) => ({ ...source, readOn: "2026-08-31" })) });
    expect(staleGuides(august, "2027-02-28")).not.toContain(MASTERS);
    expect(staleGuides(august, "2027-03-01")).toContain(MASTERS);
  });

  test("[guide:guides-show-checked-date] given the guides, when they are listed on the day they were checked, then none is stale", () => {
    expect(staleGuides(content, "2026-10-08")).toEqual([]);
  });

  test("[guide:guides-show-checked-date] given today that is not a date, when the stale guides are listed, then it throws", () => {
    expect(() => staleGuides(content, "8 Oct 2026")).toThrow("YYYY-MM-DD");
  });

  test.prop([fc.date({ min: new Date("2020-01-01T00:00:00Z"), max: new Date("2035-12-31T00:00:00Z"), noInvalidDate: true }), fc.integer({ min: 0, max: 800 })])(
    "[guide:guides-show-checked-date] given any checked date and any later day, when the stale guides are listed, then once listed a guide stays listed",
    (checked, later) => {
      const day = checked.toISOString().slice(0, 10);
      const guide = withGuide({ ...masters, checkedOn: day, sources: masters.sources.map((source) => ({ ...source, readOn: day })) });
      const at = (offset: number) => new Date(checked.getTime() + offset * time.DAY_MS).toISOString().slice(0, 10);
      const stale = staleGuides(guide, at(later)).includes(MASTERS);
      const staleNext = staleGuides(guide, at(later + 1)).includes(MASTERS);
      expect(!stale || staleNext).toBe(true);
    },
  );
});

describe("the notice on names", () => {
  test("[city:invented-names-for-risky-businesses] given the about page and the terms, when their one notice on names is read, then it says names are for realism, nothing is endorsed, and institutions and events are invented or simplified", () => {
    const notice = text["guide.page.about.names"] ?? "";
    expect(notice).toMatch(/real places are named/i);
    expect(notice).toMatch(/not an endorsement/i);
    expect(notice).toMatch(/banks, lenders, agents, employers, schools and airlines in the game are invented/i);
    expect(notice).toMatch(/institutions and events are invented or simplified/i);
    expect(Object.keys(text).filter((key) => key.startsWith("guide.page.about."))).toEqual(["guide.page.about.names"]);
    expect([0x2013, 0x2014, 0x21].some((code) => notice.includes(String.fromCharCode(code)))).toBe(false);
  });
});
