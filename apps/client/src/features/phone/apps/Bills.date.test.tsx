// A bill's slip is dated in the game's own time (world:phone-holds-what-phones-hold, world:top-band-is-lively-pill): the
// character's age in years and months, as the band shows it, never the real calendar.
import { applyEffects } from "@japacity/sim/testing";
import { qualityIn } from "@japacity/sim";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../../authority/GameProvider";
import { createGameStore } from "../../../authority/store";
import { gameAuthority, newGame } from "../../../shared/testing/fixtures";
import "../../../shared/testing/render";
import { clockWords } from "../../../shared/words/quality";
import { say } from "../../../shared/words/text";
import { PhoneApps } from "../PhoneApps";

const WEEKDAY = /\b(MON|TUE|WED|THU|FRI|SAT|SUN)\b/;

describe("a bill's slip", () => {
  test("[world:phone-holds-what-phones-hold] [world:top-band-is-lively-pill] given a bill to pay now, when its slip opens, then it is dated by the character's age as the band shows it, and carries no day of the real calendar", async () => {
    const game = newGame("scenario.ada");
    // Held funds are a bill paid by hand from Bills.
    applyEffects(game, [{ type: "obligation/open", obligation: "obligation.held-funds", principal: 1_000_000_000 }]);
    const view = game.view();
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    render(
      <GameProvider store={store}>
        <PhoneApps onClose={() => undefined} area="Yaba" now={() => new Date(2026, 9, 9, 12, 5)} talk={null} />
      </GameProvider>,
    );
    fireEvent.click(document.querySelector<HTMLElement>('[data-app="bills"]')!);
    const pay = document.querySelector<HTMLElement>("[data-pay]");
    if (pay === null) throw new Error("No bill to pay now.");
    fireEvent.click(pay);
    const slip = [...document.querySelectorAll<HTMLElement>("[role=dialog]")].at(-1)?.textContent ?? "";
    const age = qualityIn(view, "quality.age-months");
    expect(clockWords(view.qualities)).toBe(say("ui.world.clock", { years: Math.floor(age / 12), months: age % 12 }));
    expect(slip).toContain(clockWords(view.qualities).toUpperCase());
    expect(slip).not.toMatch(WEEKDAY);
  });
});
