import type { Id, NewsEntry, Requirement } from "@japacity/sim";
import { NewsEntrySchema } from "@japacity/sim/schemas";
import { describe, expect, test } from "vitest";

import { content } from "../index";

/** The five stories of news.md, the 25 of director.md's pool and one for each of the seven eras. */
const STORY_COUNT = 5 + 25 + 7;

/** Every variable a requirement reads, through `not` and `any`. */
function varsRead(requirements: Requirement[]): Id<"var">[] {
  return requirements.flatMap((requirement): Id<"var">[] => {
    if (requirement.type === "var/min" || requirement.type === "var/max") return [requirement.var];
    if (requirement.type === "not") return varsRead([requirement.of]);
    if (requirement.type === "any") return varsRead(requirement.of);
    return [];
  });
}

/** Every variable a story changes when it comes into force, set or added. */
function varsChanged(story: NewsEntry): Id<"var">[] {
  return [...story.standIn.sets.map((set) => set.var), ...(story.director?.adds ?? []).map((add) => add.var)];
}

function story(id: Id<"news">): NewsEntry {
  const found = content.news[id];
  if (found === undefined) throw new Error(`No story ${id}.`);
  return found;
}

/**
 * The policy cycle as director.md's pool table gives it: each story and the step before it. A backlash's step
 * before is its route's surge; every other step is the story its `needs` names.
 */
const BACKLASH: [Id<"news">, Id<"var">, number][] = [
  ["news.uk-refusals-up", "var.uk-study-surge", 40],
  ["news.uk-dependants-ban", "var.uk-study-surge", 60],
  ["news.uk-care-dependants", "var.uk-care-surge", 50],
  ["news.uk-care-sponsors-revoked", "var.uk-care-surge", 50],
  ["news.ca-general-stops", "var.ca-surge", 40],
];
const AFTER: [step: string, Id<"news">, before: Id<"news">][] = [
  ["restriction", "news.uk-study-narrows", "news.uk-refusals-up"],
  ["closure", "news.uk-study-closes", "news.uk-study-narrows"],
  ["closure", "news.uk-care-closes", "news.uk-care-sponsors-revoked"],
  ["reopening", "news.uk-study-reopens", "news.uk-study-closes"],
  ["reopening", "news.uk-care-opens", "news.uk-care-closes"],
  ["reopening", "news.uk-talent-reappointed", "news.uk-talent-body-closes"],
  ["reopening", "news.uae-lifted", "news.uae-ban"],
];

describe("news timing", () => {
  test("[R-NEWS-002] given every story in content, when its force lag is read, then it is at least 2 ticks", () => {
    const stories = Object.values(content.news);
    expect(stories).toHaveLength(STORY_COUNT);
    const tooQuick = stories.filter((entry) => entry.standIn.forceLag < 2).map((entry) => entry.id);
    expect(tooQuick).toEqual([]);
  });

  test("[R-NEWS-002] given a story with a force lag of 1, when it is checked, then the content check rejects it", () => {
    const entry = content.news["news.uk-unis-recruit"];
    expect(entry).toBeDefined();
    const quick = { ...entry, standIn: { ...entry?.standIn, forceLag: 1 } };
    expect(NewsEntrySchema.safeParse(quick).success).toBe(false);
    const edge = { ...entry, standIn: { ...entry?.standIn, forceLag: 2 } };
    expect(NewsEntrySchema.safeParse(edge).success).toBe(true);
  });
});

