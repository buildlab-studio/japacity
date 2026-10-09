// The waiting months build the profile toward a route: docs/rules/activity.md R-ACTIVITY-013 (the
// developer's acts, the nurse's certification, a master's at home) and R-ACTIVITY-014 (side jobs pay by
// level). Each test plays a real life from content and reads its figures from content.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { bp } from "../engine/int";
import type { Accepted, ActivityEntry, BaseEvent, Id, Money, ReadCtx, SlotPick } from "../engine/types";
import { pointsScore } from "../route/gates/points";
import { applyEffects, draw, slot } from "../route/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";

const NIGHT: Id<"activity"> = "activity.night-support";
const TUTORING: Id<"activity"> = "activity.weekend-tutoring";
const RIDE: Id<"activity"> = "activity.ride-driving";
const OPEN_SOURCE: Id<"activity"> = "activity.open-source";
const POSTS: Id<"activity"> = "activity.tech-posts";
const TALK: Id<"activity"> = "activity.conference-talk";
const NOTICED: Id<"activity"> = "activity.be-noticed";
const CERTIFY: Id<"activity"> = "activity.nurse-certification";
const MASTERS: Id<"activity"> = "activity.masters-at-home";
const REST: Id<"activity"> = "activity.rest";
const CANADA: Id<"route"> = "route.canada-points";
const TALENT: Id<"route"> = "route.uk-talent";
const CARE_ROUTE: Id<"route"> = "route.uk-care";

const TECH: Id<"quality"> = "quality.tech";
const NETWORK: Id<"quality"> = "quality.network";
const PORTFOLIO: Id<"quality"> = "quality.portfolio";
const STANDING: Id<"quality"> = "quality.standing";
const CARE: Id<"quality"> = "quality.care";
const EDU: Id<"quality"> = "quality.edu-level";

interface Credit {
  type: string;
  currency: string;
  pocket: string;
  amount: number;
  reason: string;
}

function entryOf(id: Id<"activity">): ActivityEntry {
  const entry = content.activity[id];
  if (entry === undefined) throw new Error(`No ${id} in content.`);
  return entry;
}

function figure(money: Money): number {
  if (typeof money.amount !== "number") throw new Error("A fixed figure was expected.");
  return money.amount;
}

function readOf(game: Game): ReadCtx {
  return { state: game.state, world: game.world(), content: game.content };
}

function qualityOf(game: Game, quality: Id<"quality">): number {
  return game.state.quality[quality] ?? 0;
}

/** Raises a quality one point at a time to `value`, so the skill caps never cut a step short. */
function raiseTo(game: Game, quality: Id<"quality">, value: number): void {
  for (let guard = 0; qualityOf(game, quality) < value && guard < 200; guard += 1) applyEffects(game, [{ type: "quality/add", quality, amount: 1 }]);
  expect(qualityOf(game, quality)).toBe(value);
}

function credits(result: Accepted, reason: string): Credit[] {
  return result.events.filter((event): event is BaseEvent & Credit => event.type === "wallet/credited" && (event as unknown as Credit).reason === reason);
}

/** The month played with these picks and rest in every other free slot; a turn is granted when none is banked. */
function month(game: Game, picks: SlotPick[]): Accepted {
  if (game.state.turn.banked < 1) game.grant(1);
  const free = game.view().freeSlots;
  const slotted = picks.filter((pick) => entryOf(pick.activity).slot !== "none");
  const rests = Array.from({ length: Math.max(0, free - slotted.length) }, () => slot(REST));
  return game.endTurn([...picks, ...rests]);
}

function allowed(game: Game, id: Id<"activity">): boolean {
  return game.view().activities.find((option) => option.id === id)?.allowed ?? false;
}

function gained(result: Accepted, quality: Id<"quality">, source: string): number {
  return result.events
    .filter((event) => event.type === "quality/changed")
    .map((event) => event as unknown as { quality: string; amount: number; source: string })
    .filter((event) => event.quality === quality && event.source === source)
    .reduce((sum, event) => sum + event.amount, 0);
}

