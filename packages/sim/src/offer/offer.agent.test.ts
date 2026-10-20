// The agents: advice:agent-kind-drawn-on-offer, advice:scams-show-their-tells, advice:agents-never-read-money, advice:agent-loss-is-the-fee, advice:bad-news-told-straight, advice:advisers-are-invented-people and advice:free-ways-pointed-first, played through the
// harness with the real content.
// activity:now-acts-and-month-acts: a now-act (an application, a paper, a visit) is refused in a slot, so each probe sends one as
// activity/now, and an application checked as applying is read in the month it is sent.
import { content, text } from "@japacity/content";
import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import { check } from "../engine/check";
import type { Accepted, BaseEvent, Content, Id, OfferEntry, OfferState, ReportLine, Requirement } from "../engine/types";
import { hiddenPaths } from "../engine/view";
import { applyEffects, answerFirst, readyLife, toApplied, toKnown } from "../testing/route.journey";
import type { Game } from "../testing/play";
import type { AgentKind } from "./offer.agent";
import {
  agentProblems,
  agentReadsMoney,
  carriedTells,
  feeRange,
  kindAt,
  kindOf,
  KIND_TERM,
  LOOK_FINDS,
  LOOKS,
  PAPERS,
  PROMISE,
} from "./offer.agent";
import type { OfferEvent } from "./offer.events";
import { answerScore } from "../setpiece/setpiece.logic";
import { cash, naira } from "../testing/read";
import { FEET, GULF_ROUTE, NETWORK, READY, STOP, TO_STOP, UK_ROUTE } from "../testing/ids";

const OFFICE: Id<"offer"> = "offer.agent-office";
const TO_OFFICE: Id<"activity"> = "activity.see-agent-office";
const advice = content.tuning.advice;
const stop = content.offer[STOP]!;

/** The graduate with its papers, past the first chapter (a job, a month's pay, the UK route known), and the Gulf route heard. */
function pastChapterOne(seed: string, network = advice.networkToAsk, siblings?: number): Game {
  const alone = (base: Content): Content => (siblings === undefined ? base : { ...base, scenario: { ...base.scenario, [READY]: { ...base.scenario[READY]!, siblings } } });
  const game = readyLife(content, { quiet: true, seed, qualities: { [NETWORK]: network }, change: alone });
  applyEffects(game, [{ type: "activity/start-job", job: "activity.job-teacher" }]);
  toKnown(game);
  for (let month = 0; month < 6 && !game.state.chapter.done.includes(FEET); month += 1) game.endTurn();
  if (!game.state.chapter.done.includes(FEET)) throw new Error("The first chapter did not close.");
  applyEffects(game, [{ type: "route/hear", route: GULF_ROUTE, via: "test" }]);
  if (game.state.route[GULF_ROUTE]?.state !== "heard") throw new Error("The Gulf route was not heard.");
  return game;
}

/**
 * activity:now-acts-and-month-acts: going to the stop or up to the office is an act done at once, so the agent is at the
 * table in the month it is sent, not as the month ends.
 */
function openAt(game: Game, activity: Id<"activity"> = TO_STOP): OfferState {
  game.accept({ type: "activity/now", activity, param: GULF_ROUTE });
  const entry = activity === TO_STOP ? STOP : OFFICE;
  const item = Object.values(game.state.offer.items).find((candidate) => candidate.entry === entry);
  if (item === undefined) throw new Error(`${entry} did not open.`);
  return item;
}

/** The first seed whose agent at the stop is of the kind wanted. */
function agentOfKind(kind: AgentKind, network = advice.networkToAsk): { game: Game; item: OfferState } {
  for (let n = 0; n < 80; n += 1) {
    const game = pastChapterOne(`agent-${String(n)}`, network);
    const item = openAt(game);
    if (kindOf(item) === kind) return { game, item };
  }
  throw new Error(`No seed gave a ${kind}.`);
}

function eventsOf<T extends OfferEvent["type"]>(result: Accepted, type: T): Extract<OfferEvent, { type: T }>[] {
  return result.events.filter((event: BaseEvent) => event.type === type) as unknown as Extract<OfferEvent, { type: T }>[];
}

