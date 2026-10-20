// The talent route's nudges follow the file's order (world:nudge-says-one-thing; route-gates:applying-for-endorsement,
// route-gates:talent-visa-needs-endorsement): the passport comes before the endorsement, so a life following every nudge never buys an endorsement
// that runs out waiting on it; a route the news has closed says so instead of "needs more"; a need whose act is
// already running is passed over. Real content, lives played through `step`.
import { content } from "@japacity/content";
import type { Id, PlayerView, SlotPick } from "@japacity/sim";
import { applyEffects, readyLife, slot, start, type Game } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { archetypeOf } from "../../../shared/frontdoor/archetypes";
import { playTile } from "../../../shared/frontdoor/archetypes.testing";
import { shortfall } from "../../../shared/words/cost";
import { settle } from "../../../shared/testing/nurse";
import { formatMoney } from "../../../shared/words/format";
import { hasWords, say } from "../../../shared/words/text";
import { BETTER_JOB, EVERY_ROUTE_CLOSED, nudgeOf, STEP_ACTIVITY, stepWayOf } from "./nudge";
import { stepOpen } from "./stepOpen";

const TALENT: Id<"route"> = "route.uk-talent";
const FILE = "chapter.build-the-file-talent";
const ENDORSE = "activity.apply-endorsement";
const NUDGE_WORDS = 8;
const WINDOWS = Object.values(content.route).flatMap((route) => (route?.window === null || route?.window === undefined ? [] : [route.window]));

function words(said: string): number {
  return said.split(/\s+/).filter(Boolean).length;
}

/** The act a nudge names, as a player who taps it and then the sheet's main button takes it; null when it names a wait. */
function actNamed(view: PlayerView, nudge: ReturnType<typeof nudgeOf>): SlotPick | null {
  const pick = (activity: string, param: string | null = null): SlotPick => ({ activity: activity as Id<"activity">, param });
  if (nudge.way?.opens !== undefined) return pick(nudge.way.opens, nudge.way.param ?? null);
  if (nudge.key.startsWith("ui.nudge.meanwhile.")) return pick(`activity.${nudge.key.slice("ui.nudge.meanwhile.".length)}`);
  // A gap or a better job: the jobs board, its best-paid job (the driver taps the board's first act, the hunt).
  if (nudge.key === BETTER_JOB || nudge.key.endsWith(".short") || nudge.key === "ui.nudge.broke.job") {
    const board = view.activities.find((option) => option.id === "activity.job-hunt")?.params ?? [];
    const best = [...board].sort((a, b) => payOf(b) - payOf(a))[0];
    return best === undefined || payOf(best) <= payOf(view.job.id ?? "") ? null : pick("activity.job-hunt", best);
  }
  // "Look into it" names the page of the life's own way out, read in Japa: its card there (chapter:chapters-follow-lean-route).
  if (nudge.key.endsWith(".own.needs") || nudge.key.endsWith(".nudge.own")) {
    const pages = view.activities.find((option) => option.id === "activity.look-into-route")?.params ?? [];
    return pick("activity.look-into-route", pages.includes(TALENT) ? TALENT : (pages[0] ?? null));
  }
  // A step's own words: the step's act, as its sheet's main button takes it.
  const step = /^(chapter\.[^.]+)\.item\.([^.]+)(\.nudge(\.here)?)?$/.exec(nudge.key);
  const activity = step === null ? undefined : STEP_ACTIVITY[`${step[1]}.${step[2]}`];
  return activity === undefined ? null : pick(activity, activity === "activity.look-into-route" ? TALENT : null);
}

function payOf(job: string): number {
  const pay = content.activity[job as Id<"activity">]?.pay ?? null;
  return pay === null || typeof pay.amount !== "number" ? 0 : pay.amount;
}

interface Paid {
  month: number;
  passport: boolean;
  /** The naira short of the TB test and the application once the endorsement is paid. */
  short: number;
}

/**
 * The ready developer played as the play driver plays her: each month the asks answered (a job taken), the nudge read
 * and its act taken when it can be, a now-act at once and a month-act in the month's plan, then the month ended.
 */