function holding(scenario: Id<"scenario">, side: Id<"activity">): Game {
  const game = start({ content, scenario });
  applyEffects(game, [{ type: "activity/start-job", job: side }]);
  return game;
}

/** A seed whose first draw on the job stream lands under the chance (or over it, with `hit` false). */
function seedFor(hit: boolean): string {
  const chance = content.tuning.activity.raiseChanceBp;
  for (let n = 0; n < 200; n += 1) {
    const seed = `notice-${String(n)}`;
    if (draw(seed, "job", 0, 10000) < chance === hit) return seed;
  }
  throw new Error("No seed found.");
}

describe("side jobs by level", () => {
  test("[R-ACTIVITY-014] given weekend tutoring, when a month is paid at one point under its tier and then at the tier, then the entry's own pay comes first and the tier's pay once its tech is met", () => {
    const tiers = entryOf(TUTORING).tiers ?? [];
    const [tier] = tiers;
    if (tier === undefined) throw new Error("Tutoring has no tier.");
    const game = holding("scenario.ada", TUTORING);
    raiseTo(game, tier.min.quality, tier.min.value - 1);
    expect(credits(month(game, []), "gig").map((credit) => credit.amount)).toEqual([figure(entryOf(TUTORING).pay!)]);
    raiseTo(game, tier.min.quality, tier.min.value);
    expect(credits(month(game, []), "gig").map((credit) => credit.amount)).toEqual([figure(tier.pay)]);
    expect(figure(tier.pay)).toBeGreaterThan(figure(entryOf(TUTORING).pay!));
  });

  test("[R-ACTIVITY-014] given the night shift with two tiers, when both are met, then the highest tier pays, in its own currency to the bank", () => {
    const tiers = entryOf(NIGHT).tiers ?? [];
    expect(tiers.length).toBeGreaterThanOrEqual(2);
    const top = tiers.reduce((best, tier) => (figure(tier.pay) > figure(best.pay) ? tier : best));
    const game = holding("scenario.ada", NIGHT);
    for (const tier of tiers) raiseTo(game, tier.min.quality, Math.max(qualityOf(game, tier.min.quality), tier.min.value));
    const paid = credits(month(game, []), "salary");
    expect(paid).toEqual([{ type: "wallet/credited", currency: top.pay.currency, pocket: "bank", amount: figure(top.pay), reason: "salary" }]);
  });

  test("[R-ACTIVITY-014] given ride driving held by a life under its network tier, when its network reaches the tier, then the month pays more", () => {
    const [tier] = entryOf(RIDE).tiers ?? [];
    if (tier === undefined) throw new Error("Ride driving has no tier.");
    expect(tier.min.quality).toBe(NETWORK);
    const game = holding("scenario.tunde", RIDE);
    expect(qualityOf(game, NETWORK)).toBeLessThan(tier.min.value);
    const before = credits(month(game, []), "gig").reduce((sum, credit) => sum + credit.amount, 0);
    raiseTo(game, NETWORK, tier.min.value);
    const after = credits(month(game, []), "gig").reduce((sum, credit) => sum + credit.amount, 0);
    expect(before).toBe(figure(entryOf(RIDE).pay!));
    expect(after).toBe(figure(tier.pay));
  });
});

