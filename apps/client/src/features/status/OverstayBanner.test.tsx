// The overstay's warning over the phone's apps (status:view-shows-status): where the status clock stands, the stage in plain
// words, so whichever app is open the player knows where the life stands.
import { cleanup, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView } from "../../shared/testing/fixtures";
import { graceView, noticeGame, overstayingGame } from "../../shared/testing/overstay";
import { renderWithView } from "../../shared/testing/render";
import { overstayWords } from "../../shared/words/overstay";
import { OverstayBanner } from "./OverstayBanner";

describe("the overstay's warning", () => {
  test("[status:grace-before-overstaying] [status:view-shows-status] given the grace, then the warning says the months of grace left and what can still be applied for, in the quiet colour", async () => {
    const view = graceView();
    await renderWithView(<OverstayBanner />, view);
    const banner = screen.getByRole("status");
    expect(banner.dataset.overstayBanner).toBe("grace");
    expect(banner.textContent).toContain(overstayWords(view)!.title);
    expect(banner.textContent).toContain(overstayWords(view)!.line);
  });

  test("[status:view-shows-status] [status:detection-gives-notice] given the overstay and then a notice, then the warning is an alert that says the stage", async () => {
    for (const view of [overstayingGame().view(), noticeGame().view()]) {
      await renderWithView(<OverstayBanner />, view);
      const banner = screen.getByRole("alert");
      expect(banner.dataset.overstayBanner).toBe(overstayWords(view)!.stage);
      expect(banner.textContent).toContain(overstayWords(view)!.title);
      cleanup();
    }
  });

  test("[status:view-shows-status] given a visa that holds, then there is no warning", async () => {
    await renderWithView(<OverstayBanner />, abroadView());
    expect(document.querySelector("[data-overstay-banner]")).toBeNull();
  });
});
