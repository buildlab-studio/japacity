// The figure in the player's own colours (prologue:player-colours-on-looks) is drawn once a colour as a still. Drawing it holds
// the main thread (under 4x CPU throttling, 110 to 440 ms a colour), so a tapped swatch answers first: the figure is
// drawn only once the frame with the swatch's tick has painted, and of colours tapped faster than that only the last
// is drawn.
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { LookStyle } from "./style";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

const renderFigure = vi.fn((file: string, style: LookStyle | undefined) => Promise.resolve(file.includes("chr_ada") ? `data:image/webp;own-${style?.skin ?? ""}` : `blob:${file}-${style?.skin ?? ""}`));
vi.mock("../datapage/photoRender", () => ({ renderFigure }));
vi.mock("./Gate", async (importOriginal) => ({ ...(await importOriginal<typeof import("./Gate")>()), canDraw: () => true }));
vi.mock("../three/manifest", () => ({ loadManifest: () => new Promise(() => undefined), assetUrl: () => null }));

const { FigurePicture, STILLS_KEPT } = await import("./LookPicture");

/** Every object address let go, in turn. */
const revoked: string[] = [];

describe("the figure in your colours", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    renderFigure.mockClear();
    revoked.length = 0;
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: (address: string) => revoked.push(address) });
  });
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(URL, "revokeObjectURL");
  });

  test("[prologue:player-colours-on-looks] given a colour picked, when the figure would be drawn in it, then it is drawn only after the next frame has painted, and then shows", async () => {
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

  test("[prologue:player-colours-on-looks] given three colours tapped within one frame, when the frame has painted, then only the last colour is drawn", async () => {
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

  test("[prologue:player-colours-on-looks] given more colours drawn than are kept, when each picture is replaced by the next, then the oldest stills off screen are revoked and the one shown never is", async () => {
    const skins = ["skin1", "skin2", "skin3", "skin4", "skin5", "skin6", "skin7", "skin8"] as const;
    expect(skins.length).toBeGreaterThan(STILLS_KEPT + 1);
    const shown = render(<FigurePicture look="chr_kola" style={{ skin: "skin1" }} />);
    for (const skin of skins) {
      shown.rerender(<FigurePicture look="chr_kola" style={{ skin }} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(40);
      });
      expect(document.querySelector("[data-figure]")?.getAttribute("src")).toBe(`blob:shared/chr/chr_kola.glb-${skin}`);
    }
    const out = skins.length - STILLS_KEPT;
    expect(revoked).toEqual(skins.slice(0, out).map((skin) => `blob:shared/chr/chr_kola.glb-${skin}`));
    // A colour still kept shows again at once, with nothing drawn.
    renderFigure.mockClear();
    const kept = skins[out] ?? "skin1";
    shown.rerender(<FigurePicture look="chr_kola" style={{ skin: kept }} />);
    expect(document.querySelector("[data-figure]")?.getAttribute("src")).toBe(`blob:shared/chr/chr_kola.glb-${kept}`);
    expect(renderFigure).not.toHaveBeenCalled();
  });

  test("[prologue:player-colours-on-looks] given the figure's picture gone from the screen, when newer stills are kept, then its still is kept a while and revoked once it falls out of the few kept", async () => {
    const gone = render(<FigurePicture look="chr_tayo" style={{ skin: "skin1" }} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40);
    });
    gone.unmount();
    expect(revoked).not.toContain("blob:shared/chr/chr_tayo.glb-skin1");
    const next = render(<FigurePicture look="chr_tayo" style={{ skin: "skin2" }} />);
    for (const skin of ["skin3", "skin4", "skin5", "skin6", "skin7", "skin8"] as const) {
      next.rerender(<FigurePicture look="chr_tayo" style={{ skin }} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(40);
      });
    }
    expect(revoked).toContain("blob:shared/chr/chr_tayo.glb-skin1");
    expect(revoked).not.toContain("blob:shared/chr/chr_tayo.glb-skin8");
    next.unmount();
  });
});
