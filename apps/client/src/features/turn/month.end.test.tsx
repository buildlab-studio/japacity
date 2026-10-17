// The month's end in the world: an empty month rests in
// words; the month ends as the bed's sleep runs out (R-WORLD-025), sending the plan's
// commitments as they stand on the view's version; a refusal is said in content's words where the month is kept, the
// Calendar; and the results tell a split payment and a doubled salary once each. The interview's hold on the month is in
// features/city/City.interview.test.tsx; the staged wins in features/city/City.staged.test.tsx.
import { text } from "@japacity/content";
import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { Calendar } from "./Calendar";
import { Results } from "./Results";
import { freeTimeWords } from "./turn.words";

describe("the month's end in the world", () => {
  // The months held are not shown (decision 0034; World.clock.test.tsx).
  test("given a new life, then an empty month rests in words", () => {
    const view = engineView();
    // R-WORLD-007: the free time in words, never a count of slots.
    expect(freeTimeWords(0, view.freeSlots)).toBe(say("ui.month.rest"));
  });

  test("given an empty plan, when the month ends, then turn/end is sent with no slots on the view's version", async () => {
    const view = engineView();
    const { authority, store } = await renderWithView(<Calendar />, view);
    await act(() => store.getState().endMonth());
    await waitFor(() => expect(authority.sent).toEqual([{ type: "turn/end", slots: [], basedOn: view.v }]));
  });

  test("[R-WORLD-007] given a course started, when the month ends, then it is sent, and no Same again is offered: what is started carries on by itself", async () => {
    const view = engineView();
    const { authority, store } = await renderWithView(<Calendar />, view);
    expect(screen.queryByRole("button", { name: "Same again" })).toBeNull();
    // Decision 0035 (R-ACTIVITY-019): the coding course now answers at once and is never planned; the course that carries
    // on is a master's at home.
    act(() => {
      store.getState().addToPlan({ activity: "activity.masters-at-home", param: null });
    });
    expect(screen.queryByRole("button", { name: "Same again" })).toBeNull();
    await act(() => store.getState().endMonth());
    await waitFor(() => expect(authority.sent).toEqual([{ type: "turn/end", slots: [{ activity: "activity.masters-at-home", param: null }], basedOn: view.v }]));
  });

  test("given the authority rejects the month, then the rejection's words from content are shown on the Calendar", async () => {
    const { authority, store } = await renderWithView(<Calendar />, engineView());
    authority.rejectNext({ code: "no-turns", detail: "No turn is banked." });
    await act(() => store.getState().endMonth());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(text["reject.no-turns"]);
  });

  test("given a split payment and a doubled salary, then the results tell each once: one salary line, and the living once in what was kept", async () => {
    const rich = richView();
    const lines = [
      { key: "line.wallet.salary", params: { currency: "NGN", amount: 7_500_000 }, tone: "good" as const, attention: false, counts: [] },
      { key: "line.activity.salary", params: { job: "activity.job-teacher", currency: "NGN", amount: 7_500_000 }, tone: "good" as const, attention: false, counts: [] },
      { key: "line.wallet.upkeep", params: { currency: "NGN", amount: 5_305_951 }, tone: "bad" as const, attention: false, counts: [] },
      { key: "line.wallet.upkeep", params: { currency: "NGN", amount: 4_194_049 }, tone: "bad" as const, attention: false, counts: [] },
    ];
    const { store } = await renderWithView(<Results place="the family house" />, { ...rich, setpiece: null, interview: null, report: { ...rich.report!, lines } });
    act(() => store.getState().setReportOpen(true));
    const sheet = await waitFor(() => {
      const found = document.querySelector<HTMLElement>("[data-world-sheet='results']");
      if (found === null) throw new Error("No results.");
      return found;
    });
    expect(within(sheet).getAllByText(/^Salary/)).toHaveLength(1);
    // The living's two halves are one ₦95,000 out: what was kept is the salary less it, counted once.
    expect(within(sheet).getByText("-₦20,000")).toBeDefined();
  });
});
