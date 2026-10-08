import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richAbroadView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say, sayCount } from "../../shared/words/text";
import { ActivityView } from "./ActivityView";

describe("the side job and slots held", () => {
  test("[R-TURN-009] given a slot held by a side job, then the plan says which slot is held, why and until when", async () => {
    await renderWithView(<ActivityView />, richAbroadView());
    expect(screen.getByText(sayCount("ui.locks.item", 1, { slots: 1, why: say("ui.locks.why.side-job"), month: 60 }))).toBeDefined();
  });

  test("[R-ACTIVITY-010] given a side job held, when it is quit, then activity/quit is sent with side true", async () => {
    const view = richAbroadView();
    const { authority } = await renderWithView(<ActivityView />, view);
    fireEvent.click(screen.getByRole("button", { name: say("ui.side.quit") }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.side.quit-yes") }));
    await waitFor(() => expect(authority.sent).toEqual([{ type: "activity/quit", side: true, basedOn: view.v }]));
  });

  test("given no side job, then there is nothing to quit", async () => {
    await renderWithView(<ActivityView />, engineView());
    expect(screen.queryByRole("button", { name: say("ui.side.quit") })).toBeNull();
  });
});
