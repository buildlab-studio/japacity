// R-ACTIVITY-015: a now-act (an application, a paper, a visit) is refused in a slot, so each probe sends one as
// activity/now, and an application checked as applying is read in the month it is sent.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Tuning } from "../engine/types";
import type { Game } from "../testing/play";
import { answerInterview, applyAs, facts, joint, life, scored, setFacts, SKILLED, UK_DEPENDANT, UK_PARTNER } from "../testing/people.journey";
import { routeOf } from "../testing/read";
import { slot } from "../testing/route.journey";

const used = content;
const SURCHARGE_YEAR = content.var["var.uk-surcharge-year"]!.start;
const PARTNER_FEE = content.var["var.uk-partner-fee"]!.start;
const SETTLED = facts({ where: "abroad", country: "country.uk", status: "status.uk-settled", meetsFloor: { [UK_PARTNER]: true } });
const ALWAYS_GRANTED: Partial<Tuning["route"]> = { refusalMinBp: 0, refusalMaxBp: 0 };

/** A UK partner application in, sent from a married life with a settled sponsor. */
function partnerApplying(): Game {
  const game = life(used);
  joint(game, UK_PARTNER, "them", { stage: "married", facts: SETTLED });
  game.endTurn();
  game.endTurn([slot("activity.look-into-route", UK_PARTNER)]);
  game.accept({ type: "activity/now", activity: "activity.apply-uk-partner", param: null });
  expect(routeOf(game, UK_PARTNER).state).toBe("applying");
  answerInterview(game);
  return game;
}

/** A UK dependant's visa granted behind a lead whose own was granted, not yet used. */
function dependantGranted(): Game {
  const game = life(used, { tuning: ALWAYS_GRANTED });
  joint(game, SKILLED, "them", { stage: "married", facts: facts({ joint: { route: SKILLED, state: "granted" } }) });
  applyAs(game, [{ type: "route/hear", route: UK_DEPENDANT, via: "partner" }]);
  game.endTurn([slot("activity.look-into-route", UK_DEPENDANT)]);
  game.endTurn([slot("activity.apply-uk-dependant")]);
  while (routeOf(game, UK_DEPENDANT).state === "applying") game.endTurn();
  expect(routeOf(game, UK_DEPENDANT).state).toBe("granted");
  return game;
}

describe("R-PEOPLE-036: an application resting on a bond is withdrawn", () => {
  test("[R-PEOPLE-036] given a partner application mid-way, when it is withdrawn, then the route is known again with no application, the surcharge comes back, the fee does not, and no refusal is recorded", () => {
    const game = partnerApplying();
    const bank = game.state.wallet.pockets.GBP.bank;
    const lines = applyAs(game, [{ type: "route/withdraw", route: UK_PARTNER }]);
    const held = routeOf(game, UK_PARTNER);
    expect(held).toMatchObject({ state: "known", visa: null, refusals: 0, lastRefusal: null });
    // The interview it opened closes unscored with it.
    expect(game.state.interview).toMatchObject({ open: null, last: null });
    expect(lines.map((line) => line.key)).toContain("line.interview.withdrawn");
    expect(game.state.wallet.pockets.GBP.bank - bank).toBe(3 * SURCHARGE_YEAR);
    expect(game.state.wallet.totals.out["fee-visa"]?.GBP).toBe(PARTNER_FEE);
    expect(lines.map((line) => line.key)).toContain("line.route.withdrawn");
  });

  test("[R-PEOPLE-036] given a withdrawn partner application and an interview result arriving late, when the months pass, then nothing is decided", () => {
    const game = partnerApplying();
    applyAs(game, [{ type: "route/withdraw", route: UK_PARTNER }]);
    scored(game, UK_PARTNER, "pass");
    // The interview's questions were drawn on `visa` when it opened (R-INTERVIEW-003); no decision draws after them.
    const drawn = game.state.draws.visa ?? 0;
    for (let month = 0; month < 4; month += 1) game.endTurn();
    expect(routeOf(game, UK_PARTNER).state).toBe("known");
    expect(game.state.draws.visa ?? 0).toBe(drawn);
  });

  test("[R-PEOPLE-036] given a dependant's visa granted and not yet used, when it is withdrawn, then it is void: known again, and flying is no longer legal", () => {
    const game = dependantGranted();
    applyAs(game, [{ type: "route/withdraw", route: UK_DEPENDANT }]);
    expect(routeOf(game, UK_DEPENDANT)).toMatchObject({ state: "known", visa: null });
    game.expectRejected({ type: "route/depart", route: UK_DEPENDANT }, "not-legal");
  });

  test("[R-PEOPLE-036] given a route only known, and a dependant route already flown, when each is withdrawn, then nothing changes", () => {
    const known = life(used);
    joint(known, UK_PARTNER, "them", { stage: "married", facts: SETTLED });
    known.endTurn();
    known.endTurn([slot("activity.look-into-route", UK_PARTNER)]);
    const before = known.state.route;
    applyAs(known, [{ type: "route/withdraw", route: UK_PARTNER }]);
    expect(known.state.route).toEqual(before);

    const flown = dependantGranted();
    setFacts(flown, (now) => ({ ...now, statusMonthsLeft: 30 }));
    flown.accept({ type: "route/depart", route: UK_DEPENDANT });
    applyAs(flown, [{ type: "route/withdraw", route: UK_DEPENDANT }]);
    expect(routeOf(flown, UK_DEPENDANT).state).toBe("departed");
  });
});