function followTheNudge(game: Game, months: number): { paid: Paid[]; refused: number; ranOut: number; passportMonth: number | null } {
  const paid: Paid[] = [];
  let refused = 0;
  let ranOut = 0;
  let passportMonth: number | null = null;
  for (let played = 0; played < months; played += 1) {
    settle(game);
    if (game.state.turn.banked < 1) game.grant(24);
    const view = game.view();
    const nudge = nudgeOf(view, hasWords, []);
    const act = actNamed(view, nudge);
    const option = act === null ? undefined : view.activities.find((candidate) => candidate.id === act.activity);
    const slots: SlotPick[] = [];
    if (act !== null && option?.allowed === true && option.affordable && (act.param === null || (option.params ?? []).includes(act.param))) {
      if (option.when === "now") {
        game.accept({ type: "activity/now", activity: act.activity, param: act.param });
        if (act.activity === ENDORSE) {
          const after = game.view();
          const costs = ["activity.tb-test", "activity.apply-uk-talent"].flatMap((id) => after.activities.find((candidate) => candidate.id === id)?.cost ?? []);
          paid.push({ month: view.month, passport: view.documents.some((paper) => paper.id === "document.passport" && paper.state === "held"), short: shortfall(after, costs).short });
        }
      } else slots.push(act);
    }
    const ended = game.endTurn(slots);
    settle(game);
    for (const line of ended.lines) {
      if (line.key === "line.route.endorsement-refused") refused += 1;
      if (line.key === "line.document.expired" && line.params["document"] === "document.endorsement") ranOut += 1;
    }
    if (passportMonth === null && game.view().documents.some((paper) => paper.id === "document.passport" && paper.state === "held")) passportMonth = game.view().month;
  }
  return { paid, refused, ranOut, passportMonth };
}

/** The tile's developer, handed over: its preset answers while allowed, else the answer that suits it. */
function tileDeveloper(seed: string): Game {
  const archetype = archetypeOf("developer");
  if (archetype === null) throw new Error("No developer tile.");
  const game = start({ scenario: "scenario.prologue", seed, content, worldSeed: "world-1" });
  playTile(game, archetype);
  return game;
}

/** A view in the talent file with its steps as given, as the chapter has them then. */
function inTheFile(view: PlayerView, met: { portfolio: boolean; endorsement: boolean }): PlayerView {
  return { ...view, offers: [], setpiece: null, interview: null, chapter: { current: FILE, items: [{ id: "portfolio", met: met.portfolio }, { id: "endorsement", met: met.endorsement }, { id: "applied", met: false }], done: [], closes: false, next: null } };
}

/** A developer at the endorsement's bars with the talent page read: `documents` her papers, `vars` the world's over the stand-in's. */
function talentLife(options: { documents?: { document: Id<"document">; monthsLeft: number | null; value: number | null }[]; vars?: (tick: number) => Record<Id<"var">, number>; pockets?: { NGN: { bank: number; cash: number } } } = {}): Game {
  const game = readyLife(content, {
    quiet: true,
    qualities: { "quality.tech": 85, "quality.portfolio": 5, "quality.network": 70 },
    ...(options.documents === undefined ? {} : { documents: options.documents }),
    ...(options.vars === undefined ? {} : { vars: options.vars }),
    ...(options.pockets === undefined ? {} : { pockets: options.pockets }),
  });
  for (let months = 0; months < 4 && game.state.route["route.uk-masters"]!.state === "unknown"; months += 1) game.endTurn();
  applyEffects(game, [{ type: "route/hear", route: TALENT, via: "meetup" }]);
  game.endTurn([slot("activity.look-into-route", TALENT)]);
  return game;
}

