// Bank, Lately in the application month (docs/rules/world.md R-WORLD-019), played on the recorded life
// ada-careful, whose results list the fare and the salary in dollars. Lately is the month's money whole,
// from the results' own money lines, in their order, so it leaves neither out.
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../../authority/GameProvider";
import { createGameStore, type PlayerCommand } from "../../../authority/store";
import { gameAuthority, recordedGame, recordedSave } from "../../../shared/testing/fixtures";
import "../../../shared/testing/render";
import { moneyLines } from "../../../shared/words/money";
import { words } from "../../../shared/words/text";
import { PhoneApps } from "../PhoneApps";

const LIFE = "ada-careful";
/** The visa application, sent at once (R-ACTIVITY-015): found in the recorded life, wherever its cut puts it. */
function applicationIndex(commands: readonly { command: { type: string; activity?: string } }[]): number {
  return commands.findIndex(({ command }) => command.type === "activity/now" && command.activity === "activity.apply-for-visa");
}

function lately(): string[] {
  return [...document.querySelectorAll("[data-money-lines] li")].map((row) => row.textContent ?? "");
}

describe("Bank, Lately in the application month", () => {
  test("[R-WORLD-019] given ada-careful riding to the visa centre and sending the application, when Bank opens after the month, then Lately lists the results' money lines whole and in their order, the dollar salary and the fare among them", async () => {
    const save = recordedSave(LIFE);
    const APPLICATION = applicationIndex(save.commands);
    if (APPLICATION < 0) throw new Error("The recording no longer applies for the visa at once.");
    // The application opens the visa interview's questions, answered as recorded, then the month ends with its slots.
    const endAt = save.commands.findIndex((entry, index) => index > APPLICATION && entry.command.type === "turn/end");
    const ending = save.commands[endAt]?.command;
    if (ending?.type !== "turn/end") throw new Error("The application month's end has moved in the recording.");
    const game = recordedGame(LIFE, save.commands.length - APPLICATION);
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    await act(async () => {
      const ride = await store.getState().send({ type: "place/ride", from: "place.family-house", to: "place.visa-centre", way: "danfo" });
      if (ride?.ok !== true) throw new Error("The ride to the visa centre was refused.");
      for (const { command } of save.commands.slice(APPLICATION, endAt)) {
        // The recording's commands carry `basedOn`; the store adds its own.
        const { basedOn, ...sent } = command;
        void basedOn;
        const reply = await store.getState().send(sent as PlayerCommand);
        if (reply?.ok !== true) throw new Error(`${command.type} was refused.`);
      }
      const end = await store.getState().send({ type: "turn/end", slots: ending.slots });
      if (end?.ok !== true) throw new Error("The month end was refused.");
    });
    const state = store.getState();
    const view = state.view;
    if (view?.report === null || view === null) throw new Error("No report.");
    // The application's line is said where it was sent, among the month's lines (R-ACTIVITY-015).
    expect([...state.lastMonthLines, ...view.report.lines].some((line) => line.key === "line.route.applied")).toBe(true);
    const results = moneyLines([...state.lastMonthLines, ...view.report.lines]).map(({ line }) => words(line.key, line.params));
    const salary = results.find((row) => row.startsWith("Salary") && row.includes("$"));
    const fare = results.find((row) => row.startsWith("Fare paid"));
    expect(salary).toBeDefined();
    expect(fare).toBeDefined();

    render(
      <GameProvider store={store}>
        <PhoneApps onClose={() => undefined} area="Victoria Island" now={() => new Date(2026, 9, 8, 12, 5)} talk={null} />
      </GameProvider>,
    );
    fireEvent.click(document.querySelector<HTMLElement>('[data-app="bank"]')!);
    await waitFor(() => expect(lately().length).toBeGreaterThan(0));
    expect(lately()).toEqual(results);
    expect(lately()).toContain(salary);
    expect(lately()).toContain(fare);
  });
});
