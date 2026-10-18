// The board's pick and the hunt's answer (docs/rules/activity.md R-ACTIVITY-005; world.md R-WORLD-008): a developer's
// board never opens on customer service, and a developer who applies for the junior developer's job is never offered
// another with nothing said of the job asked for. The board opens on the life's own trade, and a sure first hunt that lands another job
// says first that the one asked for came to nothing (told on the results: App.oneFigure.test.tsx). Played on the real engine from the tiles' own years.
import { describe, expect, test } from "vitest";

import { type Archetype, archetypeOf } from "../../shared/frontdoor/archetypes";
import { playTile } from "../../shared/frontdoor/archetypes.testing";
import { newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { ActivityPicker } from "./ActivityView";
import { firstJob, huntOrder } from "./JobList";

const HUNT = "activity.job-hunt";
const JUNIOR_DEV = "activity.job-junior-dev";

/** A tile's life from sixteen, handed over: its preset played on one seed. */
function lifeOf(tile: Archetype, seed: string): ReturnType<typeof newGame> {
  const game = newGame("scenario.prologue", seed);
  playTile(game, tile);
  return game;
}

function checkedRow(): string | null {
  return [...document.querySelectorAll("[role='radio'][data-job]")].find((row) => row.getAttribute("aria-checked") === "true")?.getAttribute("data-job") ?? null;
}

describe("the board opens on the life's own trade", () => {
  test("[R-ACTIVITY-005] given the developer tile's first month, when the jobs board opens, then the junior developer's row is the one chosen, though customer service is listed first as the likelier", async () => {
    const view = lifeOf(archetypeOf("developer")!, "s4-developer").view();
    const listed = view.activities.find((option) => option.id === HUNT)?.params ?? [];
    const ordered = huntOrder(view, listed);
    expect(ordered[0]).toBe("activity.job-customer-service");
    expect(ordered).toContain(JUNIOR_DEV);
    expect(firstJob(view, ordered)).toBe(JUNIOR_DEV);
    await renderWithView(<ActivityPicker only={[HUNT]} />, view);
    expect(checkedRow()).toBe(JUNIOR_DEV);
  });

  test("[R-ACTIVITY-005] given a life with no trade the board lists (the shop worker's), when the board opens, then the first row is the one chosen", () => {
    const view = lifeOf(archetypeOf("shop-worker")!, "s4-shop").view();
    const ordered = huntOrder(view, view.activities.find((option) => option.id === HUNT)?.params ?? []);
    expect(ordered.length).toBeGreaterThan(0);
    expect(firstJob(view, ordered)).toBe(ordered[0]);
  });
});
