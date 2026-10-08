import { content, text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { App } from "../../App";
import { createGameStore } from "../../authority/store";
import { engineView, fakeAuthority, newGame, openOffer, recordedGame, viewAfter } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { lockWords } from "../../shared/words/locks";
import { nameOf, say, sayCount, words } from "../../shared/words/text";
import { ActivityView } from "../activity/ActivityView";
import { OfferView } from "../offer/OfferView";
import { RunDownBanner } from "./RunDownBanner";

const WELLBEING = "quality.wellbeing";
const health = content.tuning.health;

/** Ada with wellbeing pushed under the run-down line, played until the warning stands. */
function runDownView(): PlayerView {
  const game = newGame();
  for (let month = 0; month < 4 && !game.view().runDown; month += 1) {
    const wellbeing = game.state.quality[WELLBEING] ?? 0;
    viewAfter(game, [{ type: "quality/add", quality: WELLBEING, amount: 5 - wellbeing }]);
    game.endTurn();
  }
  const view = game.view();
  if (!view.runDown) throw new Error("The run-down warning did not stand.");
  return view;
}

describe("the run-down warning", () => {
  test("[R-HEALTH-007] given wellbeing under the line two months running, then the banner names it with wellbeing against the line", async () => {
    const view = runDownView();
    await renderWithView(<RunDownBanner />, view);
    const banner = screen.getByRole("alert");
    expect(within(banner).getByText(say("ui.health.run-down"))).toBeDefined();
    const wellbeing = view.qualities.find((quality) => quality.id === WELLBEING)?.value ?? 0;
    expect(within(banner).getByText(say("ui.health.run-down-figure", { quality: nameOf(WELLBEING), value: wellbeing, line: health.runDownBelow }))).toBeDefined();
  });

  test("[R-HEALTH-007] given the warning does not stand, then there is no banner", async () => {
    await renderWithView(<RunDownBanner />, engineView());
    expect(document.querySelector("[data-run-down]")).toBeNull();
  });

  test("[R-HEALTH-007] given the warning stands, then the banner is above every tab, whichever tab is open", async () => {
    const store = createGameStore(fakeAuthority(runDownView()));
    await store.getState().refresh();
    render(<App store={store} />);
    for (const tab of ["month", "you", "money", "japa", "news"]) {
      fireEvent.click(screen.getByRole("button", { name: say(`ui.tab.${tab}`) }));
      const banner = document.querySelector("[data-run-down]");
      expect(banner).not.toBeNull();
      expect(banner?.closest("[data-tab]")).toBeNull();
    }
  });
});

describe("illness and the slots it holds", () => {
  test("[R-HEALTH-007] [R-HEALTH-002] given the illness offer from the engine, then both prices are in its words and on its buttons before the choice", async () => {
    const game = newGame();
    const offer = openOffer(game, "offer.illness");
    await renderWithView(<OfferView />, game.view());
    const hospital = formatMoney(health.hospital, "NGN");
    const chemist = formatMoney(health.chemist, "NGN");
    expect(screen.getByText(words("offer.illness.body", { hospital: { currency: "NGN", amount: health.hospital }, chemist: { currency: "NGN", amount: health.chemist } }))).toBeDefined();
    expect(offer.terms).toEqual({ hospital: health.hospital, chemist: health.chemist });
    const thisMonth = say("ui.offer.lock", { slots: sayCount("ui.offer.lock.slots", 1, { count: 1 }), when: sayCount("ui.offer.lock.when", 1, { count: 1 }) });
    expect(screen.getByRole("button", { name: say("ui.offer.choice-cost", { choice: text["offer.illness.choice.hospital"]!, amount: `${hospital}, ${thisMonth}` }) })).toBeDefined();
    expect(screen.getByRole("button", { name: say("ui.offer.choice-cost", { choice: text["offer.illness.choice.chemist"]!, amount: chemist }) })).toBeDefined();
    expect(screen.getByRole("button", { name: say("ui.offer.choice-cost", { choice: text["offer.illness.choice.ignore"]!, amount: thisMonth }) })).toBeDefined();
  });

  test("[R-HEALTH-007] [R-TURN-009] given the hospital chosen, then the month plan names the illness lock and that it holds this month only", async () => {
    const game = newGame();
    const offer = openOffer(game, "offer.illness");
    game.accept({ type: "offer/choose", offer: offer.id, choice: "hospital" });
    const view = game.view();
    const lock = view.locks.find((held) => held.why === "illness");
    expect(lock).toBeDefined();
    await renderWithView(<ActivityView />, view);
    const shown = screen.getByText(lockWords(lock!, view.month));
    expect(shown.textContent).toBe(say("ui.locks.item", { slots: "1 slot", why: say("ui.locks.why.illness"), left: sayCount("ui.locks.left", 1, { count: 1 }) }));
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
    expect(screen.getByText(say("ui.locks.item", { slots: "2 slots", why: say("ui.locks.why.illness"), left: say("ui.locks.left", { count: 3, month: lock.untilMonth + 1 }) }))).toBeDefined();
  });

  test("[R-TURN-009] given each lock reason content uses, then each has words of its own", () => {
    const reasons = new Set<string>(["side-job", "illness", "village-burial", "court-date"]);
    for (const entry of Object.values(content.offer)) {
      for (const choice of entry.choices) for (const effect of choice.effects) if (effect.type === "turn/lock") reasons.add(effect.why);
    }
    for (const why of reasons) expect(text[`ui.locks.why.${why}`] ?? say(`ui.locks.why.${why}`)).not.toBe(say("ui.locks.why.other"));
  });

  test("[R-HEALTH-006] given a court date abroad, then its one choice says it holds a slot next month", async () => {
    const game = recordedGame("ada-careful");
    expect(game.view().place.where).toBe("abroad");
    // The court date comes over a loan still owed abroad: what a repossessed car leaves behind.
    viewAfter(game, [{ type: "obligation/open", obligation: "obligation.car-shortfall", principal: 120_000 }]);
    openOffer(game, "offer.court-date");
    await renderWithView(<OfferView />, game.view());
    const next = say("ui.offer.lock", { slots: sayCount("ui.offer.lock.slots", 1, { count: 1 }), when: say("ui.offer.lock.next") });
    expect(screen.getByRole("button", { name: say("ui.offer.choice-cost", { choice: text["offer.court-date.choice.attend"]!, amount: next }) })).toBeDefined();
  });
});
