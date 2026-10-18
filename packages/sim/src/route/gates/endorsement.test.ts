// R-ACTIVITY-015: a now-act (an application, a paper, a visit) is refused in a slot, so each probe sends one as
// activity/now, and an application checked as applying is read in the month it is sent.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../../engine/check";
import { checkInvariants } from "../../engine/invariants";
import type { ActivityEntry, Content, Id, RouteEntry, RouteState } from "../../engine/types";
import { ALWAYS_GRANTED } from "../../testing/place.journey";
import type { Game } from "../../testing/play";
import { readOf, routeKeys } from "../../testing/read";
import { applyEffects, draw, readyLife, slot } from "../../testing/route.journey";
import type { LifeOptions } from "../../testing/route.journey";
import { refusalChanceBp } from "../route.logic";
import { COOLED, endorsementChanceBp } from "./endorsement";
import { GATES } from "./index";
import { TALENT, UK_ROUTE } from "../../testing/ids";

const LOOK_INTO: Id<"activity"> = "activity.look-into-route";
const APPLY_ENDORSEMENT: Id<"activity"> = "activity.apply-endorsement";
const APPLY_VISA: Id<"activity"> = "activity.apply-uk-talent";

const entry = content.route[TALENT]!;
const block = entry.endorsement!;
const ENDORSEMENT = block.document;
const startVar = (id: Id<"var">): number => content.var[id]!.start;
/** The bars of R-ENDORSE-001, each exactly met. */
const AT_BARS = { "quality.tech": 75, "quality.portfolio": 3, "quality.network": 50 };

/** Content whose talent route has the endorsement block changed. */
function withBlock(change: Partial<NonNullable<RouteEntry["endorsement"]>>): (used: Content) => Content {
  return (used) => ({ ...used, route: { ...used.route, [TALENT]: { ...used.route[TALENT]!, endorsement: { ...block, ...change } } } });
}
const ALWAYS_ENDORSED = withBlock({ baseBp: 10000, capBp: 10000 });
const NEVER_ENDORSED = withBlock({ baseBp: 0, perPortfolioBp: 0, perNetworkBp: 0 });

/** Content whose apply-endorsement also reads the cooldown step: the one requirement the gate asks content for. */
function withCooldownStep(used: Content): Content {
  const activity: ActivityEntry = used.activity[APPLY_ENDORSEMENT]!;
  const requires = [...activity.requires, { type: "route/gate-step" as const, route: TALENT, step: COOLED }];
  return { ...used, activity: { ...used.activity, [APPLY_ENDORSEMENT]: { ...activity, requires } } };
}

/**
 * Ada, who holds no job, so her tech and network stay where they are set. The talent route's window is held open
 * unless a test sets it: the world's own pool may close it in any world (`news.uk-talent-body-closes`, R-DIRECTOR-003),
 * and with the one-chance story in the pool (wallet.md R-WALLET-019) it does so in the test world's first months.
 */
function talentLife(options: LifeOptions = {}): Game {
  const vars = (tick: number) => ({ [entry.window!]: 2, ...options.vars?.(tick) });
  return readyLife(content, { quiet: true, ...options, vars, qualities: { ...AT_BARS, ...options.qualities } });
}

function talent(game: Game): RouteState {
  return game.state.route[TALENT]!;
}

function refusedMonth(game: Game): number | null {
  const held = talent(game).gate;
  if (held?.gate !== "endorsement") throw new Error("The talent route holds no endorsement gate state.");
  return held.endorsementRefusedMonth;
}

/** The UK master's is heard of by month 3, which the look-into slot needs; then talk of the talent route at a meetup, and a look. */
function toKnown(game: Game): void {
  for (let month = 0; month < 4 && game.state.route[UK_ROUTE]!.state === "unknown"; month += 1) game.endTurn();
  applyEffects(game, [{ type: "route/hear", route: TALENT, via: "meetup" }]);
  expect(talent(game).state).toBe("heard");
  game.endTurn([slot(LOOK_INTO, TALENT)]);
  expect(talent(game).state).toBe("known");
}

/**
 * Asks for the endorsement and plays to the month before it is issued. Returns that month. R-ACTIVITY-015: the request is sent at once and the month left open, so the letter is never issued in the month it
 * is asked for before the test can read it.
 */
