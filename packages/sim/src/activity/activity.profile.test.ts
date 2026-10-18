// The waiting months build the profile toward a route: docs/rules/activity.md R-ACTIVITY-013 (the
// developer's acts, the nurse's certification, a master's at home) and R-ACTIVITY-014 (side jobs pay by
// level). Each test plays a real life from content and reads its figures from content.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { bp } from "../engine/int";
import type { Accepted, ActivityEntry, BaseEvent, Id, Money, SlotPick } from "../engine/types";
import { pointsScore } from "../route/gates/points";
import { ALWAYS_GRANTED, offeredSeed } from "../testing/place.journey";
import { applyEffects, raiseSeed, readyLife, slot, toDecision, UK } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { readOf } from "../testing/read";

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
    // R-ACTIVITY-015: posting is an act done at once and runs once a month, so a second in the month is refused.
    const twice = game.accept({ type: "activity/now", activity: POSTS, param: null });
    expect(gained(twice, NETWORK, POSTS)).toBe(1);
    expect(game.expectRejected({ type: "activity/now", activity: POSTS, param: null }, "not-legal").code).toBe("not-legal");
    month(game, []);

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
    const game = start({ content, scenario: "scenario.tunde", seed: raiseSeed(content, true) });
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
    const game = start({ content, scenario: "scenario.tunde", seed: raiseSeed(content, false) });
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

describe("each act's outcome told the month it happens", () => {
  const MERGED = "line.activity.first-merged";
  const CONTRIBUTED = "line.activity.contributed";

  function keys(result: Accepted): string[] {
    return result.lines.map((line) => line.key);
  }

  test("[R-ACTIVITY-013] given a developer on open source, when three months are played, then the first is merged, the second adds a piece and the third is a quiet month of fixes; a month without it says neither", () => {
    const game = start({ content, scenario: "scenario.zainab" });
    const pieces = qualityOf(game, PORTFOLIO);
    const first = month(game, [slot(OPEN_SOURCE)]);
    expect(first.lines).toContainEqual(expect.objectContaining({ key: MERGED, tone: "good" }));
    expect(keys(first)).toContain(MERGED);
    expect(keys(first)).not.toContain(CONTRIBUTED);
    const second = month(game, [slot(OPEN_SOURCE)]);
    // The piece is told by the portfolio's own line, which the results tell as a piece.
    expect(second.lines).toContainEqual(expect.objectContaining({ key: "line.quality.gain", params: { quality: PORTFOLIO, points: 1, value: pieces + 1, source: OPEN_SOURCE } }));
    expect(keys(second)).not.toContain(MERGED);
    expect(keys(second)).not.toContain(CONTRIBUTED);
    const third = month(game, [slot(OPEN_SOURCE)]);
    expect(third.lines).toContainEqual(expect.objectContaining({ key: CONTRIBUTED, tone: "plain" }));
    expect(keys(third)).not.toContain(MERGED);
    expect(keys(month(game, [])).filter((key) => key === MERGED || key === CONTRIBUTED)).toEqual([]);
  });

  test("[R-ACTIVITY-013] given the raise lands, when the month is told, then its line carries what the pay goes up by a month and the pay after it", () => {
    const game = start({ content, scenario: "scenario.tunde", seed: raiseSeed(content, true) });
    const job = game.state.activity.job!;
    const base = figure(entryOf(job).pay!);
    const currency = entryOf(job).pay!.currency;
    const noticed = month(game, [slot(NOTICED)]);
    expect(noticed.lines).toContainEqual(
      expect.objectContaining({ key: "line.activity.raised", params: { job, amount: { currency, amount: base + bp(base, content.tuning.activity.raiseBp) }, rise: { currency, amount: bp(base, content.tuning.activity.raiseBp) } }, tone: "good" }),
    );
  });
});

