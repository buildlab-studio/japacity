// The price and the balance on every priced act (docs/rules/world.md R-WORLD-006; decision 0013): the button says the
// act and its price ("Indomie and egg · ₦1,500"); under it the balance before stands struck beside the balance after,
// from the view's pockets and the act's cost; nothing moves until the tap; short, the button says how much instead. The
// time in words stays beside it, and what the act does, in words, on one line.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ActivityPicker } from "../features/activity/ActivityView";
import { RideSheet } from "../features/map/RideSheet";
import { engineView } from "../shared/testing/fixtures";
import { found, renderWithView } from "../shared/testing/render";
import { effectWordsOf, timeWordsOf } from "../shared/words/acts";
import { formatMoney } from "../shared/words/format";
import { nameOf, say } from "../shared/words/text";
import { AskSheet } from "../shared/world/AskSheet";
import type { Ask } from "../shared/world/contract";

/** A meal of your own, bought at its price (the family house's pot is free). */
const COOK = "activity.cook-own";
/** The meal's price in kobo, ₦1,500, read against content in the first test. */
const MEAL = 150_000;
const money = (amount: number): string => formatMoney(amount, "NGN");

/** A view whose naira is `cash` in hand and `bank` in the bank. */
function holding(cash: number, bank: number): PlayerView {
  const view = engineView();
  return { ...view, pockets: { ...view.pockets, NGN: { ...view.pockets.NGN, cash, bank } } };
}

function meal(act: () => void = () => undefined): Ask {
  return { form: "card", icon: "hand", who: "The family house", title: nameOf(COOK), line: "Indomie and egg.", cost: { amount: MEAL, currency: "NGN" }, button: nameOf(COOK), when: "now", time: "A morning", does: "Fills you, lifts you", priced: true, act, dismiss: () => undefined };
}