describe("the talent file in its order", () => {
  test("[world:nudge-says-one-thing] [route-gates:applying-for-endorsement] [route-gates:talent-visa-needs-endorsement] given the ready developer, when the nudge is followed as the play driver follows it for 36 months, then the passport is held before the endorsement is paid, the endorsement is paid once for each answer and never runs out unused, and the TB test and the application are paid for when it is", () => {
    const game = start({ scenario: "scenario.developer", seed: "ready-developer", content, worldSeed: "world-1" });
    expect(game.view().documents.some((paper) => paper.id === "document.passport")).toBe(false);
    const { paid, refused, ranOut, passportMonth } = followTheNudge(game, 36);
    expect(passportMonth).not.toBeNull();
    expect(paid.length).toBeGreaterThan(0);
    expect(paid.every((one) => one.passport && passportMonth !== null && passportMonth <= one.month)).toBe(true);
    expect(paid.every((one) => one.short === 0)).toBe(true);
    // Each endorsement paid is answered by the body: a refusal is the only way it is paid again.
    expect(paid.length).toBeLessThanOrEqual(1 + refused);
    expect(ranOut).toBe(0);
  });

  test("[world:nudge-says-one-thing] [route-gates:talent-visa-needs-endorsement] given the endorsement held and no passport, when the nudge is read, then it names the passport at its office, never the application its sheet shuts", () => {
    const view = inTheFile(talentLife({ documents: [] }).view(), { portfolio: true, endorsement: true });
    expect(view.routes.find((route) => route.id === TALENT)?.checklist.find((item) => item.id === "passport")?.met).toBe(false);
    const nudge = nudgeOf(view);
    expect(nudge.key).toBe("chapter.build-the-file.item.passport.nudge");
    expect(say(nudge.key)).toBe("Apply for your passport in Ikoyi");
    expect(stepWayOf(view)).toMatchObject({ go: "place.passport-office", opens: "activity.get-passport" });
  });

  test("[world:nudge-says-one-thing] [route-gates:applying-for-endorsement] given the endorsement open to ask for and no passport, when the nudge is read, then it names the passport first; with the passport on its way, it says when it comes", () => {
    const game = talentLife({ documents: [] });
    const first = nudgeOf(inTheFile(game.view(), { portfolio: true, endorsement: false }));
    expect(first.key).toBe("chapter.build-the-file.item.passport.nudge");
    game.accept({ type: "activity/now", activity: "activity.get-passport", param: null });
    const waiting = nudgeOf(inTheFile(game.view(), { portfolio: true, endorsement: false }));
    expect(waiting.key).not.toBe("chapter.build-the-file-talent.item.endorsement.nudge");
    expect(waiting.key.startsWith("chapter.build-the-file.item.passport") || waiting.key.startsWith("ui.nudge.")).toBe(true);
  });

  test("[world:nudge-says-one-thing] [route-gates:applying-for-endorsement] [route-gates:talent-visa-needs-endorsement] given the passport held and too little to pay the TB test and the application after the endorsement, when the nudge is read, then it names how much more to find, never the endorsement, and its words are under eight", () => {
    const passport = [{ document: "document.passport" as const, monthsLeft: 60, value: null }];
    const view = inTheFile(talentLife({ documents: passport, pockets: { NGN: { bank: 300_000_000, cash: 0 } } }).view(), { portfolio: true, endorsement: false });
    const endorse = view.activities.find((option) => option.id === ENDORSE)!;
    expect([endorse.allowed, endorse.affordable]).toEqual([true, true]);
    const costs = [ENDORSE, "activity.tb-test", "activity.apply-uk-talent"].flatMap((id) => view.activities.find((option) => option.id === id)?.cost ?? []);
    const gap = shortfall(view, costs);
    expect(gap.short).toBeGreaterThan(0);
    const nudge = nudgeOf(view);
    expect(nudge).toMatchObject({ key: `${FILE}.item.endorsement.short`, params: { amount: formatMoney(gap.short, "NGN") } });
    expect(words(say(nudge.key, { amount: formatMoney(gap.short, "NGN") }))).toBeLessThanOrEqual(NUDGE_WORDS);
    // With enough for all three, the endorsement itself.
    const rich = inTheFile(talentLife({ documents: passport, pockets: { NGN: { bank: 3_000_000_000, cash: 0 } } }).view(), { portfolio: true, endorsement: false });
    expect(nudgeOf(rich).key).toBe(`${FILE}.item.endorsement.nudge`);
  });

  test("[world:nudge-says-one-thing] [route-gates:talent-visa-needs-endorsement] given the endorsement and the passport held, when the nudge is read, then the TB test comes before the application, and the application once it is held", () => {
    const game = talentLife({ documents: [{ document: "document.passport", monthsLeft: 60, value: null }], pockets: { NGN: { bank: 3_000_000_000, cash: 0 } } });
    applyEffects(game, [{ type: "document/grant", document: "document.endorsement" }]);
    const view = inTheFile(game.view(), { portfolio: true, endorsement: true });
    expect(view.documents.some((paper) => paper.id === "document.endorsement" && paper.state === "held")).toBe(true);
    expect(view.documents.some((paper) => paper.id === "document.tb-certificate")).toBe(false);
    const tb = nudgeOf(view);
    expect(tb.key).toBe("chapter.decision-day-talent.item.tb.nudge");
    expect(stepWayOf(view)).toMatchObject({ go: "place.tb-clinic" });
    applyEffects(game, [{ type: "document/grant", document: "document.tb-certificate" }]);
    expect(nudgeOf(inTheFile(game.view(), { portfolio: true, endorsement: true })).key).toBe(`${FILE}.item.applied.nudge`);
  });
});