describe("who the agent is", () => {
  test("[advice:agent-kind-drawn-on-offer] [advice:chaser-runs-around-cheaper] given every draw out of 10000, when the kind is read, then fixers, chasers, overpromisers and scammers come at exactly the tuning's shares", () => {
    const counts: Record<AgentKind, number> = { fixer: 0, chaser: 0, overpromiser: 0, scammer: 0 };
    for (let draw = 0; draw < 10000; draw += 1) counts[kindAt(draw, advice.agentKindsBp)] += 1;
    expect(counts).toEqual(advice.agentKindsBp);
    const { fixer, chaser, overpromiser } = advice.agentKindsBp;
    expect(kindAt(fixer - 1, advice.agentKindsBp)).toBe("fixer");
    expect(kindAt(fixer, advice.agentKindsBp)).toBe("chaser");
    expect(kindAt(fixer + chaser, advice.agentKindsBp)).toBe("overpromiser");
    expect(kindAt(fixer + chaser + overpromiser, advice.agentKindsBp)).toBe("scammer");
  });

  test.prop([fc.integer({ min: 0, max: 999 })], { numRuns: 12 })(
    "[advice:agent-kind-drawn-on-offer] [advice:scams-show-their-tells] given any seed, when the agent at the stop opens, then his fee is in his kind's range in whole thousands, he carries his kind's tells, one shows at once, and the view never carries the kind",
    (n) => {
      const game = pastChapterOne(`prop-${String(n)}`);
      const item = openAt(game);
      const kind = kindOf(item);
      const fee = item.terms["fee"] as number;
      const [min, max] = feeRange(kind, advice);
      expect(fee).toBeGreaterThanOrEqual(min);
      expect(fee).toBeLessThanOrEqual(max);
      expect((fee - min) % 100000).toBe(0);
      const carried = carriedTells(stop, kind, advice);
      expect(item.signs).toEqual(carried.slice(0, 1));
      expect(item.secret.fraud).toBe(kind === "scammer");
      const shown = game.view().offers.find((offer) => offer.id === item.id)!;
      expect(shown.terms[KIND_TERM]).toBeUndefined();
      expect(hiddenPaths(game.view())).toEqual([]);
    },
  );

  test("[advice:agent-kind-drawn-on-offer] given 240 seeds, when the agent at the stop opens for each, then each kind comes near its share", () => {
    const counts: Record<AgentKind, number> = { fixer: 0, chaser: 0, overpromiser: 0, scammer: 0 };
    const seeds = 240;
    for (let n = 0; n < seeds; n += 1) counts[kindOf(openAt(pastChapterOne(`share-${String(n)}`)))] += 1;
    for (const kind of ["fixer", "chaser", "overpromiser", "scammer"] as const) {
      expect(Math.abs(counts[kind] * 10000 - advice.agentKindsBp[kind] * seeds)).toBeLessThan(800 * seeds);
    }
  });

  test("[advice:agent-kind-drawn-on-offer] given the fee ranges, when they are compared, then every two overlap, so the fee never tells the kind", () => {
    const ranges = Object.values(advice.fees);
    for (const [aMin, aMax] of ranges) for (const [bMin, bMax] of ranges) expect(aMin <= bMax && bMin <= aMax).toBe(true);
    expect(advice.fees.scammer[1]).toBeGreaterThanOrEqual(advice.fees.fixer[1]);
  });

  test("[advice:advisers-are-invented-people] given the desk in the agent's office, when he opens on any seed, then he is a fixer named Ameh; the men at the stop are three faces from the name pool", () => {
    for (let n = 0; n < 6; n += 1) {
      const item = openAt(pastChapterOne(`desk-${String(n)}`), TO_OFFICE);
      expect(kindOf(item)).toBe("fixer");
      expect(text[`${String(item.terms["agent"])}.name`]).toBe("Ameh");
    }
    expect([1, 2, 3].map((who) => text[`${STOP}.who.${String(who)}.name`])).toEqual(["Efosa", "Timi", "Nsikak"]);
    const stagedAt = (id: string) => Object.values(content.place).filter((place) => place.stages.includes(id as never)).map((place) => place.id);
    expect(stagedAt(STOP)).toEqual(["place.ojuelegba"]);
    expect(stagedAt(OFFICE)).toEqual(["place.agent-office"]);
    expect(stagedAt("activity.see-adviser")).toEqual(["place.yaba"]);
    expect(stagedAt("activity.look-into-route")).toEqual(["place.yaba"]);
  });
});