describe("the price and the balance", () => {
  test("[R-WORLD-006] given ₦48,500 in hand and the meal's card, when it opens, then the button says Indomie and egg · ₦1,500, and under it ₦48,500 struck beside ₦47,000; nothing moves until the tap", async () => {
    expect(content.activity[COOK]?.cost[0]?.amount).toBe(MEAL);
    const act = vi.fn();
    const { store } = await renderWithView(<AskSheet ask={meal(act)} formatMoney={(amount, currency) => formatMoney(amount, currency as "NGN")} />, holding(4_850_000, 0));
    const main = found("[data-ask-main]");
    expect(main.textContent).toBe("Indomie and egg · ₦1,500");
    expect(main.textContent).not.toMatch(/left/);
    const before = found("[data-balance-before]");
    const after = found("[data-balance-after]");
    expect(before.tagName).toBe("S");
    expect([before.textContent, before.getAttribute("data-balance-before")]).toEqual(["₦48,500", "4850000"]);
    expect([after.textContent, after.getAttribute("data-balance-after")]).toEqual(["₦47,000", "4700000"]);
    // The price is on the button, so no second row says it again; the time and what it does stand above.
    expect(document.querySelector("[data-ask-form]")?.textContent).not.toContain(say("ui.world.costs"));
    expect(found("[data-ask-time]").textContent).toBe(`${say("ui.world.takes")}A morning`);
    expect(found("[data-ask-does]").textContent).toBe(`${say("ui.world.does")}Fills you, lifts you`);
    expect(store.getState().view?.pockets.NGN.cash).toBe(4_850_000);
    fireEvent.click(main);
    expect(act).toHaveBeenCalledTimes(1);
  });

  test("[R-WORLD-006] given cash and bank together, when the balance is read, then before is both and after is both less the price", async () => {
    await renderWithView(<AskSheet ask={meal()} formatMoney={(amount, currency) => formatMoney(amount, currency as "NGN")} />, holding(50_000, 2_000_000));
    expect(found("[data-balance-before]").getAttribute("data-balance-before")).toBe("2050000");
    expect(found("[data-balance-after]").getAttribute("data-balance-after")).toBe(String(2_050_000 - MEAL));
  });

  test("[R-WORLD-006] given less than the meal's price, when its card opens, then the button is shut and says how much is short, the one exception, with no balance under it", async () => {
    await renderWithView(<AskSheet ask={meal()} formatMoney={(amount, currency) => formatMoney(amount, currency as "NGN")} />, holding(100_000, 0));
    const main = found("[data-ask-main]") as HTMLButtonElement;
    expect(main.disabled).toBe(true);
    expect(main.textContent).toContain(say("ui.world.short", { amount: money(MEAL - 100_000) }));
    expect(main.textContent).toContain("₦1,500");
    expect(document.querySelector("[data-balance]")).toBeNull();
  });

  test("[R-WORLD-006] given the meal on a sheet of several, when its card shows, then its button says the meal and its price and the balance stands under it, struck before and after", async () => {
    const view = holding(4_850_000, 0);
    await renderWithView(<ActivityPicker only={[COOK]} />, view);
    const card = found("[data-activity-picker] li");
    expect(card.querySelector("button")?.textContent).toContain("Indomie and egg · ₦1,500");
    expect(card.querySelector("button")?.textContent).not.toMatch(/left/);
    expect(card.querySelector("[data-balance-before]")?.textContent).toBe("₦48,500");
    expect(card.querySelector("[data-balance-after]")?.textContent).toBe("₦47,000");
    expect(card.querySelector("[data-does]")?.textContent).toBe("Fills you, lifts you");
    // Chips earn their place (design page 13 section 2): a morning is no chip; past a morning the time shows.
    expect(card.querySelector("[data-time]")).toBeNull();
  });

  test("[R-WORLD-006] given a stop picked on the map, when the ride sheet shows, then the button says the ride and its fare, and the balance before is struck beside the balance after; short, it says how much", () => {
    const pin = { id: "place.yaba", name: "Yaba", state: "can" as const, position: { latE3: 0, lonE3: 0 }, things: 2 };
    const ways = [{ id: "danfo" as const, label: "Danfo", fare: 30_000, minutes: 25 }];
    const { unmount } = render(<RideSheet pin={pin} home={false} ways={ways} have={4_850_000} formatMoney={money} onChoose={() => undefined} onClose={() => undefined} />);
    expect(found("[data-ride-main]").textContent).toBe("Go by danfo · ₦300");
    expect(found("[data-balance-before]").textContent).toBe("₦48,500");
    expect(found("[data-balance-after]").textContent).toBe("₦48,200");
    unmount();
    render(<RideSheet pin={pin} home={false} ways={ways} have={10_000} formatMoney={money} onChoose={() => undefined} onClose={() => undefined} />);
    expect(found("[data-ride-main]").textContent).toContain("₦200 short");
    expect(document.querySelector("[data-balance]")).toBeNull();
  });

  test("[R-WORLD-006] [R-QUALITY-007] given the room's acts, when what each does is said, then the belly fills, the energy rests, wellbeing lifts and a skill has its figure, short, on one line, and the body never a number", () => {
    expect(effectWordsOf(COOK)).toBe("Fills you, lifts you");
    expect(effectWordsOf("activity.nap")).toBe("Rests you, lifts you");
    expect(effectWordsOf("activity.study-english")).toBe("+2 English");
    expect(effectWordsOf("activity.family-time")).toBe("Lifts you");
    expect(effectWordsOf("activity.fetch-water")).toBeNull();
    for (const id of [COOK, "activity.nap", "activity.cook-jollof", "activity.bucket-bath"]) expect(effectWordsOf(id) ?? "").not.toMatch(/\d/);
  });

  test("[R-ACTIVITY-018] [R-ACTIVITY-020] given gist, which takes no time, when its time is said, then it says none; a morning's act says a morning", () => {
    expect(content.activity["activity.family-time"]?.halfDays).toBe(0);
    expect(timeWordsOf("activity.family-time")).toBeNull();
    expect(timeWordsOf(COOK)).toBe("A morning");
  });
});