describe("a closed route says so", () => {
  test("[world:nudge-says-one-thing] [route-gates:applying-for-endorsement] given every need of the endorsement met and every route closed by the news, when the nudge is read, then it says every route is closed in under eight words, its tap opens Japa, and no desk is pointed at", () => {
    const closed = Object.fromEntries(WINDOWS.map((window) => [window, 0])) as Record<Id<"var">, number>;
    let from = Number.POSITIVE_INFINITY;
    const game = talentLife({ vars: (tick) => (tick >= from ? closed : {}) });
    // The news closes every window once the page is read, as the pandemic does (news.pandemic-borders).
    from = game.tick;
    const view = inTheFile(game.view(), { portfolio: true, endorsement: false });
    expect(view.routes.every((route) => (content.route[route.id]?.window ?? null) === null || route.window === "closed")).toBe(true);
    const endorse = view.activities.find((option) => option.id === ENDORSE)!;
    expect(endorse.allowed).toBe(false);
    expect(endorse.missing.every((requirement) => requirement.type === "var/min")).toBe(true);
    const nudge = nudgeOf(view);
    expect(nudge.key).toBe(EVERY_ROUTE_CLOSED);
    expect(say(nudge.key)).toBe("Every route is closed for now");
    expect(words(say(nudge.key))).toBeLessThanOrEqual(NUDGE_WORDS);
    expect(nudge.way).toMatchObject({ go: null, at: [], app: "japa" });
    expect(stepOpen(nudge.way!, null, [], "place.yaba")).toEqual({ kind: "app", app: "japa", act: null });
  });

  test("[world:nudge-says-one-thing] given only the talent route closed, when the nudge is read, then it names that route as closed, not every route", () => {
    let from = Number.POSITIVE_INFINITY;
    const game = talentLife({ vars: (tick) => (tick >= from ? { "var.uk-talent-window": 0 } : {}) });
    from = game.tick;
    const view = inTheFile(game.view(), { portfolio: true, endorsement: false });
    expect(view.routes.find((route) => route.id === TALENT)?.window).toBe("closed");
    const nudge = nudgeOf(view);
    expect(nudge.key).toBe(`${FILE}.item.endorsement.closed`);
    expect(words(say(nudge.key))).toBeLessThanOrEqual(NUDGE_WORDS);
    expect(nudge.way).toMatchObject({ app: "japa" });
  });
});

describe("a need already running is passed over", () => {
  test("[world:nudge-says-one-thing] [route-gates:applying-for-endorsement] given the developer tile in the talent file short of tech and of people, when the coding course is planned or carries on, then the nudge moves on to the meetup; with every need's act running, it says the plan is set", () => {
    const game = tileDeveloper("tile-developer-course");
    expect(game.state.prologue.open).toBe(false);
    // Tech short of the endorsement's 75 and the people short of its 50, the pieces met, the passport held.
    applyEffects(game, [
      { type: "quality/add", quality: "quality.tech", amount: 60 - (game.state.quality["quality.tech"] ?? 0) },
      { type: "quality/add", quality: "quality.portfolio", amount: 3 - (game.state.quality["quality.portfolio"] ?? 0) },
      { type: "quality/add", quality: "quality.network", amount: 30 - (game.state.quality["quality.network"] ?? 0) },
      { type: "document/grant", document: "document.passport" },
    ]);
    applyEffects(game, [{ type: "route/hear", route: TALENT, via: "meetup" }]);
    game.accept({ type: "activity/now", activity: "activity.look-into-route", param: TALENT });
    expect(game.state.route[TALENT]?.state).toBe("known");
    const view = inTheFile(game.view(), { portfolio: true, endorsement: false });
    const endorse = view.activities.find((option) => option.id === ENDORSE)!;
    expect(endorse.allowed).toBe(false);
    expect(view.routes.find((route) => route.id === TALENT)?.checklist.find((item) => item.id === "passport")?.met).toBe(true);
    expect(nudgeOf(view).key).toBe(`${FILE}.item.endorsement.needs.quality.tech`);
    const course = nudgeOf(view, hasWords, ["activity.learn-tech"]);
    expect(course.key).toBe(`${FILE}.item.endorsement.needs.quality.network`);
    expect(course.way).toMatchObject({ opens: "activity.meetup" });
    const both = nudgeOf(view, hasWords, ["activity.learn-tech", "activity.meetup"]);
    expect(both.key).toBe(`${FILE}.item.endorsement.needs.planned`);
    expect(both.way).toMatchObject({ go: null, at: [] });
    expect(words(say(both.key))).toBeLessThanOrEqual(NUDGE_WORDS);
  });
});
