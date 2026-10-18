import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame, openOffer, viewAfter } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { lockWords } from "../../shared/words/locks";
import { say, sayCount } from "../../shared/words/text";
import { ActivityView } from "./ActivityView";

describe("the slots illness holds", () => {
  test("[R-HEALTH-007] [R-TURN-009] given the hospital chosen, then the month plan names the illness lock and that it holds this month only", async () => {
    const game = newGame();
    const offer = openOffer(game, "offer.illness");
    game.accept({ type: "offer/choose", offer: offer.id, choice: "hospital" });
    const view = game.view();
    const lock = view.locks.find((held) => held.why === "illness");
    expect(lock).toBeDefined();
    await renderWithView(<ActivityView />, view);
    const shown = screen.getByText(lockWords(lock!, view.month));
    expect(shown.textContent).toBe(say("ui.locks.item", { slots: sayCount("ui.offer.lock.slots", 1, { count: 1 }), why: say("ui.locks.why.illness"), left: sayCount("ui.locks.left", 1, { count: 1 }) }));
  });

  test("[R-HEALTH-007] [R-HEALTH-003] given the worse turn with no money for the hospital, then two slots are held with the months left and the last month", async () => {
    const game = newGame();
    const offer = openOffer(game, "offer.illness-worse");
    const naira = game.state.wallet.pockets.NGN;
    viewAfter(game, [
      { type: "money/take", currency: "NGN", pocket: "bank", amount: naira.bank, reason: "mishap" },
      { type: "money/take", currency: "NGN", pocket: "cash", amount: naira.cash, reason: "mishap" },
    ]);
    game.accept({ type: "offer/choose", offer: offer.id, choice: "cannot" });
    const view = game.view();
    const lock = view.locks.find((held) => held.why === "illness")!;
    expect(lock.slots).toBe(2);
    await renderWithView(<ActivityView />, view);
    const left = lock.untilMonth - view.month + 1;
    expect(left).toBe(3);
    expect(screen.getByText(say("ui.locks.item", { slots: sayCount("ui.offer.lock.slots", 2, { count: 2 }), why: say("ui.locks.why.illness"), left: say("ui.locks.left", { count: 3, month: lock.untilMonth + 1 }) }))).toBeDefined();
  });
});
