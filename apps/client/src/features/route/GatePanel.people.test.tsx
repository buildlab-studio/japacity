import type { PlayerView, RouteView } from "@japacity/sim";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { courted, peopleGame, TOBI } from "../../shared/testing/people";
import { renderWithView } from "../../shared/testing/render";
import { nameOf, say } from "../../shared/words/text";
import { RouteView as Routes } from "./RouteView";

function withGate(view: PlayerView, id: RouteView["id"], gate: RouteView["gate"]): PlayerView {
  const route = view.routes.find((entry) => entry.id === id)!;
  return { ...view, routes: [{ ...route, state: "known", percent: 20, gate }] };
}

describe("the people gates on a route", () => {
  test("[R-PEOPLE-026] given the partner gate resting on a bond, then the route names who it rests on and how their side stands", async () => {
    const game = peopleGame();
    const bond = courted(game, TOBI);
    await renderWithView(<Routes />, withGate(game.view(), "route.uk-partner", { gate: "partner", bond, lead: "applying" }));
    expect(screen.getByText(say("ui.gate.partner.title"))).toBeDefined();
    expect(screen.getByText(say("ui.gate.bond.with", { name: nameOf(TOBI), stage: say("ui.people.stage.courting").toLowerCase() }))).toBeDefined();
    expect(screen.getByText(say("ui.gate.lead.state", { state: say("ui.route.state.applying").toLowerCase() }))).toBeDefined();
  });

  test("[R-PEOPLE-022] given the dependant gate with no bond, then it says a partner and an agreement are needed", async () => {
    const game = peopleGame();
    await renderWithView(<Routes />, withGate(game.view(), "route.uk-dependant", { gate: "dependant", bond: null, lead: null }));
    expect(screen.getByText(say("ui.gate.dependant.title"))).toBeDefined();
    expect(screen.getByText(say("ui.gate.bond.none"))).toBeDefined();
  });
});
