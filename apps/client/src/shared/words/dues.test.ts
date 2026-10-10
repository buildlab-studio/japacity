// The month's dues abroad against what is held (docs/rules/world.md R-WORLD-003, 019).
import { describe, expect, test } from "vitest";

import { abroadGame, setPockets, viewAfter } from "../testing/fixtures";
import { duesGap } from "./dues";

describe("the dues gap and the month's pay", () => {
  test("[R-WORLD-003] [R-WALLET-016] given pounds short of the dues but a job whose month's pay, as the wallet will book it, covers the rest, when the gap is read, then there is none; without the job, there is", () => {
    // the pay is the view's, so the job is started through the engine.
    const game = abroadGame();
    const due = game.view().obligations.reduce((sum, owed) => (owed.due > 0 ? sum + owed.due : sum), 0);
    if (due === 0) throw new Error("No dues abroad.");
    const short = 50_000;
    setPockets(game, { GBP: Math.max(0, due - short) });
    expect(duesGap(game.view())).not.toBeNull();
    const working = viewAfter(game, [{ type: "activity/start-job", job: "activity.job-uk-retail-part" }]);
    expect(working.job.pay?.amount).toBeGreaterThanOrEqual(short);
    expect(duesGap(working)).toBeNull();
  });

  test("[R-WALLET-016] given a job whose month's pay is short of the gap, when the gap is read, then the gap stands: the pay counted is the view's, net of tax", () => {
    const game = abroadGame();
    const due = game.view().obligations.reduce((sum, owed) => (owed.due > 0 ? sum + owed.due : sum), 0);
    const working = viewAfter(game, [{ type: "activity/start-job", job: "activity.job-uk-retail-part" }]);
    const pay = working.job.pay?.amount ?? 0;
    setPockets(game, { GBP: Math.max(0, due - pay - 1) });
    expect(duesGap(game.view())).toMatchObject({ currency: "GBP", due });
  });
});
