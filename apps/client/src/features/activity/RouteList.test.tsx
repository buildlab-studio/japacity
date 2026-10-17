import type { Id } from "@japacity/sim";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame, viewAfter } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { blurbOf, nameOf, say } from "../../shared/words/text";
import { ActivityPicker } from "./ActivityView";
import { routesWords } from "./routes.words";

const OFFICIAL = "activity.look-into-route";
const FRIEND = "activity.ask-someone-who-went";
const ADVISER = "activity.see-adviser";
const UK = "route.uk-masters" as Id<"route">;
const CANADA = "route.canada-points" as Id<"route">;

function card(id: string): HTMLElement {
  const button = screen.getByRole("button", { name: new RegExp(`^${nameOf(id)}`) });
  const found = button.closest("li");
  if (found === null) throw new Error(`No card for ${id}`);
  return found;
}

function addButton(id: string): HTMLButtonElement {
  return within(card(id)).getByRole("button", { name: nameOf(id) });
}

/** Tunde with two routes heard of: the hub desk's "Ask about routes" sheet. */
function twoRoutesHeard() {
  return viewAfter(newGame("scenario.tunde"), [
    { type: "route/hear", route: UK, via: "test" },
    { type: "route/hear", route: CANADA, via: "test" },
  ]);
}

describe("the routes list", () => {
  test("[R-WORLD-006] given two routes heard of, when the desk's sheet shows the official page, then the routes are rows with their name, what each is and heard of, and no native select", async () => {
    const view = twoRoutesHeard();
    const official = view.activities.find((option) => option.id === OFFICIAL);
    expect(official?.params).toEqual(expect.arrayContaining([UK, CANADA]));
    await renderWithView(<ActivityPicker only={[OFFICIAL, FRIEND, ADVISER]} />, view);
    expect(document.querySelector("select")).toBeNull();
    const rows = within(card(OFFICIAL)).getAllByRole("radio");
    expect(rows.map((row) => row.getAttribute("data-route"))).toEqual(official?.params);
    for (const id of [UK, CANADA]) {
      const row = rows.find((candidate) => candidate.getAttribute("data-route") === id);
      expect(row?.textContent).toContain(nameOf(id));
      expect(row?.textContent).toContain(blurbOf(id) ?? "");
      expect(row?.querySelector("[data-route-state]")?.textContent).toBe(say("ui.route.state.heard"));
    }
  });

  test("[R-WORLD-006] given two routes heard of, when the official page shows, then nothing is picked for the player and Do this is shut until a row is tapped, then plans that route", async () => {
    const { store, authority } = await renderWithView(<ActivityPicker only={[OFFICIAL]} />, twoRoutesHeard());
    expect(within(card(OFFICIAL)).getAllByRole("radio").every((row) => row.getAttribute("aria-checked") === "false")).toBe(true);
    expect(addButton(OFFICIAL).disabled).toBe(true);
    expect(addButton(OFFICIAL).querySelector("[data-after]")?.textContent).toBe(routesWords("routes.pick-first"));
    fireEvent.click(within(card(OFFICIAL)).getByRole("radio", { name: new RegExp(nameOf(CANADA)) }));
    expect(addButton(OFFICIAL).disabled).toBe(false);
    fireEvent.click(addButton(OFFICIAL));
    // R-ACTIVITY-015: the official page is read at once, so the route tapped goes with the command sent now.
    await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "activity/now", activity: OFFICIAL, param: CANADA }));
    expect(store.getState().plan.some((pick) => pick?.activity === OFFICIAL)).toBe(false);
  });

  test("[R-WORLD-006] given one route heard of, when someone who went shows, then it stays a card whose one row is picked, and the adviser stays a card with no list", async () => {
    const view = viewAfter(newGame("scenario.tunde"), [{ type: "route/hear", route: UK, via: "test" }]);
    await renderWithView(<ActivityPicker only={[FRIEND, ADVISER]} />, view);
    const rows = within(card(FRIEND)).getAllByRole("radio");
    expect(rows.map((row) => [row.getAttribute("data-route"), row.getAttribute("aria-checked")])).toEqual([[UK, "true"]]);
    expect(addButton(FRIEND).disabled).toBe(false);
    expect(within(card(ADVISER)).queryAllByRole("radio")).toEqual([]);
  });

  test("[R-WORLD-006] given a sponsor's route looked into, when finding a sponsor shows, then its row says looked into", async () => {
    const SKILLED = "route.uk-skilled" as Id<"route">;
    const SPONSOR = "activity.find-sponsor";
    const game = newGame("scenario.tunde");
    viewAfter(game, [{ type: "route/hear", route: SKILLED, via: "test" }]);
    game.endTurn([{ activity: OFFICIAL, param: SKILLED }]);
    const view = game.view();
    expect(view.activities.find((option) => option.id === SPONSOR)?.params).toContain(SKILLED);
    await renderWithView(<ActivityPicker only={[SPONSOR]} />, view);
    const row = within(card(SPONSOR)).getAllByRole("radio").find((candidate) => candidate.getAttribute("data-route") === SKILLED);
    expect(row?.querySelector("[data-route-state]")?.textContent).toBe(say("ui.route.state.known"));
  });
});
