// One count for months on screen: every month shown is the month the header
// counts. Played on the real engine, so each figure is checked against the
// month the thing really happens in, not against the raw number.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { DocumentView } from "../../features/document/DocumentView";
import { OfferView } from "../../features/offer/OfferView";
import { Japa } from "../../features/phone/apps/Japa";
import { agoWords } from "../../features/phone/apps/JapaWays";
import { phoneWords } from "../../features/phone/phone.words";
import { newGame, openOffer, richAbroadView, richView } from "../testing/fixtures";
import { renderWithView } from "../testing/render";
import { monthEnding, playerMonth } from "./format";
import { requirementSentence } from "./requirement";
import { byMonths, nameOf, say, words } from "./text";

const PASSPORT = "document.passport";

/** The month the header shows for a view. */
function header(view: PlayerView): number {
  return playerMonth(view.month);
}

describe("one count for months", () => {
  test("[R-TURN-001] given a new life at month 0, then the header counts it as month 1, and the month whose end is stamped 1 is month 1 too", () => {
    expect(playerMonth(0)).toBe(1);
    expect(monthEnding(1)).toBe(1);
    expect(monthEnding(1)).toBe(playerMonth(0));
  });

  test("[R-OFFER-005] given an offer that lapses when this month ends, then it says to answer this month, with no month number, and after the month it is gone", async () => {
    const game = newGame("scenario.ada");
    const offer = openOffer(game, "offer.nepa-bill");
    const view = game.view();
    await renderWithView(<OfferView />, view);
    expect(screen.getByText(say("ui.offer.expires", { when: byMonths(offer.expiresMonth, view.month) }))).toBeDefined();
    expect(screen.queryByText(/month \d+/i)).toBeNull();
    game.endTurn();
    expect(game.view().offers.some((open) => open.id === offer.id)).toBe(false);
  });

  test("[R-DOCUMENT-002] given a passport applied for, then the month it is said to be ready is the month whose report brings it", async () => {
    const game = newGame("scenario.ada");
    game.endTurn([{ activity: "activity.get-passport", param: null }]);
    const pending = game.view().documents.find((paper) => paper.id === PASSPORT && paper.state === "pending");
    if (pending?.readyMonth === null || pending === undefined) throw new Error("The passport is not on its way.");
    await renderWithView(<DocumentView />, game.view());
    const promised = monthEnding(pending.readyMonth);
    expect(screen.getByText(say("ui.document.pending", { month: promised }))).toBeDefined();

    let issuedIn: number | null = null;
    for (let guard = 0; guard < 24 && issuedIn === null; guard += 1) {
      const planning = header(game.view());
      const { lines } = game.endTurn();
      if (lines.some((line) => line.key === "line.document.issued" && line.params.document === PASSPORT)) issuedIn = planning;
    }
    expect(issuedIn).toBe(promised);
    const report = game.view().report;
    expect(report === null ? null : monthEnding(report.month)).toBe(promised);
  });

  test("[R-DOCUMENT-003] given a held paper, then the month it is valid until is the last month the header shows it counting", async () => {
    const view = richView();
    const held = view.documents.find((paper) => paper.state === "held" && paper.expiresMonth !== null);
    if (held === undefined || held.expiresMonth === null) throw new Error("No held paper that runs out.");
    await renderWithView(<DocumentView />, view);
    // It stops counting from the start of the month after `expiresMonth` months played: the header's next number.
    const last = monthEnding(held.expiresMonth);
    expect(playerMonth(held.expiresMonth)).toBe(last + 1);
    expect(screen.getByText(say("ui.document.expires", { month: last }))).toBeDefined();
  });

  test("[R-TURN-008] [R-GOAL-001] given a goal done as a month ended, then it is dated with the month of the report it was done in", async () => {
    const view = richAbroadView();
    const done = view.goals.done[0];
    if (done === undefined) throw new Error("No goal done in the view.");
    const report = { month: done.month, lines: [], japacityBefore: null, japacityAfter: null, attention: false };
    // Moved from the old goals panel to Japa's goals. The world shows no month number (R-WORLD-002), so the date
    // is said as months ago, counted from the report's own month: a goal done as the report's month ended reads as its
    // report does, "this month" when the report is this month's, and so on back.
    await renderWithView(<Japa />, { ...view, report });
    expect(document.querySelector(`[data-goal-done="${done.id}"]`)?.textContent).toBe(phoneWords("phone.japa.goal.done", { goal: nameOf(done.id), when: agoWords(done.month, view.month) }));
    expect(agoWords(done.month, view.month)).toBe(agoWords(report.month, view.month));
    expect(document.querySelector("[data-goals]")?.textContent).not.toMatch(/month \d+/i);
  });

  test("given a requirement on the months played, then it names the first month the header shows it met", () => {
    const value = 12;
    expect(requirementSentence({ type: "month/min", value })).toBe(say("ui.req.month-min", { value: value + 1 }));
  });

  test("[R-DOCUMENT-001] given a line that names the month something comes, then the month is the one whose end brings it", () => {
    expect(words("line.document.requested", { document: PASSPORT, month: 5 })).toContain(`month ${String(monthEnding(5))}`);
    expect(content.document[PASSPORT]).toBeDefined();
  });
});
