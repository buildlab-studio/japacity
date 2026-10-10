// "Ask about routes" at the hub's desk (docs/rules/world.md R-WORLD-005, R-WORLD-006, advice.md R-ADVICE-001; the
// : a developer's first month opened a sheet whose only card was "A master's at home". The act's name
// holds: the adviser's card leads when the adviser can be seen, and a card shut for now (the word of someone who went,
// which needs the network) stands with its reason instead of going. Real content, a real life from sixteen.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import yabaHub from "../../../public/assets/places/yaba-hub/place.json";
import { ActivityPicker } from "../activity/ActivityView";
import { answersInOrder, archetypeOf, presetAnswer } from "../../shared/frontdoor/archetypes";
import { newGame, viewAfter } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { requirementSentence } from "../../shared/words/requirement";
import { nameOf, say } from "../../shared/words/text";
import type { Act } from "../../shared/world/contract";
import { actsOffered } from "./acts";
import { type PlaceFile, stageOf } from "./placeFile";
import { stagedNow, thingsNow, thingsOf, withMoreAt } from "./things";

const YABA = "place.yaba";
const ADVISER = "activity.see-adviser";
const FRIEND = "activity.ask-someone-who-went";
const OFFICIAL = "activity.look-into-route";
const MASTERS_AT_HOME = "activity.masters-at-home";

/** A developer from sixteen, handed over: the tile's preset played on one seed. */
function developer(): ReturnType<typeof newGame> {
  const archetype = archetypeOf("developer")!;
  const game = newGame("scenario.prologue", "routes-desk");
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const answer = presetAnswer(archetype, prologue) ?? answersInOrder(archetype, prologue.step, prologue.answers).find((one) => one.allowed)?.id;
    if (answer === undefined) throw new Error(`No open answer at ${prologue.step}.`);
    game.accept({ type: "prologue/choose", step: prologue.step, answer });
  }
  return game;
}

/** The desk's "Ask about routes" act as the world shows it for this view, at the hub in Yaba. */
function routesAct(view: PlayerView): Act | undefined {
  const stage = stageOf(yabaHub as unknown as PlaceFile);
  const staged = new Set<string>(content.place[YABA]?.stages ?? []);
  const things = thingsNow(withMoreAt(thingsOf(stage), YABA), stagedNow(new Set(actsOffered(view)), staged, new Set(), null, view.chapter.current));
  return things.find((thing) => thing.id === "desk")?.acts.find((act) => act.id === "routes");
}

function cards(): string[] {
  return [...document.querySelectorAll("[data-activity-picker] h3")].map((heading) => heading.textContent ?? "");
}

describe("the routes at the hub's desk", () => {
  test("[R-WORLD-005] [R-WORLD-006] [R-ADVICE-001] given a developer's first month with no way out heard of, when Ask about routes is opened, then the sheet keeps the act's name, the adviser's card leads, and the word of someone who went stands shut with the network it needs", async () => {
    const view = developer().view();
    expect(view.activities.find((option) => option.id === ADVISER)?.allowed).toBe(false);
    expect(view.activities.find((option) => option.id === FRIEND)?.allowed).toBe(false);
    const act = routesAct(view);
    expect(act).toMatchObject({ label: "city.act.routes", stages: ADVISER });
    expect(act?.more).toEqual(expect.arrayContaining([FRIEND, MASTERS_AT_HOME]));
    await renderWithView(<ActivityPicker only={[act!.stages!, ...(act!.more ?? [])]} />, view);
    expect(cards()[0]).toBe(nameOf(ADVISER));
    expect(cards()).toContain(nameOf(FRIEND));
    const friend = [...document.querySelectorAll("[data-activity-picker] li")].find((card) => card.querySelector("h3")?.textContent === nameOf(FRIEND));
    // The network the word of someone who went needs, said by its band (R-TEXT-005); the adviser's need in one line.
    expect(friend?.textContent).toContain(requirementSentence({ type: "quality/min", quality: "quality.network", value: content.tuning.advice.networkToAsk }));
    const adviser = document.querySelector("[data-activity-picker] li");
    expect(adviser?.textContent).toContain(say("ui.req.any-route"));
    expect(adviser?.textContent).not.toContain(nameOf("route.ca-accompany"));
  });

  test("[R-WORLD-005] [R-ADVICE-001] given a way out heard of, when Ask about routes is opened, then the adviser's card leads, before the official page", () => {
    const game = developer();
    const view = viewAfter(game, [{ type: "route/hear", route: "route.uk-masters", via: "meetup" }]);
    expect(view.routes.find((route) => route.id === "route.uk-masters")?.state).toBe("heard");
    expect(view.activities.find((option) => option.id === ADVISER)?.allowed).toBe(true);
    const act = routesAct(view);
    expect(act?.stages).toBe(ADVISER);
    expect(act?.more?.[0]).toBe(OFFICIAL);
  });
});
