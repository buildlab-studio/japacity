import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView, decemberAbroadGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { PlaceView } from "./PlaceView";

const UK = content.country["country.uk"]!;

describe("the fare home from the view", () => {
  test("[R-PLACE-009] given December abroad, then the fare shown is the view's, the December factor in it, with the off-peak fare beside it", async () => {
    // The journey calendar makes the month of the flight a December, whichever month the recorded life flies in.
    const view = decemberAbroadGame().view();
    expect(view.place.fareHome!.amount).toBeGreaterThan(UK.fare);
    await renderWithView(<PlaceView />, view);
    expect(screen.getByText(say("ui.place.fare", { fare: formatMoney(view.place.fareHome!.amount, "GBP") }))).toBeDefined();
    expect(screen.getByText(say("ui.place.fare-december-now", { fare: formatMoney(UK.fare, "GBP") }))).toBeDefined();
  });

  test("[R-PLACE-009] given a return from the road on record, then it reads as from the road", async () => {
    const base = abroadView();
    const view: PlayerView = { ...base, place: { ...base.place, returns: [{ month: 20, shape: "assisted", country: null }] } };
    await renderWithView(<PlaceView />, view);
    expect(screen.getByText(say("ui.place.return-item", { month: 21, country: say("ui.place.road-name"), shape: say("ui.place.shape.assisted") }))).toBeDefined();
  });
});
