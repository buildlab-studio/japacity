import type { Effect, PrologueStep, Requirement } from "@japacity/sim";
import { PrologueStepSchema } from "@japacity/sim/schemas";
import { describe, expect, test } from "vitest";

import { content, text } from "../index";

const FIRST = "draw";
const START_AGE = content.tuning.prologue.startAgeMonths;
// Every path ends inside the span the age cards offer, 18 to 29 (prologue:age-advances-with-steps): the years worked after it are the
// prologue kind's, up to the year picked, and are not walked here.
const YOUNGEST = 18 * 12;
const OLDEST = 29 * 12 + 11;
/** The years worked after the path's end: where a path's months stop being the path's (prologue:age-advances-with-steps). */
const WORK = "work";

/**
 * Whether a requirement can hold at this age. Only age is tracked along a path:
 * a requirement on anything else is taken as one some character can meet.
 */
function canHold(requirement: Requirement, age: number): boolean {
  const onAge = (requirement.type === "quality/min" || requirement.type === "quality/max") && requirement.quality === "quality.age-months";
  if (onAge && requirement.type === "quality/min") return age >= requirement.value;
  if (onAge && requirement.type === "quality/max") return age <= requirement.value;
  if (requirement.type === "any") return requirement.of.some((inner) => canHold(inner, age));
  return true;
}

function ageAdded(effects: Effect[]): number {
  return effects.reduce(
    (sum, effect) => sum + (effect.type === "quality/add" && effect.quality === "quality.age-months" ? effect.amount : 0),
    0,
  );
}

interface Ending {
  /** One path that ends at this age, as `step.answer` or `step.answer.outcome`. */
  path: string[];
  age: number;
}

interface Walk {
  /** Every age a path can end at, with one path that gets there. */
  endings: Ending[];
  /** Every `step.answer` or `step.answer.outcome` some path passes through. */
  passed: Set<string>;
}

/**
 * Walks every path from the first step: every allowed answer, every draw outcome.
 * A step's months are added when it is answered (prologue:age-advances-with-steps). Where a path
 * ends depends only on the step and the age, so each pair is walked once. Throws
 * on a path longer than any prologue could be, so a loop with no way out is found.
 * With `stop`, a path ends where it reaches that step.
 */
function walk(steps: Record<string, PrologueStep>, stop: string | null = null): Walk {
  const passed = new Set<string>();
  const memo = new Map<string, Map<number, string[]>>();
  const visit = (id: string, age: number, depth: number): Map<number, string[]> => {
    const key = `${id}@${String(age)}`;
    const known = memo.get(key);
    if (known !== undefined) return known;
    if (depth > 40) throw new Error(`The prologue loops at ${id}, ${String(age)} months`);
    const step = steps[id];
    if (step === undefined) throw new Error(`The step ${id} does not exist`);
    const allowed = step.answers.filter((answer) => answer.requires.every((requirement) => canHold(requirement, age)));
    if (allowed.length === 0) throw new Error(`No answer can be given at ${id}, at ${String(age)} months`);
    const ends = new Map<number, string[]>();
    for (const answer of allowed) {
      const after = age + step.months + ageAdded(answer.effects);
      const outcomes = answer.draw ?? [{ id: "", bp: 10000, effects: [], next: answer.next ?? step.next }];
      for (const outcome of outcomes) {
        const at = outcome.id === "" ? `${id}.${answer.id}` : `${id}.${answer.id}.${outcome.id}`;
        passed.add(at);
        const next = outcome.next ?? answer.next ?? step.next;
        const age2 = after + ageAdded(outcome.effects);
        const later = next === null || next === stop ? new Map([[age2, []]]) : visit(next, age2, depth + 1);
        for (const [end, path] of later) if (!ends.has(end)) ends.set(end, [at, ...path]);
      }
    }
    memo.set(key, ends);
    return ends;
  };
  const ends = visit(FIRST, START_AGE, 0);
  return { endings: [...ends].map(([age, path]) => ({ age, path })), passed };
}

