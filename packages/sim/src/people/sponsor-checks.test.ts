import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { ActivityEntry, Content, Id } from "../engine/types";
import { applyAs, BOND, CA_SPOUSE, facts, joint, life, readOf, setPeople, UK_PARTNER } from "../route/gates/people.journey";
import type { Game } from "../testing/play";
import { barUntilMonth, floorsMet, meetsFloor, payAYear, sponsorCheck } from "./sponsor-checks";

const FLOOR = content.var["var.uk-partner-income"]!.start;
const BAR = content.country["country.canada"]!.partnerBarMonths;
const JOB: Id<"activity"> = "activity.job-test-uk";
const CASH_JOB: Id<"activity"> = "activity.job-test-uk-cash";
const CA_JOB: Id<"activity"> = "activity.job-test-ca";
const UNDERTAKING: Id<"obligation"> = "obligation.undertaking-ca";

/** A job abroad paying `salary` a year, so the floor's edge can be met exactly. */
function job(id: Id<"activity">, country: Id<"country">, currency: "GBP" | "CAD", salary: number, cash = false): ActivityEntry {
  return { id, slot: "main", where: "abroad", country, cash, requires: [], param: null, cost: [], pay: { currency, amount: salary }, hireBp: null, effects: [], counts: [] };
}

function withJobs(base: Content): Content {
  return {
    ...base,
    activity: { ...base.activity, [JOB]: job(JOB, "country.uk", "GBP", FLOOR), [CASH_JOB]: job(CASH_JOB, "country.uk", "GBP", FLOOR * 2, true), [CA_JOB]: job(CA_JOB, "country.canada", "CAD", 6000000) },
  };
}

const used = withJobs(content);

/** Ada moved abroad with a status and a job, each through its own kind's effect. */
function abroad(country: Id<"country">, status: Id<"status">, held: Id<"activity"> | null, vars: Record<Id<"var">, number> = {}): Game {
  const game = life(used, { vars: () => vars });
  applyAs(game, [{ type: "place/move", to: "abroad", country }, { type: "status/grant", status }]);
  if (held !== null) applyAs(game, [{ type: "activity/start-job", job: held }]);
  return game;
}

describe("R-UNDERTAKING-001: the checks in order", () => {
  test("[R-UNDERTAKING-001] given a character at home, and one abroad who fails only the floor, when the checks run, then each names the first check that fails, and one who passes them all gets none", () => {
    expect(sponsorCheck(readOf(life(used)), UK_PARTNER)).toBe("status");
    expect(sponsorCheck(readOf(abroad("country.uk", "status.uk-settled", null)), UK_PARTNER)).toBe("floor");
    expect(sponsorCheck(readOf(abroad("country.uk", "status.uk-settled", JOB)), UK_PARTNER)).toBeNull();
  });
});

describe("R-UNDERTAKING-001: agreeing to sponsor runs the checks", () => {
  /** A married bond with a friend, with no joint yet, so a joint can be proposed on it. */
  function married(game: Game): void {
    joint(game, UK_PARTNER, "me", { stage: "married", facts: facts() });
    setPeople(game, (slice) => ({ ...slice, joint: null }));
  }

  test("[R-UNDERTAKING-001] given a settled character abroad under the floor, and then one earning it, when each proposes to sponsor on the UK partner route, then the first is rejected naming the floor and the second's proposal goes out", () => {
    const under = abroad("country.uk", "status.uk-settled", null);
    married(under);
    const rejected = under.expectRejected({ type: "people/propose", bond: BOND, step: "joint", route: UK_PARTNER, lead: "me" }, "not-legal");
    expect(rejected.detail).toContain("floor");
    const earning = abroad("country.uk", "status.uk-settled", JOB);
    married(earning);
    earning.accept({ type: "people/propose", bond: BOND, step: "joint", route: UK_PARTNER, lead: "me" });
    expect(earning.state.people.bonds[BOND]?.pending.mine).toEqual({ step: "joint", route: UK_PARTNER, lead: "me" });
  });

  test("[R-UNDERTAKING-001] given a joint proposed with this life as sponsor, when it answers yes while failing the floor, then the answer is rejected naming the check, and no is accepted", () => {
    const game = abroad("country.uk", "status.uk-settled", null);
    married(game);
    game.accept({ type: "people/proposal", pair: "pair-1", proposal: { step: "joint", route: UK_PARTNER, lead: "me" } }, "authority");
    expect(game.expectRejected({ type: "people/answer", bond: BOND, step: "joint", yes: true }, "not-legal").detail).toContain("floor");
    game.accept({ type: "people/answer", bond: BOND, step: "joint", yes: false });
  });
});

