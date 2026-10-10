// An application out, in the Jobs app (docs/rules/world.md R-WORLD-019): right after applying
// at the clinic the app said "No job yet ... No job offers right now" while the place had said the matron would answer
// by the month's end. The app says the application waits. Real content, the tile's nurse played through `step`.
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../../authority/GameProvider";
import { createGameStore } from "../../../authority/store";
import { gameAuthority } from "../../../shared/testing/fixtures";
import "../../../shared/testing/render";
import { tileNurse } from "../../../shared/testing/nurse";
import { phoneWords } from "../phone.words";
import { Jobs } from "./Jobs";

describe("an application out in Jobs", () => {
  test("[R-WORLD-019] [R-ACTIVITY-015] given the tile's nurse who has just applied for staff nurse at the clinic, when Jobs opens, then it says the application waits and when they answer, never that there are no offers", async () => {
    const game = tileNurse("nurse-jobs");
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    await store.getState().send({ type: "activity/now", activity: "activity.job-hunt", param: "activity.job-nurse" });
    render(
      <GameProvider store={store}>
        <Jobs />
      </GameProvider>,
    );
    expect(document.querySelector("[data-job-applied]")?.textContent).toBe("Applied: Staff nurse at the clinic. They answer at the month's end.");
    expect(document.body.textContent).not.toContain(phoneWords("phone.jobs.offers.none"));
  });

  test("[R-WORLD-019] given the month ended and the answer in, when Jobs opens, then the application is no longer said to wait", async () => {
    const game = tileNurse("nurse-jobs");
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    await store.getState().send({ type: "activity/now", activity: "activity.job-hunt", param: "activity.job-nurse" });
    await store.getState().endMonth();
    render(
      <GameProvider store={store}>
        <Jobs />
      </GameProvider>,
    );
    expect(document.querySelector("[data-job-applied]")).toBeNull();
  });
});
