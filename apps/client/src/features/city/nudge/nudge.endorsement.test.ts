// The nudge after the endorsement is refused (docs/rules/world.md R-WORLD-003, route-gates R-ENDORSE-002): a step
// waiting out a refusal names the wait, read from the route's refusal in the view, never "Apply for the endorsement"
// over a sheet that says it can be asked for again in six months. Real content, a real
// refusal: the talent route known, the endorsement asked for, the body sure to say no.
import { content, text } from "@japacity/content";
import type { Content, Id, PlayerView } from "@japacity/sim";
import type { Game } from "@japacity/sim/testing";
import { applyEffects, readyLife, slot } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { inMonths, say } from "../../../shared/words/text";
import { nudgeOf } from "./nudge";

const TALENT: Id<"route"> = "route.uk-talent";
const APPLY_ENDORSEMENT: Id<"activity"> = "activity.apply-endorsement";
const FILE = "chapter.build-the-file-talent";
const OWN = `${FILE}.item.endorsement`;
const NUDGE_WORDS = 8;

/** Content whose endorsing body never backs anyone. */
function neverEndorsed(used: Content): Content {
  const route = used.route[TALENT]!;
  return { ...used, route: { ...used.route, [TALENT]: { ...route, endorsement: { ...route.endorsement!, baseBp: 0, perPortfolioBp: 0, perNetworkBp: 0 } } } };
}

/** A developer at the endorsement's bars, the talent route heard of and looked into. */
function talentLife(): Game {
  const game = readyLife(content, { quiet: true, change: neverEndorsed, qualities: { "quality.tech": 85, "quality.portfolio": 5, "quality.network": 70 } });
  for (let month = 0; month < 4 && game.state.route["route.uk-masters"]!.state === "unknown"; month += 1) game.endTurn();
  applyEffects(game, [{ type: "route/hear", route: TALENT, via: "meetup" }]);
  game.endTurn([slot("activity.look-into-route", TALENT)]);
  return game;
}

/** The view in the talent file with the portfolio met and the endorsement next, as the chapter has it then. */
function inTheFile(view: PlayerView): PlayerView {
  return { ...view, offers: [], chapter: { current: FILE, items: [{ id: "portfolio", met: true }, { id: "endorsement", met: false }, { id: "applied", met: false }], done: [], closes: false, next: null } };
}

function cooledFrom(view: PlayerView): number {
  const gate = view.routes.find((route) => route.id === TALENT)?.gate;
  if (gate?.gate !== "endorsement" || gate.cooledFromMonth === null) throw new Error("The endorsement was not refused.");
  return gate.cooledFromMonth;
}

describe("the nudge after a refusal", () => {
  test("[R-WORLD-003] [R-ENDORSE-002] given the endorsement refused, when the nudge is read while the wait runs, then it says when it can be asked for again in words, never the act again; once the wait is out it names the act", () => {
    const game = talentLife();
    game.accept({ type: "activity/now", activity: APPLY_ENDORSEMENT, param: null });
    const ready = game.state.document["document.endorsement"]?.readyMonth ?? 0;
    while (game.state.turn.month < ready) game.endTurn();
    const refused = game.view();
    const cooled = cooledFrom(refused);
    expect(cooled).toBeGreaterThan(refused.month);
    expect(nudgeOf(inTheFile(refused))).toEqual({ key: `${OWN}.wait`, params: { when: inMonths(cooled, refused.month) }, about: "step" });
    // Next month the wait is one month shorter, and still said.
    game.endTurn();
    const later = game.view();
    expect(nudgeOf(inTheFile(later))).toEqual({ key: `${OWN}.wait`, params: { when: inMonths(cooled, later.month) }, about: "step" });
    while (game.state.turn.month < cooled) game.endTurn();
    expect(nudgeOf(inTheFile(game.view())).key).not.toBe(`${OWN}.wait`);
  });

  test("[R-WORLD-003] given the wait's words, when the longest wait is said, then the nudge is one sentence of at most eight words", () => {
    const longest = content.route[TALENT]?.endorsement?.cooldown ?? 0;
    expect(text[`${OWN}.wait`]).toContain("{when}");
    const said = say(`${OWN}.wait`, { when: inMonths(longest, 0) });
    expect(said.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(NUDGE_WORDS);
    expect(said).not.toMatch(/[.{}]/);
  });
});