describe("the tells", () => {
  test("[advice:scams-show-their-tells] given the entries, when each kind's tells are read, then a scammer carries at least the tuning's count, an overpromiser at least his, a fixer at most one, and every tell is in content's list", () => {
    expect(carriedTells(stop, "scammer", advice).length).toBeGreaterThanOrEqual(advice.scamTells);
    expect(carriedTells(stop, "overpromiser", advice).length).toBeGreaterThanOrEqual(advice.overpromiseTells);
    expect(carriedTells(stop, "fixer", advice).length).toBeLessThanOrEqual(1);
    expect(stop.signs.map((sign) => sign.key).sort()).toEqual(["cash-only", "guarantee", "holds-passport", "no-licence", "no-office", "no-passport", "pay-today", "price-low"]);
    expect(agentProblems(content)).toEqual([]);
  });

  test("[advice:scams-show-their-tells] given a scammer, when the three looks are made, then each costs no slot and no money, finds every tell it would find, and he shows at least two tells before any fee", () => {
    const { game, item } = agentOfKind("scammer");
    const before = { cash: cash(game), month: game.state.turn.month, banked: game.state.turn.banked };
    for (const look of LOOKS) {
      const result = game.accept({ type: "offer/choose", offer: item.id, choice: look });
      const found = eventsOf(result, "offer/looked")[0]!.found;
      expect(found).toEqual(carriedTells(stop, "scammer", advice).filter((key) => LOOK_FINDS[look].includes(key)));
    }
    const after = game.state.offer.items[item.id]!;
    expect(after.signs.filter((key) => !LOOKS.includes(key as never))).toEqual(expect.arrayContaining(carriedTells(stop, "scammer", advice)));
    expect(after.signs.filter((key) => !LOOKS.includes(key as never)).length).toBeGreaterThanOrEqual(advice.scamTells);
    expect({ cash: cash(game), month: game.state.turn.month, banked: game.state.turn.banked }).toEqual(before);
    // A look done once is done.
    game.expectRejected({ type: "offer/choose", offer: item.id, choice: "look-office" }, "not-legal");
  });

  test("[advice:scams-show-their-tells] given a fixer, when every look is made, then he shows at most one tell", () => {
    const { game, item } = agentOfKind("fixer");
    for (const look of LOOKS) game.accept({ type: "offer/choose", offer: item.id, choice: look });
    expect(game.state.offer.items[item.id]!.signs.filter((key) => !LOOKS.includes(key as never)).length).toBeLessThanOrEqual(1);
  });

  test("[advice:scams-show-their-tells] given no bond and a network under the bar, when the name look is tried, then it is not legal; the office look still is", () => {
    for (let n = 0; n < 4; n += 1) {
      const game = pastChapterOne(`alone-${String(n)}`, 0, 0);
      expect(game.state.quality[NETWORK]).toBeLessThan(advice.networkToAsk);
      expect(Object.keys(game.state.people.bonds)).toEqual([]);
      const item = openAt(game);
      game.expectRejected({ type: "offer/choose", offer: item.id, choice: "look-name" }, "not-legal");
      game.accept({ type: "offer/choose", offer: item.id, choice: "look-office" });
    }
  });
});

describe("what the agent's appearance reads", () => {
  test("[advice:agents-never-read-money] given the agent entries, when the content check reads them, then none reads money; a planted money condition, inside not or any, fails it", () => {
    expect(Object.values(content.offer).filter(agentReadsMoney)).toEqual([]);
    const planted = (when: OfferEntry["when"]): Content => ({ ...content, offer: { ...content.offer, [STOP]: { ...stop, when } } });
    const money = { type: "money/min", currency: "NGN", amount: 1 } as const;
    expect(agentProblems(planted([money]))).toEqual([`${STOP}: an agent's when reads money (advice:agents-never-read-money).`, `${STOP}: an agent's when reads money/min (advice:agents-never-read-money).`, `${STOP}: opens before ${FEET} is done (advice:free-ways-pointed-first).`]);
    expect(agentReadsMoney({ ...stop, when: [{ type: "not", of: money }] })).toBe(true);
    expect(agentReadsMoney({ ...stop, when: [{ type: "any", of: [{ type: "wallet/total", flow: "out", reason: "remit", currency: "GBP", amount: 1 }] }] })).toBe(true);
    expect(agentProblems(planted([...stop.when, { type: "quality/min", quality: NETWORK, value: 1 }]))).toEqual([`${STOP}: an agent's when reads quality/min (advice:agents-never-read-money).`]);
  });

  test("[advice:free-ways-pointed-first] given a life before the first chapter is done, when the agent is sought, then the act is not legal and opening the offer opens nothing", () => {
    const game = readyLife(content, { quiet: true });
    applyEffects(game, [{ type: "route/hear", route: GULF_ROUTE, via: "test" }]);
    game.expectRejected({ type: "activity/now", activity: TO_STOP, param: GULF_ROUTE }, "not-legal");
    applyEffects(game, [{ type: "offer/open", offer: STOP }]);
    expect(Object.values(game.state.offer.items).filter((item) => item.entry === STOP)).toEqual([]);
    expect(stop.when).toContainEqual({ type: "chapter/done", chapter: FEET });
    expect(text["chapter.find-your-feet.item.known.nudge"]).toMatch(/official page/);
    expect(text["chapter.find-your-feet.item.known.nudge"]).not.toMatch(/agent|adviser/i);
  });
});