describe("the prologue's steps", () => {
  test("[prologue:age-advances-with-steps] given every path through the prologue, when the months are added to the years worked, then each path ends inside 18 to 29", () => {
    const { endings } = walk(content.prologue, WORK);
    expect(endings.length).toBeGreaterThan(5);
    const outside = endings.filter((ending) => ending.age < YOUNGEST || ending.age > OLDEST);
    expect(outside.map((ending) => `${String(ending.age)}: ${ending.path.join(" > ")}`)).toEqual([]);
    const ages = endings.map((ending) => ending.age);
    // The longest path is two exams, a strike and the degree, 25 years; the shortest the shop counter, 21 and 7 months.
    expect(Math.max(...ages)).toBe(300);
    expect(Math.min(...ages)).toBe(259);
  });

  test("[prologue:age-advances-with-steps] given the degree path with no strike and no retake, when the months are added, then it ends at 277", () => {
    // 192 + 12 + 6 + 3 + 12 + 0 + 12 + 12 + 12 + 3 + 12 + 1 + 0.
    const plain = { ...content.prologue };
    const only = (step: string, answer: string, outcome?: string) => {
      const found = plain[step]!;
      const kept = found.answers.filter((given) => given.id === answer).map((given) => ({
        ...given,
        draw: given.draw === null || outcome === undefined ? given.draw : given.draw.filter((drawn) => drawn.id === outcome).map((drawn) => ({ ...drawn, bp: 10000 })),
      }));
      plain[step] = { ...found, answers: kept };
    };
    only("after-school", "jamb");
    only("exam", "study", "pass");
    only("strike", "wait", "no-strike");
    // The age the path reaches, picked on its card: no year is worked after it (prologue:age-advances-with-steps).
    only("age-degree", "start-23");
    expect(walk(plain, WORK).endings.map((ending) => ending.age)).toEqual([277]);
    expect(walk(plain).endings.map((ending) => ending.age)).toEqual([277 + (content.prologue[WORK]?.months ?? 0)]);
  });

  test("[prologue:age-advances-with-steps] given a copy of the prologue whose retake can be taken forever, when walked, then the loop is found", () => {
    const retake = content.prologue["retake"]!;
    const forever = { ...content.prologue, retake: { ...retake, answers: retake.answers.map((answer) => ({ ...answer, requires: [] })) } };
    expect(() => walk(forever)).toThrow(/loops/);
  });

  test("[prologue:age-advances-with-steps] given a copy of the prologue with a step five years too long, when walked, then a path past 29 is found", () => {
    const service = content.prologue["service"]!;
    const late = { ...content.prologue, service: { ...service, months: service.months + 60 } };
    expect(walk(late, WORK).endings.some((ending) => ending.age > OLDEST)).toBe(true);
  });

  test("[engine:content-checked-before-play] given every step, when it is checked, then it parses, its key is its id, every next names a step and every draw adds up to 10000", () => {
    const ids = Object.keys(content.prologue);
    expect(ids).toContain(FIRST);
    const problems = Object.entries(content.prologue).flatMap(([key, step]) => {
      const nexts = [step.next, ...step.answers.flatMap((answer) => [answer.next, ...(answer.draw ?? []).map((outcome) => outcome.next)])];
      return [
        ...(PrologueStepSchema.safeParse(step).success ? [] : [`${key} does not parse`]),
        ...(step.id === key ? [] : [`${key} holds ${step.id}`]),
        ...(step.answers.length > 0 ? [] : [`${key} has no answer`]),
        ...nexts.filter((next): next is string => next !== null && !ids.includes(next)).map((next) => `${key} leads to ${next}`),
        ...step.answers
          .filter((answer) => answer.draw !== null && answer.draw.reduce((sum, outcome) => sum + outcome.bp, 0) !== 10000)
          .map((answer) => `${key}.${answer.id}'s draw does not add up to 10000`),
      ];
    });
    expect(problems).toEqual([]);
    // Every step is reached from the first.
    const reached = new Set([...walk(content.prologue).passed].map((at) => at.split(".")[0]));
    expect([...reached].sort()).toEqual([...ids].sort());
  });

  test("[engine:content-checked-before-play] given every step, when its words are looked up, then its card, every answer and every outcome have words", () => {
    const keys = Object.values(content.prologue).flatMap((step) => [
      `prologue.${step.id}.card`,
      ...step.answers.map((answer) => `prologue.${step.id}.answer.${answer.id}`),
      ...step.answers.flatMap((answer) => (answer.draw ?? []).map((outcome) => `prologue.${step.id}.outcome.${outcome.id}`)),
    ]);
    expect(keys.filter((key) => (text[key] ?? "").trim() === "")).toEqual([]);
  });

  test("[engine:content-checked-before-play] given the prologue's figures, when they are read back, then each matches prologue.md", () => {
    const steps = content.prologue;
    const months = Object.fromEntries(Object.values(steps).map((step) => [step.id, step.months]));
    expect(months).toMatchObject({ subjects: 12, "after-school": 6, exam: 3, retake: 12, course: 12, strike: 12, "strike-drag": 8 });
    expect(months).toMatchObject({ "side-skill": 12, hustle: 12, graduation: 3, service: 12, friend: 1, home: 0 });
    // The apprenticeship is six years: three steps of 24 months.
    expect(months.master! + months.years! + months.settlement!).toBe(72);
    const draw = (step: string, answer: string) => steps[step]?.answers.find((found) => found.id === answer)?.draw;
    expect(draw("exam", "study")?.find((outcome) => outcome.id === "pass")?.bp).toBe(7500);
    expect(draw("exam", "cram")?.find((outcome) => outcome.id === "pass")?.bp).toBe(5000);
    // Expo passes 6500 times in 10000 and is caught 2000 times in 10000, apart.
    const expo = draw("exam", "expo") ?? [];
    expect(expo.filter((outcome) => outcome.id.startsWith("pass")).reduce((sum, outcome) => sum + outcome.bp, 0)).toBe(6500);
    expect(expo.filter((outcome) => outcome.id.endsWith("caught")).reduce((sum, outcome) => sum + outcome.bp, 0)).toBe(2000);
    expect(draw("strike", "wait")?.find((outcome) => outcome.id === "strike")?.bp).toBe(5000);
    expect(draw("settlement", "settle")?.map((outcome) => [outcome.id, outcome.bp])).toEqual([
      ["generous", 3000],
      ["fair", 5000],
      ["cheated", 2000],
    ]);
    const effects = (step: string, answer: string) => steps[step]?.answers.find((found) => found.id === answer)?.effects ?? [];
    // Kobo: the service year's ₦500,000, the private session's ₦2,500,000, the generous settlement's ₦6,000,000.
    // Earnings that size land in the bank (wallet:money-lands-as-in-lagos).
    expect(effects("service", "serve")).toContainEqual({ type: "money/add", currency: "NGN", pocket: "bank", amount: 50000000, reason: "gig" });
    expect(effects("university", "private")).toContainEqual({
      type: "money/add",
      currency: "NGN",
      pocket: "bank",
      amount: 250000000,
      reason: "gift",
      flagged: true,
    });
    expect(draw("settlement", "settle")?.[0]?.effects).toContainEqual({ type: "money/add", currency: "NGN", pocket: "bank", amount: 600000000, reason: "gig" });
    expect(effects("home", "family-house")).toContainEqual({ type: "obligation/open", obligation: "obligation.upkeep", amount: 9500000 });
    // The home step offers only the homes play backs (home:home-slice-fields): the family house, the room in a compound, the hostel
    // room and Makoko, chosen on the door (prologue:front-door-three-screens).
    expect(content.prologue["home"]?.answers.map((answer) => answer.id)).toEqual(["family-house", "compound-room", "hostel-room", "makoko"]);
    expect(effects("friend", "drivers")).toEqual([{ type: "route/hear", route: "route.gulf-contract", via: "friend" }]);
    expect(content.tuning.prologue.startAgeMonths).toBe(192);
  });
});

