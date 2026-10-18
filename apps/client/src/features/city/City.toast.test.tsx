// Toasts that answer every tap (docs/design/13-the-lively-layer.md sections 2 and 7):
// money in from an act done in the world slides in under the band with a picture, what
// it was and the figure, a coin flying to the band's counter; it goes after a few seconds; never at the month's turn.
import { act } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { nameOf } from "../../shared/words/text";
import { MONEY_TOAST_MS } from "../../shared/world/MoneyToast";
import { markTaught } from "../../shared/world/taught";
import { City } from "./City";

const GIG = "activity.side-gig";

describe("toasts that answer every tap", () => {
  test("[world:things-are-tappable-models] [world:motions-under-half-second] given an act done in the world that brings money in, when its answer lands, then a toast under the band shows its picture, its name and the figure in, a coin flies to the counter, and it goes after a few seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const view = engineView();
      markTaught("title", view.scenario);
      const { store } = await renderWithView(<City world results={() => <p />} />, view);
      const paid = { ...view, pockets: { ...view.pockets, NGN: { ...view.pockets.NGN, cash: view.pockets.NGN.cash + 500_000 } } };
      act(() => {
        store.setState({ view: paid, lines: [{ key: `line.activity.${GIG.slice("activity.".length)}.now`, params: { activity: GIG }, tone: "good", attention: false, counts: [] }] });
      });
      const toast = document.querySelector<HTMLElement>("[data-money-toast]");
      expect(toast?.textContent).toContain(nameOf(GIG));
      expect(toast?.querySelector("[data-money-toast-amount]")?.textContent).toContain(`+${formatMoney(500_000, "NGN")}`);
      expect(toast?.querySelector("[data-tile]")?.getAttribute("data-tile")).toBe(GIG);
      expect(document.querySelector("[data-coin]")).not.toBeNull();
      act(() => {
        vi.advanceTimersByTime(MONEY_TOAST_MS + 50);
      });
      expect(document.querySelector("[data-money-toast]")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  test("[world:month-end-results-sheet] given the month turning with money in, when the results open, then no toast stands over them: the results tell the month", async () => {
    const view = engineView();
    markTaught("title", view.scenario);
    const { store } = await renderWithView(<City world results={() => <p />} />, view);
    act(() => {
      store.setState({ reportOpen: true, view: { ...view, pockets: { ...view.pockets, NGN: { ...view.pockets.NGN, cash: view.pockets.NGN.cash + 500_000 } } } });
    });
    expect(document.querySelector("[data-money-toast]")).toBeNull();
  });
});
