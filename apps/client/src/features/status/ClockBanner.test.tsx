// The status clock's banner (docs/rules/status.md R-STATUS-003), moved from the old status panel's test with it.
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView, richAbroadView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { sayCount } from "../../shared/words/text";
import { ClockBanner } from "./ClockBanner";

describe("the status clock", () => {
  test("[R-STATUS-003] given the job gone and the clock running, then the clock is the loudest thing: a banner in big type", async () => {
    await renderWithView(<ClockBanner />, richAbroadView());
    const banner = screen.getByRole("alert");
    expect(banner.textContent).toContain(sayCount("ui.status.clock", 2, { months: 2 }));
    // The big type is Rubik's bold now: the Danfo face keeps to the seal and the share cards.
    expect(banner.querySelector("[data-clock-figure]")?.textContent).toBe("2");
    expect(banner.querySelector("[data-clock-figure]")?.className).toContain("text-6xl");
    expect(banner.querySelector(".font-display")).toBeNull();
  });

  test("[R-STATUS-003] given no clock running, then there is no banner", async () => {
    await renderWithView(<ClockBanner />, abroadView());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