describe("R-INTERVIEW-010: a caught sponsor's bar", () => {
  test("[R-INTERVIEW-010] given a resident in Canada whose interview on the spouse route was caught, when the bar is read and a joint proposed, then sponsoring into Canada waits for the country's ban months and the view shows the month it lifts", () => {
    const game = abroad("country.canada", "status.ca-resident", null);
    const month = game.state.turn.month;
    const ban = content.country["country.canada"]!.deceptionBanMonths;
    game.state = { ...game.state, interview: { ...game.state.interview, last: { route: CA_SPOUSE, result: "caught", matched: 0, asked: 5, month, standIn: { a: false, b: false } } } };
    expect(sponsorCheck(readOf(game), CA_SPOUSE)).toBe("bar");
    expect(game.view().people.barUntilMonth).toBe(month + ban);
    joint(game, CA_SPOUSE, "me", { stage: "married", facts: facts() });
    setPeople(game, (slice) => ({ ...slice, joint: null }));
    expect(game.expectRejected({ type: "people/propose", bond: BOND, step: "joint", route: CA_SPOUSE, lead: "me" }, "not-legal").detail).toContain("bar");
    // The bar lifts in the month it names, as R-GATE-005 lifts the ban.
    game.state = { ...game.state, interview: { ...game.state.interview, last: { route: CA_SPOUSE, result: "caught", matched: 0, asked: 5, month: month - ban, standIn: { a: false, b: false } } } };
    expect(sponsorCheck(readOf(game), CA_SPOUSE)).toBeNull();
    expect(game.view().people.barUntilMonth).toBeNull();
  });
});

describe("R-UNDERTAKING-002: the sponsor's status", () => {
  test("[R-UNDERTAKING-002] given settled, citizen, a sponsored worker in the UK, and a settled character in Canada, when the UK check runs, then only the first two hold", () => {
    expect(sponsorCheck(readOf(abroad("country.uk", "status.uk-citizen", JOB)), UK_PARTNER)).toBeNull();
    expect(sponsorCheck(readOf(abroad("country.uk", "status.uk-sponsored", JOB)), UK_PARTNER)).toBe("status");
    expect(sponsorCheck(readOf(abroad("country.canada", "status.ca-resident", CA_JOB)), UK_PARTNER)).toBe("status");
    expect(sponsorCheck(readOf(abroad("country.canada", "status.ca-resident", null)), CA_SPOUSE)).toBeNull();
  });
});

describe("R-UNDERTAKING-003: the earnings floor", () => {
  test("[R-UNDERTAKING-003] given pay a year of exactly the floor, and the floor raised by one, when the floor is judged, then it is met only at the floor", () => {
    const at = abroad("country.uk", "status.uk-settled", JOB);
    expect(payAYear(readOf(at), "country.uk")).toBe(FLOOR);
    expect(meetsFloor(readOf(at), UK_PARTNER)).toBe(true);
    const under = abroad("country.uk", "status.uk-settled", JOB, { "var.uk-partner-income": FLOOR + 1 });
    expect(meetsFloor(readOf(under), UK_PARTNER)).toBe(false);
  });

  test("[R-UNDERTAKING-003] given a cash job paying twice the floor, no job, and Canada's route with no floor, when the floor is judged, then cash counts as nothing and Canada asks for none", () => {
    expect(meetsFloor(readOf(abroad("country.uk", "status.uk-settled", CASH_JOB)), UK_PARTNER)).toBe(false);
    const idle = abroad("country.uk", "status.uk-settled", null);
    expect(meetsFloor(readOf(idle), UK_PARTNER)).toBe(false);
    expect(meetsFloor(readOf(idle), CA_SPOUSE)).toBe(true);
    expect(floorsMet(readOf(idle))).toEqual({ [UK_PARTNER]: false, [CA_SPOUSE]: true });
  });
});

