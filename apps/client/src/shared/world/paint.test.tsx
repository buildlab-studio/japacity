// The two paints of the lively layer (docs/design/13-the-lively-layer.md, section 2; decision 0038): the same shapes in
// navy when the world's clock (clock.md R-CLOCK-033) says night, set as one attribute on <html>.
import { render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { applyPaint, devPaint, NIGHT_PAINT_LIVE, paintOf, usePaint } from "./paint";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

afterEach(() => {
  history.replaceState(null, "", "/");
  delete document.documentElement.dataset.paint;
});

function Painted({ live }: { live?: boolean } = {}) {
  const paint = usePaint(live);
  return <span data-painted={paint} />;
}

describe("the paint", () => {
  test("[R-CLOCK-033] given each part of the world's day, when its paint is read, then night is the night paint and every other part the day's", () => {
    expect(paintOf("morning")).toBe("day");
    expect(paintOf("afternoon")).toBe("day");
    expect(paintOf("evening")).toBe("day");
    expect(paintOf("night")).toBe("night");
  });

  test("[R-CLOCK-033] given the development switch for the paint, when it is read, then a development build takes the paint asked for, and a build for players never does", () => {
    expect(devPaint("?paint=night", true)).toBe("night");
    expect(devPaint("?clock=night&paint=day", true)).toBe("day");
    expect(devPaint("?paint=dusk", true)).toBeNull();
    expect(devPaint("", true)).toBeNull();
    expect(devPaint("?paint=night", false)).toBeNull();
  });

  test("[R-WORLD-021] given a paint, when it is applied, then the root carries it as data-paint", () => {
    const root = { dataset: {} as DOMStringMap };
    applyPaint("night", root);
    expect(root.dataset.paint).toBe("night");
    applyPaint("day", root);
    expect(root.dataset.paint).toBe("day");
  });

  test("[R-CLOCK-033] [R-WORLD-021] given the world's clock at night, when the hook runs, then the root takes the night paint, and it goes back to the day's when the hook is gone; held back, the clock's night paints the day", () => {
    history.replaceState(null, "", "/?clock=night");
    expect(NIGHT_PAINT_LIVE).toBe(true);
    const byDefault = render(<Painted />);
    expect(document.documentElement.dataset.paint).toBe("night");
    byDefault.unmount();
    const held = render(<Painted live={false} />);
    expect(document.documentElement.dataset.paint).toBe("day");
    held.unmount();
    const { unmount } = render(<Painted live />);
    expect(document.documentElement.dataset.paint).toBe("night");
    expect(document.querySelector("[data-painted]")?.getAttribute("data-painted")).toBe("night");
    unmount();
    expect(document.documentElement.dataset.paint).toBeUndefined();
  });

  test("[R-CLOCK-033] given the world's clock in the morning, when the hook runs, then the root takes the day paint; the paint switch wins over the clock", () => {
    history.replaceState(null, "", "/?clock=morning");
    const { unmount } = render(<Painted />);
    expect(document.documentElement.dataset.paint).toBe("day");
    unmount();
    history.replaceState(null, "", "/?clock=morning&paint=night");
    render(<Painted />);
    expect(document.documentElement.dataset.paint).toBe("night");
  });
});
