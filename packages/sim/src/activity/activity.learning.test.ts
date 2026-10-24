// Learning tech at home: quality:skill-bands-slow-gains (gains by band), activity:study-days-capped (the day's class),
// activity:free-path-keeps-a-streak (the free path), activity:paid-tech-courses (the paid paths) and
// activity:bootcamp-paid-after-a-job. Real content, lives played through `step`.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Accepted, ActivityEntry, Id, SlotPick } from "../engine/types";
import { applyEffects, slot } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { keys, moneyOf, openObligations, readOf } from "../testing/read";
import { huntChanceBp } from "./activity.logic";
import { setPockets } from "../testing/wallet";
import { HUNT, JUNIOR_DEV, PORTFOLIO, REST, TECH } from "../testing/ids";

const LEARN_TECH: Id<"activity"> = "activity.learn-tech";
const FREE: Id<"activity"> = "activity.learn-free";
const COURSE: Id<"activity"> = "activity.online-course";
const DIPLOMA: Id<"activity"> = "activity.tech-diploma";
const BOOTCAMP: Id<"activity"> = "activity.bootcamp";
const INTERNSHIP: Id<"activity"> = "activity.free-internship";
const ENGLISH: Id<"quality"> = "quality.english";
const NETWORK: Id<"quality"> = "quality.network";
const { tuning } = content;

function entryOf(id: Id<"activity">): ActivityEntry {
  const entry = content.activity[id];
  if (entry === undefined) throw new Error(`No ${id} in content.`);
  return entry;
}