const WELLBEING = "quality.wellbeing";

function wellbeingAdded(effects: readonly Effect[]): number {
  return effects.reduce((sum, effect) => sum + (effect.type === "quality/add" && effect.quality === WELLBEING ? effect.amount : 0), 0);
}

/**
 * The lowest and highest wellbeing any path closes on, from the draw card's start, along the answers age allows (as `walk` does).
 * A path is walked to the years worked: the test holds that nothing after them moves wellbeing.
 */
function wellbeingAtClose(steps: Record<string, PrologueStep>): { low: number; high: number } {
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  const visit = (id: string, age: number, wellbeing: number, depth: number): void => {
    const step = steps[id];
    if (step === undefined) throw new Error(`The step ${id} does not exist`);
    if (depth > 40) throw new Error(`The prologue loops at ${id}`);
    for (const answer of step.answers.filter((given) => given.requires.every((requirement) => canHold(requirement, age)))) {
      const outcomes = answer.draw ?? [{ id: "", bp: 10000, effects: [], next: answer.next ?? step.next }];
      for (const outcome of outcomes) {
        const after = wellbeing + wellbeingAdded(answer.effects) + wellbeingAdded(outcome.effects);
        const next = outcome.next ?? answer.next ?? step.next;
        if (next === null || next === WORK) {
          low = Math.min(low, after);
          high = Math.max(high, after);
        } else {
          visit(next, age + step.months, after, depth + 1);
        }
      }
    }
  };
  visit(FIRST, START_AGE, 0, 0);
  return { low, high };
}