describe("the developer's acts", () => {
  test("[R-ACTIVITY-013] given a developer at tech 40, when open source is played two months running, then each month adds network and the second adds a portfolio piece; under tech 40 it is not legal", () => {
    const game = start({ content, scenario: "scenario.zainab" });
    expect(entryOf(OPEN_SOURCE).counts).toContain(TALENT);
    const first = month(game, [slot(OPEN_SOURCE)]);
    expect(gained(first, NETWORK, OPEN_SOURCE)).toBe(2);
    expect(gained(first, PORTFOLIO, OPEN_SOURCE)).toBe(0);
    const second = month(game, [slot(OPEN_SOURCE)]);
    expect(gained(second, NETWORK, OPEN_SOURCE)).toBe(2);
    expect(gained(second, PORTFOLIO, OPEN_SOURCE)).toBe(1);
    expect(gained(month(game, [slot(OPEN_SOURCE)]), PORTFOLIO, OPEN_SOURCE)).toBe(0);

    const ada = start({ content, scenario: "scenario.ada" });
    raiseTo(ada, TECH, 39);
    expect(allowed(ada, OPEN_SOURCE)).toBe(false);
    ada.expectRejected({ type: "turn/end", slots: [slot(OPEN_SOURCE)] }, "not-legal");
    raiseTo(ada, TECH, 40);
    expect(allowed(ada, OPEN_SOURCE)).toBe(true);
  });

  test("[R-ACTIVITY-013] given tech 30, when tech posts ride with the month, then they fill no slot and add network and standing; a second in one month fails, and under tech 30 they are not offered", () => {
    const game = start({ content, scenario: "scenario.ada" });
    expect(entryOf(POSTS).slot).toBe("none");
    const free = game.view().freeSlots;
    const played = game.endTurn([slot(POSTS), ...Array.from({ length: free }, () => slot(REST))]);
    expect(gained(played, NETWORK, POSTS)).toBe(1);
    expect(gained(played, STANDING, POSTS)).toBe(1);
    const twice = month(game, [slot(POSTS), slot(POSTS)]);
    expect(gained(twice, NETWORK, POSTS)).toBe(1);
    expect(twice.events).toContainEqual({ type: "activity/slot-failed", slot: 1, activity: POSTS, param: null, why: "requirements" });

    const tunde = start({ content, scenario: "scenario.tunde" });
    raiseTo(tunde, TECH, 29);
    expect(allowed(tunde, POSTS)).toBe(false);
    raiseTo(tunde, TECH, 30);
    expect(allowed(tunde, POSTS)).toBe(true);
  });

  test("[R-ACTIVITY-013] given portfolio 2 and network 40, when the talk is given, then its one question opens, portfolio, standing and network rise, and once answered it is never offered again", () => {
    const game = start({ content, scenario: "scenario.zainab" });
    raiseTo(game, NETWORK, 39);
    expect(allowed(game, TALK)).toBe(false);
    raiseTo(game, NETWORK, 40);
    expect(allowed(game, TALK)).toBe(true);
    const talk = month(game, [slot(TALK)]);
    expect(gained(talk, PORTFOLIO, TALK)).toBe(1);
    expect(gained(talk, STANDING, TALK)).toBe(5);
    expect(gained(talk, NETWORK, TALK)).toBe(5);
    const open = game.view().setpiece;
    expect(open?.entry).toBe("setpiece.conference-talk");
    expect(open?.total).toBe(1);
    game.accept({ type: "setpiece/answer", question: open!.question!.id, answer: open!.question!.answers[0]! });
    expect(game.view().setpiece).toBeNull();
    expect(allowed(game, TALK)).toBe(false);
    game.expectRejected({ type: "turn/end", slots: [slot(TALK)] }, "not-legal");
  });

  test("[R-ACTIVITY-013] given a job held five months, when being noticed is read, then it is not offered; at six months it is", () => {
    const game = start({ content, scenario: "scenario.ada" });
    applyEffects(game, [{ type: "activity/start-job", job: "activity.job-customer-service" }]);
    for (let n = 0; n < 5; n += 1) month(game, []);
    expect(game.view().job.months).toBe(5);
    expect(allowed(game, NOTICED)).toBe(false);
    month(game, []);
    expect(allowed(game, NOTICED)).toBe(true);
  });

  test("[R-ACTIVITY-013] given a job held six months or more, when the draw lands, then the job's pay rises by the tuning's raise from the next month, standing rises, and the raise never comes twice", () => {
    const game = start({ content, scenario: "scenario.tunde", seed: seedFor(true) });
    const job = game.state.activity.job!;
    const base = figure(entryOf(job).pay!);
    const noticed = month(game, [slot(NOTICED)]);
    expect(noticed.events).toContainEqual(expect.objectContaining({ type: "activity/noticed", job, raised: true }));
    expect(gained(noticed, STANDING, NOTICED)).toBe(2);
    expect(noticed.lines.map((line) => line.key)).toContain("line.activity.raised");
    const raised = base + bp(base, content.tuning.activity.raiseBp);
    expect(credits(month(game, []), "salary").map((credit) => credit.amount)).toEqual([raised]);
    for (let n = 0; n < 6; n += 1) expect(month(game, [slot(NOTICED)]).events.filter((event) => event.type === "activity/noticed" && (event as unknown as { raised: boolean }).raised)).toEqual([]);
    expect(credits(month(game, []), "salary").map((credit) => credit.amount)).toEqual([raised]);
  });

  test("[R-ACTIVITY-013] given a job held six months or more, when the draw misses, then the pay stays and the month says nobody has said anything yet", () => {
    const game = start({ content, scenario: "scenario.tunde", seed: seedFor(false) });
    const job = game.state.activity.job!;
    const missed = month(game, [slot(NOTICED)]);
    expect(missed.events).toContainEqual(expect.objectContaining({ type: "activity/noticed", job, raised: false }));
    expect(missed.lines.map((line) => line.key)).toContain("line.activity.not-noticed");
    expect(credits(month(game, []), "salary").map((credit) => credit.amount)).toEqual([figure(entryOf(job).pay!)]);
  });

  test("[R-ACTIVITY-013] given two picks of one of the waiting months' acts in a month, when the month is played, then the second fails as a slot and the act counts once", () => {
    const game = start({ content, scenario: "scenario.zainab" });
    const played = month(game, [slot(OPEN_SOURCE), slot(OPEN_SOURCE)]);
    expect(played.events).toContainEqual({ type: "activity/slot-failed", slot: 1, activity: OPEN_SOURCE, param: null, why: "requirements" });
    expect(gained(played, NETWORK, OPEN_SOURCE)).toBe(2);
  });
});

