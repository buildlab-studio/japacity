// The Month sheet lists only what takes the month (docs/rules/activity.md R-ACTIVITY-015, docs/rules/world.md
// R-WORLD-007): an act done at once never sits in the plan, and one kept from an older plan is taken out.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import { gameAuthority, newGame } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { answersNow } from "../../shared/words/acts";
import { words } from "../../shared/words/text";
import { MonthSheet } from "./MonthSheet";

const MEETUP = "activity.meetup" as Id<"activity">;
const LEARN = "activity.learn-tech" as Id<"activity">;

async function played() {
  const game = newGame("scenario.ada");
  const authority = gameAuthority(game);
  const store = createGameStore(authority);
  await store.getState().refresh();
  return { store, sent: authority.sent };
}

describe("the Month sheet", () => {
  test("[R-ACTIVITY-015] [R-WORLD-007] given a plan kept from before holding a now-act, when the Month sheet opens, then it lists only what takes the month and End month is accepted", async () => {
    const { store, sent } = await played();
    act(() => store.setState({ plan: [{ activity: MEETUP, param: null }, { activity: LEARN, param: null }, null] }));
    render(
      <GameProvider store={store}>
        <MonthSheet />
      </GameProvider>,
    );
    await waitFor(() => expect(store.getState().plan.some((pick) => pick !== null && answersNow(pick.activity))).toBe(false));
    const planned = [...document.querySelectorAll("[data-slot='planned']")].map((row) => row.textContent ?? "");
    expect(planned.some((row) => row.includes(content.activity[LEARN] === undefined ? "" : words(`${LEARN}.name`)))).toBe(true);
    expect(planned.some((row) => row.includes(words(`${MEETUP}.name`)))).toBe(false);
    await act(async () => {
      await store.getState().endMonth();
    });
    expect(sent.at(-1)).toMatchObject({ type: "turn/end" });
    expect(store.getState().rejection).toBeNull();
  });
});