describe("paying the agent", () => {
  test("[advice:four-ways-to-learn-route] [advice:agent-kind-drawn-on-offer] [wallet:money-lands-as-in-lagos] given a fixer and a paper being made, when he is paid, then the fee, over the line for cash, leaves the bank first, the route is known through him, and the paper comes the fixer's months sooner", () => {
    const { game, item } = agentOfKind("fixer");
    applyEffects(game, [{ type: "document/request", document: "document.medical" }]);
    const due = game.state.document["document.medical"]!.readyMonth!;
    const before = { naira: naira(game), bank: game.state.wallet.pockets.NGN.bank };
    const fee = item.terms["fee"] as number;
    expect(fee).toBeGreaterThan(content.tuning.wallet.cashUpTo);
    const result = game.accept({ type: "offer/choose", offer: item.id, choice: "take" });
    expect(before.naira - naira(game)).toBe(fee);
    expect(before.bank - game.state.wallet.pockets.NGN.bank).toBe(Math.min(fee, before.bank));
    expect(game.state.route[GULF_ROUTE]?.state).toBe("known");
    expect(result.lines.find((line) => line.key === "line.route.looked-into-agent")?.params).toEqual({ route: GULF_ROUTE });
    expect(game.state.document["document.medical"]!.readyMonth).toBe(Math.max(game.state.turn.month + 1, due - advice.fixerMonths));
    expect(eventsOf(result, "offer/agent-paid")[0]).toMatchObject({ kind: "fixer", paper: "document.medical" });
  });

  test("[advice:agent-kind-drawn-on-offer] given an overpromiser, when he is paid, then nothing moves, his promise waits, and when its month comes the report says nothing moved", () => {
    const { game, item } = agentOfKind("overpromiser");
    applyEffects(game, [{ type: "document/request", document: "document.medical" }]);
    const due = game.state.document["document.medical"]!.readyMonth;
    game.accept({ type: "offer/choose", offer: item.id, choice: "take" });
    expect(game.state.document["document.medical"]!.readyMonth).toBe(due);
    const promise = Object.values(game.state.offer.items).find((candidate) => candidate.entry === PROMISE)!;
    expect(promise.terms["agent"]).toBe(item.terms["agent"]);
    // Waiting changes nothing and keeps the promise open.
    const waited = game.accept({ type: "offer/choose", offer: promise.id, choice: "wait" });
    expect(waited.events.filter((event) => event.type.startsWith("offer/"))).toEqual([]);
    expect(game.state.offer.items[promise.id]).toBeDefined();
    const lines: ReportLine[] = [];
    for (let month = 0; month < 4 && game.state.offer.items[promise.id] !== undefined; month += 1) lines.push(...game.endTurn().lines);
    expect(lines.find((line) => line.key === "line.offer.agent-promise-broken")?.params).toEqual({ agent: item.terms["agent"], month: promise.expiresMonth });
  });

  test("[advice:agent-loss-is-the-fee] given cash one naira short of the fee plus the floor, and then exactly that, when the agent is paid, then the first is refused and lapses into a decline, and the second is taken", () => {
    const { game, item } = agentOfKind("fixer");
    const fee = item.terms["fee"] as number;
    // The floor is kept in cash and bank together (decision 0014): empty the bank so cash is the only naira.
    applyEffects(game, [{ type: "money/take", currency: "NGN", pocket: "bank", amount: game.view().pockets.NGN.bank, reason: "social" }]);
    const set = (amount: number) => applyEffects(game, [{ type: "money/take", currency: "NGN", pocket: "cash", amount: cash(game) - amount, reason: "social" }]);
    set(fee + advice.floorNaira - 100);
    expect(game.view().offers.find((offer) => offer.id === item.id)!.choices.find((choice) => choice.id === "take")!.allowed).toBe(false);
    game.expectRejected({ type: "offer/choose", offer: item.id, choice: "take" }, "cannot-afford");
    applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "cash", amount: 100, reason: "gift" }]);
    game.accept({ type: "offer/choose", offer: item.id, choice: "take" });
    expect(cash(game)).toBe(advice.floorNaira);
    expect(stop.onExpire).toBe("decline");
  });

  test("[advice:bad-news-told-straight] given a scammer whose tells were seen, when he is paid, then the report names him, says the fee is gone, and names every tell seen; he offers fake papers", () => {
    const { game, item } = agentOfKind("scammer");
    game.accept({ type: "offer/choose", offer: item.id, choice: "look-office" });
    const seen = game.state.offer.items[item.id]!.signs.filter((key) => !LOOKS.includes(key as never));
    const result = game.accept({ type: "offer/choose", offer: item.id, choice: "take" });
    const scam = result.lines.find((line) => line.key === "line.offer.agent-scam");
    expect(scam?.params).toEqual({ agent: item.terms["agent"], amount: { currency: "NGN", amount: item.terms["fee"] } });
    expect(scam?.tone).toBe("bad");
    expect(result.lines.filter((line) => line.key === "line.offer.agent-scam-tell").map((line) => line.params["tell"])).toEqual(seen.map((key) => `advice.tell.${key}`));
    expect(text["line.offer.agent-scam"]).toBe("{agent} was a scam. {amount} gone.");
    expect(seen.every((key) => text[`advice.tell.${key}.name`] !== undefined)).toBe(true);
    expect(game.state.route[GULF_ROUTE]?.state).toBe("heard");
    expect(Object.values(game.state.offer.items).some((candidate) => candidate.entry === PAPERS)).toBe(true);
  });
});