function option(game: Game, id: Id<"activity">) {
  const found = game.view().activities.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} is not in the view.`);
  return found;
}

/** Sets a quality to `value` exactly: down by one effect, up one point at a time so no cap cuts a step short. */
function setTo(game: Game, quality: Id<"quality">, value: number): void {
  const now = game.state.quality[quality] ?? 0;
  if (now > value) applyEffects(game, [{ type: "quality/add", quality, amount: value - now }]);
  for (let guard = 0; (game.state.quality[quality] ?? 0) < value && guard < 200; guard += 1) applyEffects(game, [{ type: "quality/add", quality, amount: 1 }]);
  expect(game.state.quality[quality]).toBe(value);
}

/** A life with no job and money to learn with, its energy kept up so the day's class is never spent. */
function learner(scenario: Id<"scenario"> = "scenario.graduate"): Game {
  const game = start({ content, scenario });
  if (game.state.activity.job !== null) game.accept({ type: "activity/quit" });
  setPockets(game, { NGN: 2000000_00 });
  return game;
}

/** The month played with these picks and rest in every other free slot; a turn is granted when none is banked. */
function month(game: Game, picks: SlotPick[] = []): Accepted {
  if (game.state.turn.banked < 1) game.grant(1);
  const free = game.view().freeSlots;
  const rests = Array.from({ length: Math.max(0, free - picks.length) }, () => slot(REST));
  return game.endTurn([...picks, ...rests]);
}

/** What a result added to a quality from one source. */
function gained(result: { events: Accepted["events"] }, quality: Id<"quality">, source: string): number {
  return result.events
    .filter((event) => event.type === "quality/changed")
    .map((event) => event as unknown as { quality: string; amount: number; source: string })
    .filter((event) => event.quality === quality && event.source === source)
    .reduce((sum, event) => sum + event.amount, 0);
}

/** The free path's month at a tech figure: what it gave to tech. */
function freeMonthAt(tech: number): number {
  const game = learner();
  setTo(game, TECH, tech);
  return gained(month(game, [slot(FREE)]), TECH, FREE);
}

describe("skills in bands", () => {
  test("[quality:skill-bands-slow-gains] given the tech bands, when the tuning is read, then they start at 0, 30, 50, 70 and 85", () => {
    expect(tuning.quality.techBands).toEqual([0, 30, 50, 70, 85]);
  });

  test("[quality:skill-bands-slow-gains] [activity:free-path-keeps-a-streak] given the free path, when a month is played at each band's edge, then it gives +3 while starting, +2 while junior-ready, +1 while working and nothing from 70", () => {
    expect([freeMonthAt(0), freeMonthAt(29), freeMonthAt(30), freeMonthAt(49), freeMonthAt(50), freeMonthAt(69), freeMonthAt(70), freeMonthAt(85)]).toEqual([3, 3, 2, 2, 1, 1, 0, 0]);
  });

  test("[quality:skill-bands-slow-gains] given a job's monthly tech, when the junior developer works a month in the working band, then its +2 is the job's own, not read by band", () => {
    const game = start({ content, scenario: "scenario.developer" });
    setTo(game, TECH, 55);
    expect(gained(month(game), TECH, JUNIOR_DEV)).toBe(2);
  });
});

describe("the day's coding class", () => {
  test("[activity:study-days-capped] given a starting learner, when three days of class are taken now, then each gives +1 and costs ₦5,000 under study; a fourth is refused and the view marks the class capped", () => {
    const game = learner();
    setTo(game, TECH, 10);
    for (let day = 0; day < tuning.turn.studyDaysCap; day += 1) {
      const done = game.accept({ type: "activity/now", activity: LEARN_TECH, param: null });
      expect(gained(done, TECH, LEARN_TECH)).toBe(1);
      expect(moneyOf(done, "study").map((event) => event.amount)).toEqual([5000_00]);
    }
    expect(option(game, LEARN_TECH)).toMatchObject({ allowed: false, capped: true });
    game.expectRejected({ type: "activity/now", activity: LEARN_TECH, param: null }, "not-legal");
    // The next month opens the class again.
    month(game);
    expect(option(game, LEARN_TECH).capped).toBeUndefined();
  });

  test("[activity:study-days-capped] given each band, when three days are taken, then they give the free path's month between them: 0, +1, +1 while junior-ready; 0, 0, +1 while working; nothing from 70", () => {
    for (const [tech, days] of [
      [30, [0, 1, 1]],
      [50, [0, 0, 1]],
      [70, [0, 0, 0]],
    ] as const) {
      const game = learner();
      setTo(game, TECH, tech);
      const given = Array.from({ length: 3 }, () => gained(game.accept({ type: "activity/now", activity: LEARN_TECH, param: null }), TECH, LEARN_TECH));
      expect({ tech, given }).toEqual({ tech, given: [...days] });
    }
  });

  test("[activity:study-days-capped] [activity:acts-may-repeat-in-month] given two days taken now, when the class also stands in a slot, then the slot runs one day more and no more", () => {
    const game = learner();
    setTo(game, TECH, 10);
    game.accept({ type: "activity/now", activity: LEARN_TECH, param: null });
    game.accept({ type: "activity/now", activity: LEARN_TECH, param: null });
    const played = month(game, [slot(LEARN_TECH)]);
    expect(moneyOf(played, "study").map((event) => event.amount)).toEqual([5000_00]);
    expect(gained(played, TECH, LEARN_TECH)).toBe(1);
  });

  test("[activity:study-days-capped] [activity:paid-tech-courses] given a course held, when the day's class is asked for, then it is refused and the view says you are on a course", () => {
    const game = learner();
    month(game, [slot(COURSE)]);
    expect(option(game, LEARN_TECH)).toMatchObject({ allowed: false, onCourse: true });
    game.expectRejected({ type: "activity/now", activity: LEARN_TECH, param: null }, "not-legal");
  });
});

describe("the free path", () => {
  test("[activity:free-path-keeps-a-streak] given the free path, when a month is played, then it costs the month's data under study and holds one slot", () => {
    const game = learner();
    const played = month(game, [slot(FREE)]);
    expect(moneyOf(played, "study").map((event) => event.amount)).toEqual([tuning.activity.freePathData]);
    expect(tuning.activity.freePathData).toBe(6500_00);
    expect(entryOf(FREE)).toMatchObject({ slot: "free", when: "month" });
  });

  test("[activity:free-path-keeps-a-streak] given five months in a row, when the fifth is played, then a certificate is finished: tech +2, portfolio +1 and its line; a month off sets the streak to nothing", () => {
    const game = learner();
    setTo(game, TECH, 0);
    for (let at = 1; at < tuning.activity.freeStreakMonths; at += 1) expect(keys(month(game, [slot(FREE)]))).not.toContain("line.activity.certificate");
    const fifth = month(game, [slot(FREE)]);
    expect(keys(fifth)).toContain("line.activity.certificate");
    expect(gained(fifth, PORTFOLIO, FREE)).toBe(1);
    expect(gained(fifth, TECH, FREE)).toBe(3 + tuning.activity.freeCertTech);
    expect(game.state.activity.streak).toBe(5);
    month(game);
    expect(game.state.activity.streak).toBe(0);
    for (let at = 1; at < tuning.activity.freeStreakMonths; at += 1) expect(keys(month(game, [slot(FREE)]))).not.toContain("line.activity.certificate");
  });

  test("[activity:free-path-keeps-a-streak] given a certificate due at tech 68, when the fifth month is played, then the path's +1 and the certificate never take tech past 69", () => {
    const game = learner();
    setTo(game, TECH, 60);
    for (let at = 1; at < tuning.activity.freeStreakMonths; at += 1) month(game, [slot(FREE)]);
    setTo(game, TECH, 68);
    const fifth = month(game, [slot(FREE)]);
    expect(game.state.quality[TECH]).toBe(69);
    expect(gained(fifth, PORTFOLIO, FREE)).toBe(1);
  });

  test("[activity:free-path-keeps-a-streak] given a life at tech 0, when the free path is played month after month, then it is junior-ready in the tenth month and not before", () => {
    const game = learner();
    setTo(game, TECH, 0);
    for (let at = 1; at <= 9; at += 1) month(game, [slot(FREE)]);
    expect(game.state.quality[TECH]).toBeLessThan(30);
    month(game, [slot(FREE)]);
    expect(game.state.quality[TECH]).toBeGreaterThanOrEqual(30);
  });
});

describe("the paid paths", () => {
  test("[activity:paid-tech-courses] given the short course, when it is played three months, then ₦45,000 is paid once at the start, it gives +6 a month while starting, and ends with portfolio +1 and its line", () => {
    const game = learner();
    setTo(game, TECH, 0);
    const first = month(game, [slot(COURSE)]);
    expect(moneyOf(first, "study").map((event) => event.amount)).toEqual([45000_00]);
    expect(gained(first, TECH, COURSE)).toBe(6);
    const second = month(game, [slot(COURSE)]);
    expect(moneyOf(second, "study")).toEqual([]);
    const third = month(game, [slot(COURSE)]);
    expect(gained(third, PORTFOLIO, COURSE)).toBe(1);
    expect(keys(third)).toContain("line.activity.course-finished");
    expect(game.state.activity.study).toBeUndefined();
  });

  test("[activity:paid-tech-courses] given the short course in the working band, when a month is played at 57 and at 60, then it gives up to 59 and nothing from 60", () => {
    const game = learner();
    setTo(game, TECH, 57);
    month(game, [slot(COURSE)]);
    expect(game.state.quality[TECH]).toBe(59);
    setTo(game, TECH, 60);
    expect(gained(month(game, [slot(COURSE)]), TECH, COURSE)).toBe(0);
  });

  test("[activity:paid-tech-courses] given a course held, when the free path or another course is asked for, then each is refused: one tech study at a time", () => {
    const game = learner();
    month(game, [slot(COURSE)]);
    for (const other of [FREE, DIPLOMA, INTERNSHIP]) expect({ other, allowed: option(game, other).allowed }).toEqual({ other, allowed: false });
    game.expectRejected({ type: "turn/end", slots: [slot(FREE)] }, "not-legal");
    expect(option(game, COURSE).allowed).toBe(true);
  });

  test("[activity:paid-tech-courses] given the diploma, when it starts, then ₦40,000 a month is owed as its obligation for 12 months; it gives +4, +3 and +2 by band, and a month behind on its instalment gives nothing and does not count", () => {
    const game = learner();
    setTo(game, TECH, 10);
    const first = month(game, [slot(DIPLOMA)]);
    expect(openObligations(game)).toContain("obligation.tech-diploma");
    expect(content.obligation["obligation.tech-diploma"]).toMatchObject({ currency: "NGN", term: 12, rateBp: 0 });
    expect(gained(first, TECH, DIPLOMA)).toBe(4);
    expect(game.state.activity.study).toEqual({ activity: DIPLOMA, months: 1 });
    setPockets(game, { NGN: 0 });
    month(game, [slot(DIPLOMA)]);
    const behind = month(game, [slot(DIPLOMA)]);
    expect(gained(behind, TECH, DIPLOMA)).toBe(0);
    expect(game.state.activity.study?.months).toBe(2);
  });

  test("[activity:paid-tech-courses] [activity:bootcamp-paid-after-a-job] given the bootcamp, when it starts, then the job held ends, nothing is paid now, it gives +6 while starting and +5 up to 54, and after six months ends with portfolio +3, network +10 and the debt recorded", () => {
    const game = start({ content, scenario: "scenario.graduate" });
    applyEffects(game, [{ type: "activity/start-job", job: "activity.job-customer-service" }]);
    setTo(game, TECH, 10);
    setTo(game, ENGLISH, 55);
    const first = month(game, [slot(BOOTCAMP)]);
    expect(game.state.activity.job).toBeNull();
    expect(moneyOf(first, "study")).toEqual([]);
    expect(gained(first, TECH, BOOTCAMP)).toBe(6);
    expect(hunted(game)).not.toContain("activity.job-customer-service");
    setTo(game, TECH, 52);
    month(game, [slot(BOOTCAMP)]);
    expect(game.state.quality[TECH]).toBe(54);
    for (let at = 3; at < 6; at += 1) month(game, [slot(BOOTCAMP)]);
    const network = game.state.quality[NETWORK] ?? 0;
    const portfolio = game.state.quality[PORTFOLIO] ?? 0;
    const last = month(game, [slot(BOOTCAMP)]);
    expect(keys(last)).toContain("line.activity.course-finished");
    expect([game.state.quality[PORTFOLIO], game.state.quality[NETWORK]]).toEqual([portfolio + 3, network + 10]);
    expect(game.state.activity.bootcampOwed).toBe(tuning.activity.bootcampFee);
    // Once a life.
    expect(option(game, BOOTCAMP).allowed).toBe(false);
  });

  test("[activity:paid-tech-courses] given the bootcamp's entry test, when tech is 9 or English 54, then it cannot be started", () => {
    const game = learner();
    setTo(game, TECH, 9);
    setTo(game, ENGLISH, 60);
    expect(option(game, BOOTCAMP).allowed).toBe(false);
    setTo(game, TECH, 10);
    setTo(game, ENGLISH, 54);
    expect(option(game, BOOTCAMP).allowed).toBe(false);
    setTo(game, ENGLISH, 55);
    expect(option(game, BOOTCAMP).allowed).toBe(true);
  });

  test("[activity:paid-tech-courses] given the internship, when tech is under 30 it is shut; at 30 it gives +2 a month for two months and ends with portfolio +1 and network +5", () => {
    const game = learner();
    setTo(game, TECH, 29);
    expect(option(game, INTERNSHIP).allowed).toBe(false);
    setTo(game, TECH, 30);
    setTo(game, PORTFOLIO, 0);
    const first = month(game, [slot(INTERNSHIP)]);
    expect(gained(first, TECH, INTERNSHIP)).toBe(2);
    expect(moneyOf(first, "study")).toEqual([]);
    const network = game.state.quality[NETWORK] ?? 0;
    const second = month(game, [slot(INTERNSHIP)]);
    expect(gained(second, TECH, INTERNSHIP)).toBe(2);
    expect(game.state.quality[PORTFOLIO]).toBe(1);
    expect(game.state.quality[NETWORK]).toBe(network + 5);
  });

  test("[activity:paid-tech-courses] given the diploma in progress, when the character flies, then the course ends with the flight and its fees close", () => {
    const game = learner();
    month(game, [slot(DIPLOMA)]);
    const flight = { type: "activity/end-job", why: "moved" } as const;
    applyEffects(game, [flight]);
    expect(openObligations(game)).not.toContain("obligation.tech-diploma");
    expect(game.state.activity.study).toBeUndefined();
  });
});

function hunted(game: Game): readonly string[] {
  return game.view().activities.find((entry) => entry.id === HUNT)?.params ?? [];
}

describe("the bootcamp paid after a job", () => {
  /** A life just out of the bootcamp, owing its fee. */
  function graduated(): Game {
    const game = learner();
    setTo(game, TECH, 10);
    setTo(game, ENGLISH, 55);
    for (let at = 0; at < 6; at += 1) month(game, [slot(BOOTCAMP)]);
    expect(game.state.activity.bootcampOwed).toBe(tuning.activity.bootcampFee);
    return game;
  }

  test("[activity:bootcamp-paid-after-a-job] given the bootcamp's debt, when the first developer job starts, then obligation.bootcamp opens for it, 36 charges with no interest, crediting nothing, and the debt on the slice is gone", () => {
    const game = graduated();
    const before = game.state.wallet.pockets.NGN.bank;
    applyEffects(game, [{ type: "activity/start-job", job: JUNIOR_DEV }]);
    const owed = Object.values(game.state.obligation.items).find((item) => item.entry === "obligation.bootcamp");
    expect(owed).toMatchObject({ principal: tuning.activity.bootcampFee, outstanding: tuning.activity.bootcampFee, monthsLeft: 36 });
    expect(content.obligation["obligation.bootcamp"]).toMatchObject({ type: "loan", where: "any", term: 36, rateBp: 0, sink: "loan-repay" });
    expect(game.state.wallet.pockets.NGN.bank).toBe(before);
    expect(game.state.activity.bootcampOwed).toBeUndefined();
  });

  test("[activity:bootcamp-paid-after-a-job] given the bootcamp's debt, when a job that is not a developer's starts, then nothing is owed yet; a life that never holds one owes nothing", () => {
    const game = graduated();
    applyEffects(game, [{ type: "activity/start-job", job: "activity.job-customer-service" }]);
    expect(openObligations(game)).not.toContain("obligation.bootcamp");
    expect(game.state.activity.bootcampOwed).toBe(tuning.activity.bootcampFee);
  });

  test("[activity:paid-tech-courses] given the bootcamp finished, when the junior developer's hunt is read in the six months after, then its chance carries the bootcamp's help, and not after", () => {
    const game = graduated();
    const junior = entryOf(JUNIOR_DEV);
    const base = Math.min(tuning.quality.hireMaxBp, (junior.hireBp ?? 0) + tuning.quality.networkHireBp * (game.state.quality[NETWORK] ?? 0));
    expect(huntChanceBp(readOf(game), junior)).toBe(Math.min(tuning.quality.hireMaxBp, base + tuning.activity.bootcampHireBp));
    for (let at = 1; at < tuning.activity.bootcampHireMonths; at += 1) month(game);
    expect(huntChanceBp(readOf(game), junior)).toBe(Math.min(tuning.quality.hireMaxBp, base + tuning.activity.bootcampHireBp));
    month(game);
    expect(huntChanceBp(readOf(game), junior)).toBe(base);
  });
});