describe("the nurse's certification", () => {
  /** Ngozi sits the exam and answers the three questions right or wrong as given. */
  function sit(answers: boolean[], seed?: string): { game: Game; marked: Accepted; paid: Accepted } {
    const game = start({ content, scenario: "scenario.ngozi", ...(seed === undefined ? {} : { seed }) });
    const paid = month(game, [slot(CERTIFY)]);
    const exam = content.setpiece["setpiece.nurse-exam"]!;
    let marked: Accepted | null = null;
    answers.forEach((right, index) => {
      const question = game.view().setpiece?.question;
      if (question === undefined || question === null) throw new Error("No question is open.");
      expect(question.id).toBe(exam.questions[index]?.id);
      const answers = exam.questions[index]!.answers;
      const pick = answers.find((answer) => (answer.score > 0) === right)!;
      marked = game.accept({ type: "setpiece/answer", question: question.id, answer: pick.id });
    });
    if (marked === null) throw new Error("Nothing was answered.");
    return { game, marked, paid };
  }

  test("[R-ACTIVITY-013] given the nurse with her licence and care 50, when she sits the exam, then the fee is taken and three questions open in order at the clinic's set piece", () => {
    const { game, paid } = sit([true, true, true]);
    const fee = figure(entryOf(CERTIFY).cost[0]!);
    expect(paid.events).toContainEqual(expect.objectContaining({ type: "wallet/debited", currency: "NGN", reason: "fee-test" }));
    expect(paid.events.filter((event) => event.type === "wallet/debited" && (event as unknown as Credit).reason === "fee-test").reduce((sum, event) => sum + (event as unknown as Credit).amount, 0)).toBe(fee);
    expect(game.view().setpiece).toBeNull();
    expect(entryOf(CERTIFY).counts).toContain(CARE_ROUTE);
  });

  test("[R-ACTIVITY-013] given two of three right, when the last answer is given, then it is a pass: the certificate is asked for and care rises by the quiz's figure", () => {
    const { game, marked } = sit([true, false, true]);
    expect(marked.events).toContainEqual(expect.objectContaining({ type: "activity/exam-marked", activity: CERTIFY, right: 2, asked: 3, passed: true }));
    expect(marked.lines.map((line) => line.key)).toContain("line.activity.exam-passed");
    expect(game.view().documents.find((paper) => paper.id === "document.nurse-certificate")?.state).toBe("pending");
    const care = entryOf(CERTIFY).exam!.effects.find((effect) => effect.type === "quality/add");
    expect(gained(marked, CARE, CERTIFY)).toBe(care?.type === "quality/add" ? care.amount : NaN);
    expect(allowed(game, CERTIFY)).toBe(false);
  });

  test("[R-ACTIVITY-013] given one of three right, when the last answer is given, then it is not a pass: no certificate, no care, and the exam can be sat again", () => {
    const { game, marked } = sit([true, false, false]);
    const before = qualityOf(game, CARE);
    expect(marked.events).toContainEqual(expect.objectContaining({ type: "activity/exam-marked", activity: CERTIFY, right: 1, asked: 3, passed: false }));
    expect(marked.lines.map((line) => line.key)).toContain("line.activity.exam-failed");
    expect(game.view().documents.find((paper) => paper.id === "document.nurse-certificate")).toBeUndefined();
    expect(gained(marked, CARE, CERTIFY)).toBe(0);
    expect(qualityOf(game, CARE)).toBe(before);
    expect(allowed(game, CERTIFY)).toBe(true);
  });

  test("[R-ACTIVITY-013] given the talk and the exam in one month, when the first opens its set piece, then the second fails with nothing paid", () => {
    const game = start({ content, scenario: "scenario.ngozi" });
    raiseTo(game, PORTFOLIO, 2);
    raiseTo(game, NETWORK, 40);
    const played = month(game, [slot(TALK), slot(CERTIFY)]);
    expect(played.events).toContainEqual({ type: "activity/slot-failed", slot: 1, activity: CERTIFY, param: null, why: "requirements" });
    expect(played.events.filter((event) => event.type === "wallet/debited" && (event as unknown as Credit).reason === "fee-test")).toEqual([]);
    expect(game.view().setpiece?.entry).toBe("setpiece.conference-talk");
  });
});

