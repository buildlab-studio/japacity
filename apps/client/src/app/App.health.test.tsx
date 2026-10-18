import { content, text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { qualityIn } from "@japacity/sim";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { App } from "./App";
import { createGameStore } from "../authority/store";
import { chargedLivingGame, engineView, fakeAuthority, viewAfter } from "../shared/testing/fixtures";
import { found, renderWithView } from "../shared/testing/render";
import { nameOf, say } from "../shared/words/text";
import { RunDownBanner } from "../features/health/RunDownBanner";

const WELLBEING = "quality.wellbeing";
const health = content.tuning.health;

/**
 * Ada with wellbeing pushed under the run-down line, played until the warning stands. Resting lifts her over the
 * line until her four months of living run out and the unpaid upkeep pulls her under. Decision
 * 0013 (home:living-by-hand): at home the living is not charged as the month turns, so her months are played with it
 * charged whole, as the simulation's relief tests charge it, for the unpaid months to pull her under.
 */
function runDownView(): PlayerView {
  const game = chargedLivingGame();
  for (let month = 0; month < 6 && !game.view().runDown; month += 1) {
    const wellbeing = game.state.quality[WELLBEING] ?? 0;
    viewAfter(game, [{ type: "quality/add", quality: WELLBEING, amount: 5 - wellbeing }]);
    game.endTurn();
  }
  const view = game.view();
  if (!view.runDown) throw new Error("The run-down warning did not stand.");
  return view;
}

describe("the run-down warning", () => {
  test("[health:view-shows-health-warning] given wellbeing under the line two months running, then the banner names it with wellbeing against the line", async () => {
    const view = runDownView();
    await renderWithView(<RunDownBanner />, view);
    const banner = screen.getByRole("alert");
    expect(within(banner).getByText(say("ui.health.run-down"))).toBeDefined();
    const wellbeing = qualityIn(view, WELLBEING);
    expect(within(banner).getByText(say("ui.health.run-down-figure", { quality: nameOf(WELLBEING), value: wellbeing, line: health.runDownBelow }))).toBeDefined();
  });

  test("[health:view-shows-health-warning] given the warning does not stand, then there is no banner", async () => {
    await renderWithView(<RunDownBanner />, engineView());
    expect(document.querySelector("[data-run-down]")).toBeNull();
  });

  test("[health:view-shows-health-warning] given the warning stands, then the banner is on the phone's home and above every app, whichever app is open", async () => {
    const store = createGameStore(fakeAuthority(runDownView()));
    await store.getState().refresh();
    render(<App store={store} />);
    // The world is the game (world:world-fills-the-screen): the life's screens are the phone's apps (world:phone-rises-over-scene).
    fireEvent.click(await waitFor(() => found("[data-thumb='phone']"), { timeout: 10_000 }));
    await waitFor(() => expect(document.querySelector("[data-phone-warnings] [data-run-down]")).not.toBeNull());
    for (const app of ["calendar", "bank", "japa", "chats", "news"]) {
      fireEvent.click(await waitFor(() => found(`[data-app="${app}"]`)));
      // Above the app's own screen, never inside it.
      const banner = await waitFor(() => found(`[data-app-screen="${app}"] > [data-run-down]`));
      expect(banner.parentElement?.firstElementChild).toBe(banner);
      fireEvent.click(screen.getByRole("button", { name: say("phone.back") }));
    }
  });
});

describe("the reasons a slot is held", () => {
  test("[turn:slots-can-be-locked] given each lock reason content uses, then each has words of its own", () => {
    const reasons = new Set<string>(["side-job", "illness", "village-burial", "court-date"]);
    for (const entry of Object.values(content.offer)) {
      for (const choice of entry.choices) for (const effect of choice.effects) if (effect.type === "turn/lock") reasons.add(effect.why);
    }
    for (const why of reasons) expect(text[`ui.locks.why.${why}`] ?? say(`ui.locks.why.${why}`)).not.toBe(say("ui.locks.why.other"));
  });
});
