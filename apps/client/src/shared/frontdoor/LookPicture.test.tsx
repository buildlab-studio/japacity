// The figure in the player's own colours (prologue.md R-PROLOGUE-015) is drawn once a colour as a still. Drawing it holds
// the main thread (under 4x CPU throttling, 110 to 440 ms a colour), so a tapped swatch answers first: the figure is
// drawn only once the frame with the swatch's tick has painted, and of colours tapped faster than that only the last
// is drawn.
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { LookStyle } from "./style";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

const renderFigure = vi.fn((_file: string, style: LookStyle | undefined) => Promise.resolve(`data:image/webp;own-${style?.skin ?? ""}`));
vi.mock("../datapage/photoRender", () => ({ renderFigure }));
vi.mock("./Gate", async (importOriginal) => ({ ...(await importOriginal<typeof import("./Gate")>()), canDraw: () => true }));
vi.mock("../three/manifest", () => ({ loadManifest: () => new Promise(() => undefined), assetUrl: () => null }));

const { FigurePicture } = await import("./LookPicture");

describe("the figure in your colours", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    renderFigure.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("[R-PROLOGUE-015] given a colour picked, when the figure would be drawn in it, then it is drawn only after the next frame has painted, and then shows", async () => {
    render(<FigurePicture look="chr_ada" style={{ skin: "skin3" }} />);
    // The frame with the swatch's tick comes first: nothing is drawn in the tap's own task.
    await act(async () => {
      await Promise.resolve();
    });
    expect(renderFigure).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40);
    });
    expect(renderFigure).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-figure]")?.getAttribute("data-figure-worn")).toBe("own");
  });

  test("[R-PROLOGUE-015] given three colours tapped within one frame, when the frame has painted, then only the last colour is drawn", async () => {
    const shown = render(<FigurePicture look="chr_ada" style={{ skin: "skin4" }} />);
    shown.rerender(<FigurePicture look="chr_ada" style={{ skin: "skin5" }} />);
    shown.rerender(<FigurePicture look="chr_ada" style={{ skin: "skin6" }} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40);
    });
    expect(renderFigure).toHaveBeenCalledTimes(1);
    expect(renderFigure.mock.calls[0]?.[1]).toEqual({ skin: "skin6" });
    expect(document.querySelector("[data-figure]")?.getAttribute("src")).toBe("data:image/webp;own-skin6");
  });
});