describe("the raise in the view", () => {
  test("[R-ACTIVITY-013] given the raise lands, when the view is read, then the job carries its pay with the raise and the month it landed, the month of the report that told it", () => {
    const game = start({ content, scenario: "scenario.tunde", seed: raiseSeed(content, true) });
    const job = game.state.activity.job!;
    const base = figure(entryOf(job).pay!);
    expect(game.view().job.raise).toBeUndefined();
    month(game, [slot(NOTICED)]);
    // The month the raise landed is the month of the report that told it, as News stamps it.
    const landed = game.view().report?.month;
    expect(game.view().report?.lines.map((line) => line.key)).toContain("line.activity.raised");
    expect(game.view().job.raise).toEqual({ pay: { currency: entryOf(job).pay!.currency, amount: base + bp(base, content.tuning.activity.raiseBp) }, month: landed });
    month(game, []);
    expect(game.view().job.raise?.month).toBe(landed);
  });

  test("[R-ACTIVITY-013] given the draw misses, or the raised job is left, when the view is read, then the job carries no raise", () => {
    const missed = start({ content, scenario: "scenario.tunde", seed: raiseSeed(content, false) });
    month(missed, [slot(NOTICED)]);
    expect(missed.view().job.raise).toBeUndefined();
    const raised = start({ content, scenario: "scenario.tunde", seed: raiseSeed(content, true) });
    month(raised, [slot(NOTICED)]);
    expect(raised.view().job.raise).toBeDefined();
    raised.accept({ type: "activity/quit" });
    expect(raised.view().job.raise).toBeUndefined();
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

/** Ada with her papers, enough naira for a year of fees at home and the flight, and the pounds the visa asks for. */
function studentWithFees(): Game {
  const naira = 100;
  const pockets = { NGN: { bank: 6000000 * naira, cash: 1500000 * naira }, GBP: { bank: 40000 * naira, cash: 0 } };
  return readyLife(content, { seed: offeredSeed(content), tuning: ALWAYS_GRANTED, pockets });
}

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

  test("[R-ACTIVITY-013] given a master's at home three months in, when the character flies, then the course ends with a results line, its fees close, and nothing of it is charged after", () => {
    const game = studentWithFees();
    const fees = entryOf(MASTERS).onMonth?.flatMap((step) => step.effects).find((effect) => effect.type === "obligation/open");
    if (fees?.type !== "obligation/open") throw new Error("The master's opens no fees.");
    for (let n = 0; n < 3; n += 1) month(game, [slot(MASTERS)]);
    const open = () => Object.values(game.state.obligation.items).filter((item) => item.entry === fees.obligation);
    expect(open()).toHaveLength(1);
    toDecision(game);
    const flight = game.accept({ type: "route/depart", route: UK });
    expect(flight.events).toContainEqual(expect.objectContaining({ type: "activity/course-ended", activity: MASTERS }));
    expect(flight.lines).toContainEqual(expect.objectContaining({ key: "line.activity.course-ended", params: { activity: MASTERS } }));
    expect(flight.lines.filter((line) => line.key === "line.activity.course-ended")).toHaveLength(1);
    expect(open()).toEqual([]);
    for (let n = 0; n < 3; n += 1) {
      const after = month(game, []);
      const charged = after.events.filter((event) => event.type === "obligation/charged" && (event as unknown as { entry: string }).entry === fees.obligation);
      expect(charged).toEqual([]);
    }
  });

  test("[R-ACTIVITY-013] given no master's at home, or one already finished, when the character flies, then no course is said to end", () => {
    for (const months of [0, 12]) {
      const game = studentWithFees();
      for (let n = 0; n < months; n += 1) month(game, [slot(MASTERS)]);
      expect(qualityOf(game, EDU)).toBe(months === 12 ? 4 : 3);
      toDecision(game);
      const flight = game.accept({ type: "route/depart", route: UK });
      expect(flight.events.filter((event) => event.type === "activity/course-ended")).toEqual([]);
      expect(flight.lines.filter((line) => line.key === "line.activity.course-ended")).toEqual([]);
    }
  });
});