function toRequested(game: Game): number {
  game.accept({ type: "activity/now", activity: APPLY_ENDORSEMENT, param: null });
  const ready = game.state.document[ENDORSEMENT]?.readyMonth;
  if (ready === undefined || ready === null) throw new Error("The endorsement was not requested.");
  while (game.state.turn.month < ready - 1) game.endTurn();
  return ready;
}

/** From a fresh life to the endorsement issued and judged. Returns the turn's route lines. */
function toIssued(game: Game): string[] {
  toKnown(game);
  toRequested(game);
  return routeKeys(game.endTurn().lines);
}

describe("the endorsement gate", () => {
  describe("asking for the endorsement", () => {
    test("[R-ENDORSE-001] given the route known and every bar met, when the endorsement is asked for, then the fee is paid in pounds as a document fee and the letter is on its way", () => {
      const game = talentLife();
      toKnown(game);
      const before = game.state.wallet.pockets.GBP.bank;
      game.endTurn([slot(APPLY_ENDORSEMENT)]);
      const fee = startVar(block.feeVar);
      expect(game.state.wallet.pockets.GBP.bank).toBe(before - fee);
      expect(game.state.wallet.totals.out["fee-document"]).toEqual({ GBP: fee });
      const ready = game.state.document[ENDORSEMENT]!.readyMonth!;
      const [least, most] = content.document[ENDORSEMENT]!.wait;
      expect(ready - game.state.turn.month).toBeGreaterThanOrEqual(least);
      expect(ready - game.state.turn.month).toBeLessThanOrEqual(most);
    });

    test.each([
      ["quality.tech", 74],
      ["quality.portfolio", 2],
      ["quality.network", 49],
    ] as const)("[R-ENDORSE-001] given %s one under its bar at %i, when the endorsement is asked for, then the turn is rejected", (quality, value) => {
      const game = talentLife({ qualities: { [quality]: value } });
      toKnown(game);
      expect(game.expectRejected({ type: "activity/now", activity: APPLY_ENDORSEMENT, param: null }, "not-legal").code).toBe("not-legal");
    });

    test("[R-ENDORSE-001] given an endorsement already being made, when it is asked for again, then the turn is rejected", () => {
      const game = talentLife();
      toKnown(game);
      game.endTurn([slot(APPLY_ENDORSEMENT)]);
      expect(game.expectRejected({ type: "activity/now", activity: APPLY_ENDORSEMENT, param: null }, "not-legal").code).toBe("not-legal");
    });

    test("[R-ENDORSE-001] given the window closed, when the endorsement is asked for, then the turn is rejected", () => {
      let closed = false;
      const game = talentLife({ vars: () => (closed ? { [entry.window!]: 0 } : {}) });
      toKnown(game);
      closed = true;
      expect(game.expectRejected({ type: "activity/now", activity: APPLY_ENDORSEMENT, param: null }, "not-legal").code).toBe("not-legal");
    });
  });

  describe("the endorsing body's answer", () => {
    test.each([
      [3, 50, 2500],
      [4, 50, 3200],
      [3, 51, 2510],
      [2, 40, 2500],
      [10, 100, 7900],
    ])("[R-ENDORSE-002] given portfolio %i and network %i, when the chance is worked out, then it is %i basis points", (portfolio, network, chance) => {
      const game = talentLife({ qualities: { "quality.portfolio": portfolio, "quality.network": network } });
      expect(endorsementChanceBp(readOf(game), TALENT)).toBe(chance);
    });

    test("[R-ENDORSE-002] given a cap below the sum, when the chance is worked out, then it stops at the cap, and one point less is under it", () => {
      const capped = withBlock({ capBp: 3210 });
      const over = talentLife({ change: capped, qualities: { "quality.portfolio": 4, "quality.network": 52 } });
      expect(endorsementChanceBp(readOf(over), TALENT)).toBe(3210);
      const at = talentLife({ change: capped, qualities: { "quality.portfolio": 4, "quality.network": 51 } });
      expect(endorsementChanceBp(readOf(at), TALENT)).toBe(3210);
      const under = talentLife({ change: capped, qualities: { "quality.portfolio": 4, "quality.network": 50 } });
      expect(endorsementChanceBp(readOf(under), TALENT)).toBe(3200);
    });

    test.each(["seed-1", "seed-2", "seed-3", "seed-4", "seed-5", "seed-6"])(
      "[R-ENDORSE-002] given %s, when the endorsement is issued, then one draw on visa decides it against the chance",
      (seed) => {
        // Tech above its bar: an event of the month can take a point or two off it.
        const game = talentLife({ seed, qualities: { "quality.tech": 85, "quality.portfolio": 5, "quality.network": 70 } });
        toKnown(game);
        toRequested(game);
        const n = game.state.draws.visa ?? 0;
        expect(n).toBe(0);
        const chance = endorsementChanceBp(readOf(game), TALENT);
        const keys = routeKeys(game.endTurn().lines);
        expect(game.state.draws.visa).toBe(1);
        const endorsed = draw(seed, "visa", n, 10000) < chance;
        expect(game.state.document[ENDORSEMENT] !== undefined).toBe(endorsed);
        expect(keys.includes("line.route.endorsement-refused")).toBe(!endorsed);
        expect(refusedMonth(game)).toBe(endorsed ? null : game.state.turn.month);
      },
    );

    test("[R-ENDORSE-002] given an endorsement that is sure to pass, when it is issued, then it is held for its months and nothing is refused", () => {
      const game = talentLife({ change: ALWAYS_ENDORSED });
      toIssued(game);
      const held = game.state.document[ENDORSEMENT];
      expect(held?.state).toBe("held");
      expect(held?.expiresMonth).toBe(game.state.turn.month + content.document[ENDORSEMENT]!.validMonths!);
      expect(refusedMonth(game)).toBeNull();
      expect(talent(game).state).toBe("known");
    });

    test("[R-ENDORSE-002] given an endorsement that is sure to fail, when it is issued, then it is voided at once and the route records the refusal's month with its line", () => {
      const game = talentLife({ change: NEVER_ENDORSED });
      const keys = toIssued(game);
      expect(game.state.document[ENDORSEMENT]).toBeUndefined();
      expect(refusedMonth(game)).toBe(game.state.turn.month);
      expect(keys).toContain("line.route.endorsement-refused");
      expect(talent(game).state).toBe("known");
      expect(checkInvariants(game.state, game.content)).toEqual([]);
    });

    test("[R-ENDORSE-002] given a refused endorsement, when months pass, then the cooled step is not reached for the cooldown's months and is reached after", () => {
      const game = talentLife({ change: NEVER_ENDORSED });
      toIssued(game);
      const refused = game.state.turn.month;
      const cooled = (): boolean => check(readOf(game), { type: "route/gate-step", route: TALENT, step: COOLED }).met;
      while (game.state.turn.month < refused + block.cooldown - 1) {
        expect(cooled()).toBe(false);
        game.endTurn();
      }
      expect(cooled()).toBe(false);
      game.endTurn();
      expect(cooled()).toBe(true);
    });

    test("[R-ENDORSE-002] given apply-endorsement reading the cooled step, when it is sent in the cooldown's last month it is rejected, and the month after it is accepted: six months with no new request", () => {
      // Tech starts above the bar so an ordinary offer taking two points does not unmake the step while the months pass.
      const game = talentLife({ change: (used) => withCooldownStep(NEVER_ENDORSED(used)), qualities: { "quality.tech": 85 } });
      toIssued(game);
      const refused = game.state.turn.month;
      while (game.state.turn.month < refused + block.cooldown - 1) game.endTurn();
      expect(game.expectRejected({ type: "activity/now", activity: APPLY_ENDORSEMENT, param: null }, "not-legal").code).toBe("not-legal");
      game.endTurn();
      game.endTurn([slot(APPLY_ENDORSEMENT)]);
      expect(game.state.document[ENDORSEMENT]?.state).toBe("pending");
      expect(game.state.turn.month - refused).toBe(block.cooldown + 1);
    });
  });

  describe("the visa", () => {
    test("[R-ENDORSE-003] given the endorsement held with the passport and TB certificate, when the visa is applied for, then the fee and five years of surcharge are paid and the route is applying", () => {
      const game = talentLife({ change: ALWAYS_ENDORSED });
      toIssued(game);
      const before = game.state.wallet.pockets.GBP.bank;
      // R-ACTIVITY-015: the application is sent at once, so the route is applying in the month it is sent.
      game.accept({ type: "activity/now", activity: APPLY_VISA, param: null });
      expect(talent(game).state).toBe("applying");
      const surcharge = startVar("var.uk-surcharge-year");
      expect(game.state.wallet.totals.out["fee-visa"]).toEqual({ GBP: startVar("var.uk-talent-visa-fee") });
      expect(game.state.wallet.totals.out["fee-surcharge"]).toEqual({ GBP: 5 * surcharge });
      expect(game.state.wallet.pockets.GBP.bank).toBe(before - startVar("var.uk-talent-visa-fee") - 5 * surcharge);
    });

    test("[R-ENDORSE-003] given no endorsement held, when an application is sent to the route as a slot would, then nothing happens; with it held, it goes", () => {
      const game = talentLife({ change: ALWAYS_ENDORSED });
      toKnown(game);
      const before = talent(game);
      applyEffects(game, [{ type: "route/apply", route: TALENT }]);
      expect(talent(game)).toEqual(before);
      toRequested(game);
      game.endTurn();
      applyEffects(game, [{ type: "route/apply", route: TALENT }]);
      expect(talent(game).state).toBe("applying");
    });

    test("[R-ENDORSE-003] given an endorsement issued, when its three months run out, then it is no longer held and the visa cannot be applied for", () => {
      const game = talentLife({ change: ALWAYS_ENDORSED });
      toIssued(game);
      expect(content.document[ENDORSEMENT]!.validMonths).toBe(3);
      for (let month = 0; month < 3; month += 1) game.endTurn();
      expect(game.state.document[ENDORSEMENT]?.state).toBe("expired");
      expect(game.expectRejected({ type: "activity/now", activity: APPLY_VISA, param: null }, "not-legal").code).toBe("not-legal");
    });

    test("[R-ENDORSE-003] given the gate's terms, when the chance is worked out, then it is the base of 300 plus earlier refusals and nothing else", () => {
      const numbers = content.tuning.route;
      const game = talentLife();
      const decision = GATES.endorsement.decision(readOf(game), entry, talent(game));
      expect(decision).toEqual({ terms: { strictness: false, unexplained: false, refusals: true, interview: false, goodGrade: false }, override: null, bans: false });
      expect(entry.refusalBaseBp).toBe(300);
      const file = { strictness: 90, unexplainedBp: 10000, refusals: 0, interviewScore: -6, grade: 5 };
      expect(refusalChanceBp(numbers, entry.refusalBaseBp, file, decision.terms)).toBe(300);
      expect(refusalChanceBp(numbers, entry.refusalBaseBp, { ...file, refusals: 1 }, decision.terms)).toBe(300 + numbers.refusalPerRefusalBp);
    });

    test("[R-ENDORSE-003] given an application sent, when its decision month comes and it is granted, then departing gives the talent status in the UK", () => {
      const game = talentLife({ change: ALWAYS_ENDORSED, tuning: ALWAYS_GRANTED });
      toIssued(game);
      game.endTurn([slot(APPLY_VISA)]);
      while (talent(game).state === "applying") game.endTurn();
      expect(talent(game).state).toBe("granted");
      game.accept({ type: "route/depart", route: TALENT });
      expect(game.state.status.current?.entry).toBe(entry.status);
      expect(game.state.place.country).toBe(entry.country);
    });
  });

  describe("the gate", () => {
    test("[R-GATE-001] given the talent route, when its steps are listed, then cooled is the one step, and any other step is never reached", () => {
      const game = talentLife();
      expect(GATES.endorsement.steps).toEqual([COOLED]);
      expect(GATES.endorsement.reached(readOf(game), entry, talent(game), COOLED)).toBe(true);
      expect(GATES.endorsement.reached(readOf(game), entry, talent(game), "pool")).toBe(false);
    });

    test("[R-GATE-002] given the talent route, when its decision is asked for, then it reads earlier refusals only on the route's own base, with no override", () => {
      const game = talentLife();
      const decision = GATES.endorsement.decision(readOf(game), entry, talent(game));
      expect(decision.override).toBeNull();
      expect(decision.bans).toBe(false);
      expect(Object.entries(decision.terms).filter(([, read]) => read).map(([term]) => term)).toEqual(["refusals"]);
    });
  });
});
