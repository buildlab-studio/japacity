// "Ask about routes" at the hub's desk (world:things-are-tappable-models, world:one-action-one-sheet, advice:four-ways-to-learn-route): the
// sheet is about routes, never only "A master's at home", so the act's name holds: the adviser's card leads when the
// adviser can be seen, and a card still shut (the word of someone who went, which needs the network) stands with its reason instead of going. Real content, a real life from sixteen.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import yabaHub from "../../../../public/assets/places/yaba-hub/place.json";
import { archetypeOf } from "../../../shared/frontdoor/archetypes";
import { playTile } from "../../../shared/frontdoor/archetypes.testing";
import { newGame, viewAfter } from "../../../shared/testing/fixtures";
import { requirementSentence } from "../../../shared/words/requirement";
import { say } from "../../../shared/words/text";
import type { Act } from "../../../shared/world/contract";
import { actsOffered } from "./acts";
import { type PlaceFile, stageOf } from "../../../shared/scene/placeFile";
import { stagedNow, thingsNow, thingsOf, withMoreAt } from "../scene/things";

const YABA = "place.yaba";
const ADVISER = "activity.see-adviser";
const FRIEND = "activity.ask-someone-who-went";
const OFFICIAL = "activity.look-into-route";
const MASTERS_AT_HOME = "activity.masters-at-home";

/** A developer from sixteen, handed over: the tile's preset played on one seed. */
function developer(): ReturnType<typeof newGame> {
  const archetype = archetypeOf("developer")!;
  const game = newGame("scenario.prologue", "routes-desk");
  playTile(game, archetype);
  return game;
}

/** The desk's "Ask about routes" act as the world shows it for this view, at the hub in Yaba. */
function routesAct(view: PlayerView): Act | undefined {
  const stage = stageOf(yabaHub as unknown as PlaceFile);
  const staged = new Set<string>(content.place[YABA]?.stages ?? []);
  const things = thingsNow(withMoreAt(thingsOf(stage), YABA), stagedNow(new Set(actsOffered(view)), staged, new Set(), null, view.chapter.current));
  return things.find((thing) => thing.id === "desk")?.acts.find((act) => act.id === "routes");
}

describe("the routes at the hub's desk", () => {
  test("[world:things-are-tappable-models] [world:one-action-one-sheet] [advice:four-ways-to-learn-route] given a developer's first month with no way out heard of, when Ask about routes is opened, then the sheet keeps the act's name, the adviser's card leads, and the word of someone who went stands shut with what it needs: someone abroad or a wide enough circle", () => {
    const view = developer().view();
    expect(view.activities.find((option) => option.id === ADVISER)?.allowed).toBe(false);
    expect(view.activities.find((option) => option.id === FRIEND)?.allowed).toBe(false);
    const act = routesAct(view);
    expect(act).toMatchObject({ label: "city.act.routes", stages: ADVISER });
    expect(act?.more).toEqual(expect.arrayContaining([FRIEND, MASTERS_AT_HOME]));
    // The sheet's cards say each shut card's needs as these sentences (ActivityView's "Not yet:" list).
    const needs = (id: string): string[] => (view.activities.find((option) => option.id === id)?.missing ?? []).map((requirement) => requirementSentence(requirement, { routes: view.routes }));
    // The adviser's need in one line, never every route by name.
    expect(needs(ADVISER)).toEqual([say("ui.req.any-route")]);
    // What the word of someone who went needs, a person abroad or the network, in one plain line, the band never a figure (text:bands-not-figures).
    expect(needs(FRIEND)).toEqual([say("ui.req.any-abroad-or-circle")]);
  });

  test("[world:things-are-tappable-models] [advice:four-ways-to-learn-route] given a way out heard of, when Ask about routes is opened, then the adviser's card leads, before the official page", () => {
    const game = developer();
    const view = viewAfter(game, [{ type: "route/hear", route: "route.uk-masters", via: "meetup" }]);
    expect(view.routes.find((route) => route.id === "route.uk-masters")?.state).toBe("heard");
    expect(view.activities.find((option) => option.id === ADVISER)?.allowed).toBe(true);
    const act = routesAct(view);
    expect(act?.stages).toBe(ADVISER);
    expect(act?.more?.[0]).toBe(OFFICIAL);
  });
});
