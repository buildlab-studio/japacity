// The degree's English statement (document:degree-english-statement) and who still sits the English test (document:who-sits-the-english-test).
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../engine/check";
import type { Id, Requirement } from "../engine/types";
import type { Game } from "../testing/play";
import { readOf } from "../testing/read";
import { READY_PAPERS, readyLife } from "../testing/route.journey";
import { CANADA_ROUTE, CARE_ROUTE, SKILLED, UK_PARTNER, UK_ROUTE } from "../testing/ids";

const STATEMENT: Id<"document"> = "document.degree-english";
const ASK: Id<"activity"> = "activity.degree-english";
const NO_TEST = READY_PAPERS.filter((paper) => paper.document !== "document.english-test");

function englishItem(route: Id<"route">): Requirement {
  const item = content.route[route]!.checklist.find((entry) => entry.id === "english");
  if (item === undefined) throw new Error(`${route} has no English item.`);
  return item.requirement;
}

function met(game: Game, requirement: Requirement): boolean {
  return check(readOf(game), requirement).met;
}

describe("the degree's English statement", () => {
  test("[document:degree-english-statement] given a graduate, when the statement is asked for, then ₦150,000 is paid as a document fee and it comes after one month, for good, with no value", () => {
    const game = readyLife(content, { quiet: true, documents: NO_TEST });
    const fees = game.state.wallet.totals.out["fee-document"]?.NGN ?? 0;
    game.accept({ type: "activity/now", activity: ASK, param: null });
    expect((game.state.wallet.totals.out["fee-document"]?.NGN ?? 0) - fees).toBe(15000000);
    expect(game.state.document[STATEMENT]?.state).toBe("pending");
    game.expectRejected({ type: "activity/now", activity: ASK, param: null }, "not-legal");
    game.endTurn();
    expect(game.state.document[STATEMENT]).toMatchObject({ state: "held", expiresMonth: null, value: null });
    expect(content.document[STATEMENT]).toMatchObject({ wait: [1, 1], validMonths: null, result: null });
    for (let month = 0; month < 30; month += 1) {
      if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
      game.endTurn();
    }
    expect(met(game, { type: "document/held", document: STATEMENT })).toBe(true);
  });

  test("[document:degree-english-statement] given no bachelor's degree, when the statement is asked for, then it is not legal", () => {
    const game = readyLife(content, { quiet: true, documents: NO_TEST, qualities: { "quality.education-level": 2 } });
    expect(game.expectRejected({ type: "activity/now", activity: ASK, param: null }, "not-legal").code).toBe("not-legal");
    expect(game.state.document[STATEMENT]).toBeUndefined();
  });

  test("[document:degree-english-statement] given the statement held and no test, when the UK work routes' and the partner route's English is read, then it is met; Canada's is not", () => {
    const game = readyLife(content, { quiet: true, documents: [...NO_TEST, { document: STATEMENT, monthsLeft: null, value: null }], qualities: { "quality.education-level": 2 } });
    expect([CARE_ROUTE, SKILLED, UK_PARTNER].map((route) => met(game, englishItem(route)))).toEqual([true, true, true]);
    expect(met(game, englishItem(CANADA_ROUTE))).toBe(false);
  });
});

describe("who sits the English test", () => {
  test("[document:who-sits-the-english-test] given a graduate with no test and no statement, when each route's English is read, then the master's and the partner route are met by the degree, and the UK work routes and Canada still ask a band", () => {
    const game = readyLife(content, { quiet: true, documents: NO_TEST });
    expect([UK_ROUTE, UK_PARTNER].map((route) => met(game, englishItem(route)))).toEqual([true, true]);
    expect([CARE_ROUTE, SKILLED, CANADA_ROUTE].map((route) => met(game, englishItem(route)))).toEqual([false, false, false]);
  });

  test("[document:who-sits-the-english-test] given the bands each route asks, when they are read, then Canada asks 60, the UK work routes 55 and the partner route 30, and one test costs ₦295,000", () => {
    expect(content.route[CANADA_ROUTE]!.checklist.find((item) => item.id === "english")?.requirement).toEqual({ type: "document/held", document: "document.english-test", min: 60 });
    expect([content.route[CARE_ROUTE]!.sponsor!.bandMin, content.route[SKILLED]!.sponsor!.bandMin, content.route[UK_PARTNER]!.partner!.bandMin]).toEqual([55, 55, 30]);
    expect(content.activity["activity.sit-english-test"]?.cost).toEqual([{ currency: "NGN", amount: 29500000, reason: "fee-test" }]);
    const game = readyLife(content, { quiet: true, documents: NO_TEST });
    const fees = game.state.wallet.totals.out["fee-test"]?.NGN ?? 0;
    game.accept({ type: "activity/now", activity: "activity.sit-english-test", param: null });
    expect((game.state.wallet.totals.out["fee-test"]?.NGN ?? 0) - fees).toBe(29500000);
  });
});
