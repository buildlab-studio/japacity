// Bank, Lately (docs/rules/world.md R-WORLD-019), played on the real
// engine: every move of money once, each with one line. The living costs were listed twice (the
// wallet's line and the bill's "paid this month") and a fare paid mid-month was missing.
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../../authority/GameProvider";
import { createGameStore } from "../../../authority/store";
import { chargedLivingGame, gameAuthority, newGame } from "../../../shared/testing/fixtures";
import "../../../shared/testing/render";
import { tidyLines } from "../../../shared/words/lines";
import { words } from "../../../shared/words/text";
import { PhoneApps } from "../PhoneApps";

function lately(): string[] {
  return [...document.querySelectorAll("[data-money-lines] li")].map((row) => row.textContent ?? "");
}

describe("Bank, Lately", () => {
  test("[R-WORLD-019] given a month that paid the living costs and then a danfo fare, when Bank opens, then the living costs show once and the fare shows", async () => {
    // Decision 0035 (R-HOME-012): at home nothing of the living is charged as the month turns, so a month at the family
    // house moves no money for it at all.
    const byHand = createGameStore(gameAuthority(newGame("scenario.ada")));
    await byHand.getState().refresh();
    await act(async () => {
      await byHand.getState().endMonth();
    });
    const lived = byHand.getState().view?.report?.lines ?? [];
    expect(lived.some((line) => line.key === "line.wallet.upkeep" || (line.key === "line.obligation.charged" && line.params.obligation === "obligation.upkeep"))).toBe(false);
    // The once-only listing is tested on a charge that is made: the living charged whole, as the simulation's relief tests do.
    const game = chargedLivingGame("scenario.ada");
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    await act(async () => {
      await store.getState().endMonth();
    });
    const ended = store.getState().view?.report?.lines ?? [];
    const upkeep = tidyLines(ended).filter((line) => line.key === "line.wallet.upkeep");
    expect(upkeep).toHaveLength(1);
    expect(ended.some((line) => line.key === "line.obligation.charged" && line.params.obligation === "obligation.upkeep")).toBe(true);
    let fare: string | null = null;
    await act(async () => {
      const reply = await store.getState().send({ type: "place/ride", from: "place.family-house", to: "place.yaba-hub", way: "danfo" });
      if (reply?.ok !== true) throw new Error("The ride was refused.");
      const paid = reply.lines.find((line) => line.key.startsWith("line.wallet."));
      fare = paid === undefined ? null : words(paid.key, paid.params);
    });
    expect(fare).not.toBeNull();
    render(
      <GameProvider store={store}>
        <PhoneApps onClose={() => undefined} area="Yaba" now={() => new Date(2026, 9, 8, 12, 5)} talk={null} />
      </GameProvider>,
    );
    fireEvent.click(document.querySelector<HTMLElement>('[data-app="bank"]')!);
    await waitFor(() => expect(lately().length).toBeGreaterThan(0));
    const shown = lately();
    const living = upkeep[0];
    expect(shown.filter((row) => row === words(living!.key, living!.params))).toHaveLength(1);
    expect(shown.some((row) => row.includes(words("line.obligation.charged", { obligation: "obligation.upkeep", amount: living!.params.amount! })))).toBe(false);
    expect(shown.at(-1)).toBe(fare);
    expect(new Set(shown).size).toBe(shown.length);
  });
});