describe("R-UNDERTAKING-004: the five-year bar", () => {
  test("[R-UNDERTAKING-004] given an arrival on Canada's spouse route 59 and 60 months ago, when the bar is read, then it stands at 59 and has lifted at 60", () => {
    const game = abroad("country.canada", "status.ca-resident", null);
    const month = game.state.turn.month;
    setPeople(game, (slice) => ({ ...slice, arrived: { route: CA_SPOUSE, month: month - (BAR - 1) } }));
    expect(barUntilMonth(readOf(game))).toBe(month + 1);
    expect(sponsorCheck(readOf(game), CA_SPOUSE)).toBe("bar");
    setPeople(game, (slice) => ({ ...slice, arrived: { route: CA_SPOUSE, month: month - BAR } }));
    expect(barUntilMonth(readOf(game))).toBeNull();
    expect(sponsorCheck(readOf(game), CA_SPOUSE)).toBeNull();
  });

  test("[R-UNDERTAKING-004] given an arrival on the UK partner route, or on Canada's points route, when the bar is read, then there is none", () => {
    const uk = abroad("country.uk", "status.uk-settled", JOB);
    setPeople(uk, (slice) => ({ ...slice, arrived: { route: UK_PARTNER, month: uk.state.turn.month } }));
    expect(content.country["country.uk"]!.partnerBarMonths).toBe(0);
    expect(barUntilMonth(readOf(uk))).toBeNull();
    const points = abroad("country.canada", "status.ca-resident", null);
    setPeople(points, (slice) => ({ ...slice, arrived: { route: "route.canada-points", month: points.state.turn.month } }));
    expect(barUntilMonth(readOf(points))).toBeNull();
  });
});

describe("R-UNDERTAKING-005: undertakings that bar sponsoring", () => {
  test("[R-UNDERTAKING-005] given an undertaking still running in Canada, when a new sponsorship is checked, then Canada's is barred and the UK's is not", () => {
    const game = abroad("country.canada", "status.ca-resident", null);
    applyAs(game, [{ type: "obligation/open", obligation: UNDERTAKING }]);
    expect(sponsorCheck(readOf(game), CA_SPOUSE)).toBe("running");
    applyAs(game, [{ type: "place/move", to: "abroad", country: "country.uk" }, { type: "status/grant", status: "status.uk-settled" }]);
    applyAs(game, [{ type: "activity/start-job", job: JOB }]);
    expect(sponsorCheck(readOf(game), UK_PARTNER)).toBeNull();
  });

  test("[R-UNDERTAKING-005] given an undertaking in default, when any sponsorship is checked, then it is barred", () => {
    const game = abroad("country.canada", "status.ca-resident", null);
    joint(game, CA_SPOUSE, "me", { stage: "married", facts: facts({ assistanceTaken: 1 }) });
    setPeople(game, (slice) => ({ ...slice, sponsoring: { bond: slice.joint!.bond, route: CA_SPOUSE, month: game.state.turn.month } }));
    applyAs(game, [{ type: "obligation/open", obligation: UNDERTAKING }]);
    const grace = content.obligation[UNDERTAKING]!.grace;
    for (let month = 0; month <= grace; month += 1) game.endTurn();
    expect(Object.values(game.state.obligation.items).find((item) => item.entry === UNDERTAKING)?.state).toBe("defaulted");
    expect(sponsorCheck(readOf(game), CA_SPOUSE)).toBe("default");
  });
});