describe("a master's at home", () => {
  test("[R-ACTIVITY-013] given a bachelor's, when a master's at home is played twelve months, then the fees open as twelve instalments in the first month, the level is a master's after the twelfth, Canada's score rises by the education row, and it is not offered again", () => {
    const game = start({ content, scenario: "scenario.ada" });
    const opening = entryOf(MASTERS).onMonth?.find((step) => step.at === 1)?.effects.find((effect) => effect.type === "obligation/open");
    if (opening?.type !== "obligation/open" || typeof opening.principal !== "number") throw new Error("The master's opens no fees.");
    const table = content.points["points.canada"]!;
    const rowOf = (level: number) => table.education.find((row) => row.level === level)?.points ?? NaN;
    const before = pointsScore(readOf(game), CANADA);
    const first = month(game, [slot(MASTERS)]);
    const opened = first.events.find((event) => event.type === "obligation/opened") as unknown as { item: { entry: string; principal: number; monthsLeft: number } } | undefined;
    expect(opened?.item).toMatchObject({ entry: opening.obligation, principal: opening.principal, monthsLeft: content.obligation[opening.obligation]?.term });
    expect(content.obligation[opening.obligation]?.term).toBe(12);
    for (let played = 1; played < 11; played += 1) month(game, [slot(MASTERS)]);
    expect(qualityOf(game, EDU)).toBe(3);
    expect(game.state.activity.played[MASTERS]).toBe(11);
    month(game, [slot(MASTERS)]);
    expect(qualityOf(game, EDU)).toBe(4);
    expect(pointsScore(readOf(game), CANADA) - before).toBe(rowOf(4) - rowOf(3));
    expect(allowed(game, MASTERS)).toBe(false);
    expect(entryOf(MASTERS).counts).toContain(CANADA);
  });
});
