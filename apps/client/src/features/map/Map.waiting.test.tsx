// The painted map's chunk on its way (R-WORLD-015): the bar alone, small, beside the close where the close
// stands, the one look every wait takes, never a spinner.
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { MapWaiting } from "./Map";
import { mapWords } from "./map.words";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

describe("the map on its way", () => {
  test("[R-WORLD-015] given the painted map's chunk still on its way, then the map shows only a small running bar beside its close, and the close still closes", () => {
    let closed = 0;
    render(<MapWaiting close={<button type="button" aria-label={mapWords("map.close")} onClick={() => (closed += 1)} data-map-close />} />);
    const waiting = document.querySelector("[data-map-waiting]");
    const bar = screen.getByRole("progressbar", { name: mapWords("map.loading") });
    expect(bar.dataset["loader"]).toBe("busy");
    expect(bar.classList.contains("loader-small")).toBe(true);
    expect([...(waiting?.children ?? [])]).toEqual([bar, screen.getByRole("button", { name: mapWords("map.close") })]);
    // The bar alone: no words beside it, and nothing that turns.
    expect(waiting?.textContent).toBe("");
    expect(waiting?.querySelector(".animate-spin")).toBeNull();
    screen.getByRole("button", { name: mapWords("map.close") }).click();
    expect(closed).toBe(1);
  });
});
