import { standInWorld, type Id, type NewsEntry, type NewsSource, type NewsStage, type Requirement } from "@japacity/sim";
import { NewsEntrySchema } from "@japacity/sim/schemas";
import { describe, expect, test } from "vitest";

import { badNews } from "../comedy/comedy.check";
import { content, text } from "../index";

/** The five stories of news.md, the 26 of director.md's pool, the one-chance story of wallet:cash-pile-warning and one for each of the seven eras. */
const STORY_COUNT = 5 + 26 + 1 + 7;

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
  ["news.canada-general-stops", "var.canada-surge", 40],
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
  test("[news:force-waits-after-announcement] given every story in content, when its force lag is read, then it is at least 2 ticks", () => {
    const stories = Object.values(content.news);
    expect(stories).toHaveLength(STORY_COUNT);
    const tooQuick = stories.filter((entry) => entry.standIn.forceLag < 2).map((entry) => entry.id);
    expect(tooQuick).toEqual([]);
  });

  test("[news:force-waits-after-announcement] given a story with a force lag of 1, when it is checked, then the content check rejects it", () => {
    const entry = content.news["news.uk-unis-recruit"];
    expect(entry).toBeDefined();
    const quick = { ...entry, standIn: { ...entry?.standIn, forceLag: 1 } };
    expect(NewsEntrySchema.safeParse(quick).success).toBe(false);
    const edge = { ...entry, standIn: { ...entry?.standIn, forceLag: 2 } };
    expect(NewsEntrySchema.safeParse(edge).success).toBe(true);
  });
});

describe("the policy cycle", () => {
  test("[director:policy-cycle-surge-backlash] given every backlash story, when its needs are read, then it needs its route's surge over the page's threshold", () => {
    for (const [id, surge, threshold] of BACKLASH) {
      expect(story(id).director?.needs).toContainEqual({ type: "var/min", var: surge, value: threshold + 1 });
    }
  });

  test("[director:policy-cycle-surge-backlash] given every restriction, closure and reopening, when its needs are read, then they read a variable the step before it changes", () => {
    const skipped = AFTER.filter(([, id, before]) => {
      const read = varsRead(story(id).director?.needs ?? []);
      return !varsChanged(story(before)).some((changed) => read.includes(changed));
    }).map(([step, id, before]) => `${step} ${id} does not read what ${before} changes`);
    expect(skipped).toEqual([]);
  });

  test("[director:policy-cycle-surge-backlash] given every reopening, when its needs are read, then it needs its window at 0, which the closure before it set", () => {
    const reopenings = AFTER.filter(([step]) => step === "reopening");
    expect(reopenings).toHaveLength(4);
    for (const [, id, before] of reopenings) {
      const closed = story(before).standIn.sets.find((set) => set.var.endsWith("-window") && set.value === 0);
      expect(closed).toBeDefined();
      expect(story(id).director?.needs).toContainEqual({ type: "var/max", var: closed?.var, value: 0 });
      expect(story(id).director?.group).toBe("openings");
    }
  });

  test("[director:policy-cycle-surge-backlash] given the closure that needs the narrowing, when its needs are read, then it needs the window at exactly 1 and the hard-line era", () => {
    expect(story("news.uk-study-closes").director?.needs).toEqual([
      { type: "var/min", var: "var.uk-study-window", value: 1 },
      { type: "var/max", var: "var.uk-study-window", value: 1 },
      { type: "era/is", eras: ["era.hard-line", "era.scandal"] },
    ]);
  });

  test("[director:policy-cycle-surge-backlash] given a copy of a closure whose needs skip the restriction, when the cycle is checked, then it is found", () => {
    const closes = story("news.uk-study-closes");
    const skipping: NewsEntry = { ...closes, director: { ...closes.director!, needs: [{ type: "era/is", eras: ["era.hard-line"] }] } };
    const read = varsRead(skipping.director?.needs ?? []);
    expect(varsChanged(story("news.uk-study-narrows")).some((changed) => read.includes(changed))).toBe(false);
  });
});