describe("the life from sixteen starts in fair health", () => {
  const fixed = Object.values(content.scenario).filter((scenario) => scenario.prologue !== true).map((scenario) => scenario.qualities[WELLBEING] ?? 0);

  test("[prologue:family-draw-on-first-answer] given the draw card that begins the prologue, when it is answered, then wellbeing starts inside the band the fixed lives start in, not at its minimum", () => {
    const begin = content.prologue[FIRST]?.answers.find((answer) => answer.id === "begin");
    const start = wellbeingAdded(begin?.effects ?? []);
    expect(fixed.length).toBeGreaterThan(0);
    expect(start).toBeGreaterThanOrEqual(Math.min(...fixed));
    expect(start).toBeLessThanOrEqual(Math.max(...fixed));
  });

  test("[prologue:closing-opens-home-charges] given every path through the prologue, when its wellbeing is added up from the draw card, then every life closes above the run-down line and no higher than the scale allows", () => {
    // The years worked and the home come after the path and move no wellbeing, so the walk ends at the work.
    const after = [WORK, "home"].flatMap((id) => (content.prologue[id]?.answers ?? []).flatMap((answer) => answer.effects));
    expect(wellbeingAdded(after)).toBe(0);
    expect(after.filter((effect) => effect.type === "quality/add" && effect.quality === WELLBEING)).toEqual([]);
    const { low, high } = wellbeingAtClose(content.prologue);
    expect(low).toBeGreaterThanOrEqual(content.tuning.health.runDownBelow);
    expect(high).toBeLessThanOrEqual(content.quality[WELLBEING]?.max ?? 0);
  // The age cards' years multiply the paths walked (prologue:age-advances-with-steps); under a full parallel run the walk needs more than the default five seconds.
  }, 30_000);
});

describe("opening words that fit the life", () => {
  const OPEN = "chapter.find-your-feet.open";
  const SERVICE = /service/i;

  test("[world:world-fills-the-screen] given each fixed life and both paths of the life from sixteen, when the first chapter's opening is looked up, then each has its own line, and only a life fresh from its service year says service is over", () => {
    const fixed = Object.values(content.scenario).filter((scenario) => scenario.prologue !== true);
    const keys = [...fixed.map((scenario) => `${OPEN}.${scenario.id.slice("scenario.".length)}`), `${OPEN}.prologue.degree`, `${OPEN}.prologue.trade`];
    expect(keys.filter((key) => (text[key] ?? "").trim() === "")).toEqual([]);
    const working = fixed.filter((scenario) => scenario.job !== null).map((scenario) => `${OPEN}.${scenario.id.slice("scenario.".length)}`);
    expect(working.length).toBeGreaterThan(0);
    expect([...working, `${OPEN}.prologue.degree`, `${OPEN}.prologue.trade`].filter((key) => SERVICE.test(text[key] ?? ""))).toEqual([]);
    // The plain line stays for any life not named.
    expect((text[OPEN] ?? "").trim()).not.toBe("");
  });

  test("[prologue:closing-opens-home-charges] given the last card every path reaches, the trade and the shop counter included, when its question is read, then it does not say service is over", () => {
    expect(text["prologue.home.card"]).toBeDefined();
    expect(text["prologue.home.card"]).not.toMatch(SERVICE);
  });
});