describe("fake papers", () => {
  /** A ready life without a transcript, its fake bought from the scammer's papers offer. */
  function withFakeTranscript(): Game {
    const game = readyLife(content, { quiet: true, documents: [
      { document: "document.passport", monthsLeft: 60, value: null },
      { document: "document.english-test", monthsLeft: 24, value: 70 },
      { document: "document.tb-certificate", monthsLeft: 24, value: null },
    ] });
    applyEffects(game, [{ type: "offer/open", offer: PAPERS }]);
    const papers = Object.values(game.state.offer.items).find((item) => item.entry === PAPERS)!;
    const before = naira(game);
    game.accept({ type: "offer/choose", offer: papers.id, choice: "transcript" });
    expect(before - naira(game)).toBe(advice.fakePapersFee);
    return game;
  }

  test("[advice:agent-loss-is-the-fee] given a fake transcript used for the UK route, when the application is sent and decided, then the interview opens as usual and the visa is refused for the agent's papers, with no ban", () => {
    const game = withFakeTranscript();
    expect(game.state.document["document.transcript"]).toMatchObject({ state: "held", genuine: false });
    toApplied(game);
    expect(game.view().setpiece).not.toBeNull();
    answerFirst(game);
    game.endTurn();
    expect(game.state.route[UK_ROUTE]).toMatchObject({ state: "known", bannedUntil: null });
    expect(game.state.route[UK_ROUTE]?.lastRefusal?.reasons[0]).toBe("agent");
  });

  test("[advice:agent-loss-is-the-fee] given a fake transcript, when the interview's questions are read, then the papers question is asked and every answer scores below zero; with a genuine transcript it is never asked", () => {
    const interview = content.setpiece["setpiece.credibility-interview"]!;
    const papers = interview.questions.find((question) => question.id === "papers")!;
    const faked = withFakeTranscript();
    const judgeFaked = (requirement: Requirement) => check({ state: faked.state, world: faked.world(), content }, requirement);
    expect(papers.when.every((requirement) => judgeFaked(requirement).met)).toBe(true);
    for (const answer of papers.answers) expect(answerScore(answer, judgeFaked)).toBeLessThan(0);
    const honest = readyLife(content, { quiet: true });
    const judgeHonest = (requirement: Requirement) => check({ state: honest.state, world: honest.world(), content }, requirement);
    expect(honest.state.document["document.transcript"]?.state).toBe("held");
    expect(papers.when.every((requirement) => judgeHonest(requirement).met)).toBe(false);
  });

  test("[advice:agent-loss-is-the-fee] given a fake never used, when the genuine paper is requested and issued, then the record is genuine; once used, the issued paper keeps the mark", () => {
    const unused = withFakeTranscript();
    applyEffects(unused, [{ type: "document/request", document: "document.transcript" }]);
    for (let month = 0; month < 6 && unused.state.document["document.transcript"]!.readyMonth !== null; month += 1) unused.endTurn();
    expect(unused.state.document["document.transcript"]!.genuine).toBeUndefined();

    const used = withFakeTranscript();
    toApplied(used);
    answerFirst(used);
    used.endTurn();
    applyEffects(used, [{ type: "document/request", document: "document.transcript" }]);
    for (let month = 0; month < 6 && used.state.document["document.transcript"]!.readyMonth !== null; month += 1) used.endTurn();
    expect(used.state.document["document.transcript"]).toMatchObject({ state: "held", genuine: false });
  });
});
