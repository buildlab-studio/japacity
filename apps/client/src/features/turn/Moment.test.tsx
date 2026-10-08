import type { ReportLine } from "@japacity/sim";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say, words } from "../../shared/words/text";
import { Moment } from "./Moment";
import { TurnView } from "./TurnView";

const SALARY: ReportLine = {
  key: "line.activity.salary",
  params: { job: "activity.job-teacher", amount: { currency: "NGN", amount: 7_500_000 } },
  tone: "good",
  attention: false,
  counts: [],
  big: true,
};

const PLAIN: ReportLine = { key: "line.activity.played", params: { activity: "activity.rest" }, tone: "plain", attention: false, counts: [] };

describe("the staged wins", () => {
  test("[R-LUCK-008] given a month whose lines carry a big one, when it ends, then the big line has the whole screen before the report opens", async () => {
    const view = engineView();
    const { authority, store } = await renderWithView(
      <>
        <TurnView />
        <Moment />
      </>,
      { ...view, report: { month: 1, lines: [PLAIN, SALARY], japacityBefore: null, japacityAfter: null, attention: false } },
    );
    authority.linesNext([PLAIN, SALARY]);
    await act(() => store.getState().endMonth());

    const moment = await screen.findByRole("dialog");
    expect(within(moment).getByText(words(SALARY.key, SALARY.params))).toBeDefined();
    expect(screen.queryByRole("dialog", { name: say("ui.report.title", { month: 1 }) })).toBeNull();

    fireEvent.click(within(moment).getByRole("button", { name: say("ui.moment.done") }));
    expect(await screen.findByRole("dialog", { name: say("ui.report.title", { month: 1 }) })).toBeDefined();
  });

  test("given a month with no big line, then the report opens at once", async () => {
    const view = engineView();
    const { authority, store } = await renderWithView(
      <>
        <TurnView />
        <Moment />
      </>,
      { ...view, report: { month: 1, lines: [PLAIN], japacityBefore: null, japacityAfter: null, attention: false } },
    );
    authority.linesNext([PLAIN]);
    await act(() => store.getState().endMonth());
    expect(await screen.findByRole("dialog", { name: say("ui.report.title", { month: 1 }) })).toBeDefined();
    expect(store.getState().moments).toEqual([]);
  });
});