describe("lines that fit the life from sixteen", () => {
  test("[text:bands-not-figures] given an exam failed, when its outcome shows above the retake card, then the cut-off is told once, not by both", () => {
    const fails = (content.prologue.exam?.answers ?? []).flatMap((answer) => (answer.draw ?? []).filter((outcome) => outcome.next === "retake"));
    expect(fails.length).toBeGreaterThan(1);
    const told = fails.map((outcome) => `${text[`prologue.exam.outcome.${outcome.id}`] ?? ""} ${text["prologue.retake.card"] ?? ""}`);
    expect(told.filter((words) => words.match(/cut-off/g)?.length !== 1)).toEqual([]);
  });

  test("[text:bands-not-figures] given the friend the send-off card names, when it is read, then it says who he is, and the send-off is not his own, which comes later in the game", () => {
    const card = text["prologue.friend.card"] ?? "";
    expect(card).toMatch(/Terna, your friend from school,/);
    expect(card).not.toMatch(/Terna's send-off/);
    // The ask's title is his own words; the results still name it Terna's send-off.
    expect(text["offer.send-off-party.title"]).toBe("My send-off party");
    expect(text["offer.send-off-party.name"]).toBe("Terna's send-off");
  });
});

describe("the nurse's course makes a nurse", () => {
  const careAdded = (step: string, answer: string): number =>
    (content.prologue[step]?.answers.find((found) => found.id === answer)?.effects ?? []).reduce((sum, effect) => sum + (effect.type === "quality/add" && effect.quality === "quality.care" ? effect.amount : 0), 0);

  test("[prologue:archetype-presets-answers] given the nursing course and the graduation as a nurse, when their care is added, then it reaches the staff nurse's bar, and the graduation grants the licence", () => {
    const bar = content.activity["activity.job-nurse"]?.requires.find((requirement) => requirement.type === "quality/min" && requirement.quality === "quality.care");
    expect(bar?.type === "quality/min" ? bar.value : null).toBe(60);
    expect(careAdded("course", "nursing") + careAdded("graduation", "results-nurse")).toBe(60);
    expect(content.prologue["graduation"]?.answers.find((answer) => answer.id === "results-nurse")?.effects).toContainEqual({ type: "document/grant", document: "document.nursing-licence" });
  });
});

describe("the send-off's crowds", () => {
  test("[prologue:tile-path-open-from-start] given the friend's card, then a life with care behind it may follow the nurses and hears of health care, and a life without cannot", () => {
    const card = content.prologue.friend;
    const care = card?.answers.find((answer) => answer.id === "care");
    expect(care?.effects).toEqual([{ type: "route/hear", route: "route.uk-care", via: "friend" }]);
    expect(care?.requires).toEqual([{ type: "quality/min", quality: "quality.care", value: 30 }]);
    expect(text["prologue.friend.answer.care"]).toBe("The nurses");
    expect(text["prologue.friend.answer.care.why"]).toBeDefined();
  });
});

describe("a room on the water (prologue:makoko-start-never-a-trap)", () => {
  test("[prologue:makoko-start-never-a-trap] given the home card, then it offers Makoko's room to every life: its answer opens Makoko's rent at the home page's charge and moves the life there, and says what it costs as the other homes do", () => {
    const makoko = content.prologue.home?.answers.find((answer) => answer.id === "makoko");
    expect(makoko?.requires).toEqual([]);
    expect(makoko?.next).toBeNull();
    expect(makoko?.effects).toEqual([
      { type: "obligation/open", obligation: "obligation.upkeep-makoko", amount: content.tuning.home.makokoUpkeep },
      { type: "home/move", place: "place.makoko" },
    ]);
    for (const key of ["prologue.home.answer.makoko", "prologue.home.answer.makoko.hint"]) {
      expect(text[key]).toBeTruthy();
      expect(text[key]).not.toMatch(/[\u2013\u2014]/);
    }
    expect(text["prologue.home.answer.makoko.hint"]).toContain("{amount}");
    // Where the life starts is said on the page in the client's words (prologue:printed-page-hands-over), so content keeps no handover line for a home.
    expect(Object.keys(text).filter((key) => key.startsWith("prologue.handover.home."))).toEqual([]);
  });
});
