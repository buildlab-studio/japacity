// Same again only after a month that had something in it (docs/rules/world.md R-WORLD-007): the Month sheet offered "Same again" after a month with nothing planned, where it plans nothing.
import { cleanup, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { MonthSheet } from "./MonthSheet";
import { turnWords } from "./turn.words";

describe("Same again after a month with nothing planned", () => {
  test("[R-WORLD-007] given a month ended with nothing planned, when the Month sheet opens, then Same again is not offered; after a month with a slot planned it is", async () => {
    const game = newGame("scenario.ada");
    game.endTurn();
    const empty = game.view();
    expect(empty.lastSlots).toEqual([]);
    expect(empty.report).not.toBeNull();
    await renderWithView(<MonthSheet />, empty);
    expect(screen.queryByRole("button", { name: turnWords("ui.month.same-again") })).toBeNull();
    cleanup();
    game.endTurn([{ activity: "activity.rest", param: null }]);
    const planned = game.view();
    expect(planned.lastSlots.length).toBeGreaterThan(0);
    await renderWithView(<MonthSheet />, planned);
    expect(screen.getByRole("button", { name: turnWords("ui.month.same-again") })).toBeDefined();
  });
});
