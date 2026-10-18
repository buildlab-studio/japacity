// The first-use labels (world:no-walkthrough-before-play): a map only ever opened by the nudge
// never leaves "Go places" standing at the Map's thumb. The map open, however it was opened, counts.
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import "../testing/render";
import { thumbsTapped, useFirstUse } from "./Walkthrough";
import { WALK_KEY } from "../kept/storage";

afterEach(() => {
  localStorage.clear();
});

describe("the map's first-use label", () => {
  test("[world:no-walkthrough-before-play] given a device that has not played, when the map opens by the nudge, then the map counts as found and its label goes; the phone's stays until its thumb is tapped", () => {
    const { result, rerender } = renderHook(({ open }: { open: boolean }) => useFirstUse(false, open), { initialProps: { open: false } });
    expect(result.current.tapped.size).toBe(0);
    rerender({ open: true });
    expect([...result.current.tapped]).toEqual(["map"]);
    expect([...thumbsTapped()]).toEqual(["map"]);
    expect(localStorage.getItem(WALK_KEY)).toBe("map");
    result.current.tap("phone");
    rerender({ open: false });
    expect(localStorage.getItem(WALK_KEY)).toBe("1");
  });
});
