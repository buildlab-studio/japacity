// The moment card over the month's results (docs/rules/moments.md R-MOMENT-006): the sheet and the card are two
// features, put together by the shell as App.tsx does, so the test that sees both lives beside the shell.
import type { PlayerView, ReportLine } from "@japacity/sim";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { MomentCard } from "./features/moment/MomentCard";
import { Results } from "./features/turn/Results";
import { engineView } from "./shared/testing/fixtures";
import { renderWithView } from "./shared/testing/render";
import { say } from "./shared/words/text";

const REFUSED: ReportLine = { key: "line.route.refused", params: { route: "route.uk-masters", reason: "interview" }, tone: "bad", attention: true, counts: [] };

/** A view with a month's report, so the results sheet has something to show. */
function reportedView(): PlayerView {
  const view = engineView();
  return { ...view, report: { month: 1, lines: [], japacityBefore: null, japacityAfter: null, attention: false } };
}

describe("the moment card over the results", () => {
  test("[R-MOMENT-006] given a month whose report holds a refusal, when the results sheet is up, then the card stands over it, and one tap on it leaves the sheet as it was", async () => {
    const { store, authority } = await renderWithView(
      <>
        <Results place="the family house" foot={<MomentCard over="results" />} />
        <MomentCard over="world" />
      </>,
      reportedView(),
    );
    authority.linesNext([REFUSED]);
    await act(() => store.getState().endMonth());
    await waitFor(() => expect(document.querySelector("[data-world-sheet='results']")).not.toBeNull());
    const card = await screen.findByRole("dialog", { name: say("moment.refused.kicker") });
    fireEvent.click(card.querySelector("[data-moment-card]")!);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: say("moment.refused.kicker") })).toBeNull());
    expect(document.querySelector("[data-world-sheet='results']")).not.toBeNull();
    expect(store.getState().reportOpen).toBe(true);
    expect(store.getState().momentCards).toEqual([]);
  });

});
