// Whether the door can draw (prologue.md R-PROLOGUE-015): the figure in the player's own colours and the page's photo are
// drawn only where WebGL 2 can. Asking makes a context, and the door asks on every look, every colour and at Begin, so
// it is asked once a visit and the context made to ask is let go at once (a run through the door made about 25
// contexts, three of them at Begin, where one would do).
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

describe("whether the door can draw", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, "WebGL2RenderingContext");
  });

  test("[R-PROLOGUE-015] given a phone that draws, when the door asks again and again, then one context is made and it is let go at once", async () => {
    Object.defineProperty(window, "WebGL2RenderingContext", { value: class {}, configurable: true });
    const loseContext = vi.fn();
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({ getExtension: (name: string) => (name === "WEBGL_lose_context" ? { loseContext } : null) }) as never);
    const { canDraw } = await import("./Gate");
    expect([canDraw(), canDraw(), canDraw(), canDraw()]).toEqual([true, true, true, true]);
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(getContext).toHaveBeenCalledWith("webgl2");
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  test("[R-PROLOGUE-015] given a phone with no WebGL 2, when the door asks again, then the answer stays no and no context is asked for", async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
    const { canDraw } = await import("./Gate");
    expect([canDraw(), canDraw()]).toEqual([false, false]);
    expect(getContext).not.toHaveBeenCalled();
  });

  test("[R-PROLOGUE-015] given a phone whose context is refused, when the door asks again, then the answer stays no from the first ask", async () => {
    Object.defineProperty(window, "WebGL2RenderingContext", { value: class {}, configurable: true });
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
    const { canDraw } = await import("./Gate");
    expect([canDraw(), canDraw(), canDraw()]).toEqual([false, false, false]);
    expect(getContext).toHaveBeenCalledTimes(1);
  });
});
