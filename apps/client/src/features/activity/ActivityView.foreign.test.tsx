// A cost in another money (world:one-action-one-sheet; wallet:foreign-fee-payment-order): the endorsement costs £561, and
// while the bank's queue is up the naira leg of a foreign fee is refused (wallet:foreign-fee-payment-order), so with ₦2,110,450 in the bank
// the card must not say only "You cannot pay for this now". It says the money and the way. Played on the real engine.
import { content } from "@japacity/content";
import type { ActivityOption, PlayerView, World } from "@japacity/sim";
import { standInWorld } from "@japacity/sim";
import { setPockets, start } from "@japacity/sim/testing";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { nameOf, say } from "../../shared/words/text";
import { ActivityPicker } from "./ActivityView";

const ENDORSE = "activity.apply-endorsement";

/** The stand-in world with the bank's queue up, as the dollar squeeze's news sets it. */
function queuedWorld(tick: number): World {
  const world = standInWorld("world-1", tick, content);
  return { ...world, vars: { ...world.vars, "var.fx-bank-queue": 2 } };
}

/** The endorsement's card as the engine prices it, with the naira the developer held and the pounds given. */
function endorsement(pounds: number): { view: PlayerView; option: ActivityOption } {
  const game = start({ scenario: "scenario.graduate", content, worldAt: queuedWorld });
  setPockets(game, { NGN: 211_045_000, GBP: pounds });
  const view = game.view();
  const option = view.activities.find((entry) => entry.id === ENDORSE);
  if (option === undefined) throw new Error("The view has no endorsement.");
  // Its needs met, as at 23 years 10 months: only the money stands in the way.
  return { view, option: { ...option, allowed: true, missing: [] } };
}

const addButton = (): HTMLButtonElement => screen.getByRole<HTMLButtonElement>("button", { name: nameOf(ENDORSE) });

describe("a cost in another money", () => {
  test("[world:one-action-one-sheet] [wallet:foreign-fee-payment-order] given the endorsement's £561 with naira enough in the bank but the bank's queue up, when its card shows, then the card says it needs £561 in pounds and where to change money, and the button says it needs pounds", async () => {
    const { view, option } = endorsement(0);
    expect(option.affordable).toBe(false);
    const fee = option.cost[0]!;
    expect(fee.currency).toBe("GBP");
    expect(formatMoney(fee.amount, "GBP")).toBe("£561");
    await renderWithView(<ActivityPicker only={[ENDORSE]} />, { ...view, activities: [option] });
    expect(document.body.textContent).toContain("Needs £561 in pounds. Change money at the bank or with the FX man.");
    expect(document.body.textContent).not.toContain(say("ui.activity.cannot-pay"));
    expect(addButton().disabled).toBe(true);
    expect(addButton().querySelector("[data-after]")?.textContent).toBe("Needs pounds");
  });

  test("[world:one-action-one-sheet] [wallet:foreign-fee-payment-order] given some pounds held but fewer than the fee, when the card shows, then it says how many more pounds it needs", async () => {
    const { view, option } = endorsement(16_100);
    expect(option.affordable).toBe(false);
    await renderWithView(<ActivityPicker only={[ENDORSE]} />, { ...view, activities: [option] });
    expect(document.body.textContent).toContain(`Needs ${formatMoney(option.cost[0]!.amount - 16_100, "GBP")} more in pounds. Change money at the bank or with the FX man.`);
  });

  test("[world:one-action-one-sheet] given the pounds held, when the card shows, then nothing says it needs pounds", async () => {
    const { view, option } = endorsement(56_100);
    expect(option.affordable).toBe(true);
    await renderWithView(<ActivityPicker only={[ENDORSE]} />, { ...view, activities: [option] });
    expect(document.body.textContent).not.toContain("in pounds");
  });
});