describe("the policy cycle", () => {
  test("[R-DIRECTOR-005] given every backlash story, when its needs are read, then it needs its route's surge over the page's threshold", () => {
    for (const [id, surge, threshold] of BACKLASH) {
      expect(story(id).director?.needs).toContainEqual({ type: "var/min", var: surge, value: threshold + 1 });
    }
  });

  test("[R-DIRECTOR-005] given every restriction, closure and reopening, when its needs are read, then they read a variable the step before it changes", () => {
    const skipped = AFTER.filter(([, id, before]) => {
      const read = varsRead(story(id).director?.needs ?? []);
      return !varsChanged(story(before)).some((changed) => read.includes(changed));
    }).map(([step, id, before]) => `${step} ${id} does not read what ${before} changes`);
    expect(skipped).toEqual([]);
  });

  test("[R-DIRECTOR-005] given every reopening, when its needs are read, then it needs its window at 0, which the closure before it set", () => {
    const reopenings = AFTER.filter(([step]) => step === "reopening");
    expect(reopenings).toHaveLength(4);
    for (const [, id, before] of reopenings) {
      const closed = story(before).standIn.sets.find((set) => set.var.endsWith("-window") && set.value === 0);
      expect(closed).toBeDefined();
      expect(story(id).director?.needs).toContainEqual({ type: "var/max", var: closed?.var, value: 0 });
      expect(story(id).director?.group).toBe("openings");
    }
  });

  test("[R-DIRECTOR-005] given the closure that needs the narrowing, when its needs are read, then it needs the window at exactly 1 and the hard-line era", () => {
    expect(story("news.uk-study-closes").director?.needs).toEqual([
      { type: "var/min", var: "var.uk-study-window", value: 1 },
      { type: "var/max", var: "var.uk-study-window", value: 1 },
      { type: "era/is", eras: ["era.hard-line"] },
    ]);
  });

  test("[R-DIRECTOR-005] given a copy of a closure whose needs skip the restriction, when the cycle is checked, then it is found", () => {
    const closes = story("news.uk-study-closes");
    const skipping: NewsEntry = { ...closes, director: { ...closes.director!, needs: [{ type: "era/is", eras: ["era.hard-line"] }] } };
    const read = varsRead(skipping.director?.needs ?? []);
    expect(varsChanged(story("news.uk-study-narrows")).some((changed) => read.includes(changed))).toBe(false);
  });
});

describe("the director's pool", () => {
  test("[R-ENGINE-014] given every story, when its director fields are read, then each has a group, and a story fired once has no cooldown", () => {
    const stories = Object.values(content.news);
    expect(stories.filter((entry) => (entry.director?.group ?? "") === "").map((entry) => entry.id)).toEqual([]);
    const onceWithCooldown = stories.filter((entry) => entry.director?.once === true && entry.director.cooldown !== 0);
    expect(onceWithCooldown.map((entry) => entry.id)).toEqual([]);
  });

  test("[R-ENGINE-014] given every era, when its story is read, then the story exists, touches every route the player can see, and changes nothing", () => {
    const visible = Object.values(content.route).filter((route) => route.gate !== "road").map((route) => route.id).sort();
    for (const era of Object.values(content.era)) {
      const entry = story(era.story);
      expect([...entry.touches].sort()).toEqual(visible);
      expect(entry.director?.group).toBe("front-page");
      expect(varsChanged(entry)).toEqual([]);
    }
  });

  test("[R-ENGINE-014] given the pool's figures, when they are read back, then each matches director.md", () => {
    expect(story("news.uk-care-sponsors-revoked").standIn.sets).toEqual([{ var: "var.uk-care-sponsor-risk", value: 1200 }]);
    expect(story("news.uk-skilled-bar-rises").standIn.sets).toEqual([{ var: "var.uk-skilled-salary", value: 4600000 }]);
    expect(story("news.uk-settle-ten-years").standIn.sets).toEqual([{ var: "var.uk-settle-months", value: 120 }]);
    expect(story("news.uk-graduate-shortened").standIn.sets).toEqual([{ var: "var.uk-graduate-months", value: 18 }]);
    expect(story("news.ca-care-draw").director?.adds).toEqual([{ var: "var.ca-care-cutoff", value: -20 }]);
    expect(story("news.ca-general-stops").director?.adds).toEqual([{ var: "var.ca-cutoff", value: 30 }]);
    expect(story("news.ca-funds-rise").standIn.sets).toEqual([{ var: "var.ca-funds", value: 1600000 }]);
    expect(story("news.passport-fee-doubles").standIn.sets).toEqual([{ var: "var.passport-fee", value: 20000000 }]);
    expect(story("news.fuel-subsidy").director?.adds).toEqual([{ var: "var.inflation", value: 2000 }]);
    expect(story("news.uae-ban").standIn).toMatchObject({ chanceBp: 200, rumourLead: 1, forceLag: 2, endsAfter: 18, revert: true });
    expect(story("news.uae-lifted").standIn.chanceBp).toBe(10000);
    const pandemic = story("news.pandemic-borders").standIn;
    expect(pandemic.sets.filter((set) => set.var.endsWith("-window")).every((set) => set.value === 0)).toBe(true);
    expect(pandemic.sets.filter((set) => set.var.endsWith("-window"))).toHaveLength(6);
    expect(pandemic.sets).toContainEqual({ var: "var.flight-factor", value: 20000 });
  });
});