describe("the director's pool", () => {
  test("[engine:content-checked-before-play] given every story, when its director fields are read, then each has a group, and a story fired once has no cooldown", () => {
    const stories = Object.values(content.news);
    expect(stories.filter((entry) => (entry.director?.group ?? "") === "").map((entry) => entry.id)).toEqual([]);
    const onceWithCooldown = stories.filter((entry) => entry.director?.once === true && entry.director.cooldown !== 0);
    expect(onceWithCooldown.map((entry) => entry.id)).toEqual([]);
  });

  test("[engine:content-checked-before-play] given every era, when its story is read, then the story exists, touches every route the player can see, and changes nothing", () => {
    const visible = Object.values(content.route).filter((route) => route.gate !== "road").map((route) => route.id).sort();
    for (const era of Object.values(content.era)) {
      const entry = story(era.story);
      expect([...entry.touches].sort()).toEqual(visible);
      expect(entry.director?.group).toBe("front-page");
      expect(varsChanged(entry)).toEqual([]);
    }
  });

  test("[engine:content-checked-before-play] given the pool's figures, when they are read back, then each matches director.md", () => {
    expect(story("news.uk-care-sponsors-revoked").standIn.sets).toEqual([{ var: "var.uk-care-sponsor-risk", value: 1200 }]);
    expect(story("news.uk-skilled-bar-rises").standIn.sets).toEqual([{ var: "var.uk-skilled-salary", value: 4600000 }]);
    expect(story("news.uk-settle-ten-years").standIn.sets).toEqual([{ var: "var.uk-settle-months", value: 120 }]);
    expect(story("news.uk-graduate-shortened").standIn.sets).toEqual([{ var: "var.uk-graduate-months", value: 18 }]);
    expect(story("news.canada-care-draw").director?.adds).toEqual([{ var: "var.canada-care-cutoff", value: -20 }]);
    expect(story("news.canada-general-stops").director?.adds).toEqual([{ var: "var.canada-cutoff", value: 20 }]);
    expect(story("news.canada-funds-rise").standIn.sets).toEqual([{ var: "var.canada-funds", value: 1600000 }]);
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

/** Where a stage is heard from: its own source, else the announcement's. A rumour has none: the screen marks it a rumour. */
function sourceOf(entry: NewsEntry, stage: NewsStage): NewsSource | null {
  if (stage === "rumour" || entry.source === undefined) return null;
  return entry.source[stage] ?? entry.source.announced;
}

/** The stages a story is shown at past its rumour: an era's story and any story with an end count reach ended. */
function toldStages(entry: NewsEntry): ("announced" | "in-force" | "ended")[] {
  const ends = entry.standIn.endsAfter !== null || entry.standIn.revert || entry.director?.group === "front-page";
  return ends ? ["announced", "in-force", "ended"] : ["announced", "in-force"];
}

describe("where a story comes from", () => {
  // Every piece of news names where it was heard, a small icon and a word, and a rumour is marked as a rumour, so it never reads like a changed rule.
  test("[news:changed-stages-delivered-once] given every story in content, when a stage past the rumour is shown, then it names where it is heard: the radio, the paper, the official page, the street or a person", () => {
    const stories = Object.values(content.news);
    expect(stories).toHaveLength(STORY_COUNT);
    const missing = stories.flatMap((entry) => toldStages(entry).filter((stage) => sourceOf(entry, stage) === null).map((stage) => `${entry.id} ${stage}`));
    expect(missing).toEqual([]);
  });

  test("[news:changed-stages-delivered-once] given every story told by a person, when the words are read, then the person is named, and only a person's stage carries a name", () => {
    const unnamed: string[] = [];
    const stray: string[] = [];
    for (const entry of Object.values(content.news)) {
      for (const stage of ["rumour", "announced", "in-force", "ended"] as const) {
        const named = text[`${entry.id}.${stage}.source`];
        const byPerson = stage !== "rumour" && toldStages(entry).includes(stage) && sourceOf(entry, stage) === "person";
        if (byPerson && (named ?? "").trim() === "") unnamed.push(`${entry.id} ${stage}`);
        if (!byPerson && named !== undefined) stray.push(`${entry.id} ${stage}`);
      }
    }
    expect(unnamed).toEqual([]);
    expect(stray).toEqual([]);
  });

  test("[news:stages-move-forward-only] [news:changed-stages-delivered-once] given a story with a rumour lead, when its rumour is read, then the stage carries no source of its own: the screen marks it a rumour", () => {
    const withRumour = Object.values(content.news).filter((entry) => entry.standIn.rumourLead > 0);
    expect(withRumour.length).toBeGreaterThan(20);
    expect(withRumour.filter((entry) => entry.source !== undefined && "rumour" in entry.source).map((entry) => entry.id)).toEqual([]);
  });

  test("[news:changed-stages-delivered-once] given the stories a person tells, then at least one is, and a stage that names no source of its own takes the announcement's", () => {
    const recruit = content.news["news.uk-unis-recruit"];
    expect(recruit?.source?.announced).toBeDefined();
    expect(Object.values(content.news).some((entry) => toldStages(entry).some((stage) => sourceOf(entry, stage) === "person"))).toBe(true);
    const float = content.news["news.naira-float"];
    if (float === undefined) throw new Error("No float story.");
    expect(sourceOf(float, "ended")).toBe(float.source?.ended ?? float.source?.announced ?? null);
  });
});

describe("the one-chance story (wallet:cash-pile-warning)", () => {
  const ONE_CHANCE: Id<"news"> = "news.warning-one-chance";
  const RECRUIT: Id<"news"> = "news.uk-unis-recruit";

  test("[wallet:cash-pile-warning] given the one-chance story, when it is read, then it is home news of the calm era that opens every world, told once, moving no variable and hearing no route, and its words are bad news written straight", () => {
    const entry = story(ONE_CHANCE);
    expect(entry.director).toMatchObject({ group: "home", needs: [{ type: "era/is", eras: ["era.calm"] }], once: true, shock: false, adds: [] });
    expect(entry.standIn).toMatchObject({ chanceBp: 10000, rumourLead: 0, sets: [], revert: false });
    expect(varsChanged(entry)).toEqual([]);
    expect(entry.touches).toEqual([]);
    expect(entry.hear).toEqual([]);
    for (const stage of toldStages(entry)) {
      const words = `${text[`${ONE_CHANCE}.${stage}.head`] ?? ""} ${text[`${ONE_CHANCE}.${stage}.body`] ?? ""}`;
      expect(words).toMatch(/one-chance|danfo/);
      expect(words).not.toMatch(/\{|\d|₦/);
    }
    expect(badNews("line.news.delivered", text[`${ONE_CHANCE}.announced.body`] ?? "")).toBe(true);
    expect(text[`${ONE_CHANCE}.in-force.body`]).toMatch(/bank/);
  });

  test("[wallet:cash-pile-warning] [director:stories-start-by-roll] given forty worlds, when their first months are walked, then each announces the one-chance story by its third tick, and never before the recruiting fair, which it never pushes back", () => {
    // The pool is rolled in id order under a cap of new stories a tick: the fair comes first, so the story never takes its place.
    expect(ONE_CHANCE > RECRUIT).toBe(true);
    for (let seed = 0; seed < 40; seed += 1) {
      const first: Partial<Record<Id<"news">, number>> = {};
      for (let tick = 1; tick <= 3; tick += 1) {
        for (const held of standInWorld(`one-chance-${String(seed)}`, tick, content).news) first[held.id] ??= tick;
      }
      expect({ seed, told: first[ONE_CHANCE] !== undefined }).toEqual({ seed, told: true });
      expect(first[RECRUIT]).toBeLessThanOrEqual(first[ONE_CHANCE] ?? 0);
    }
  });
});
