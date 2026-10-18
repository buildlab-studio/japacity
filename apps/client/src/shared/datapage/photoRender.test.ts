// The stills drawn of the figure (prologue:player-colours-on-looks): the door's figure in your colours comes back as an object
// address from an encoding that runs off the main thread, and every still is drawn on one renderer made once, so the
// figure's shaders compile once a visit, not on every colour (a renderer per colour held the main thread about
// 110 ms under 4x CPU throttling, the encoding and the compile most of it). The page's photo is kept with the person, so it
// stays an image's data address. The test DOM has no WebGL: the renderer and the canvas's encoders stand in.
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const made = vi.hoisted(() => ({ renderers: 0, renders: 0, sizes: [] as [number, number][], lost: false }));

vi.mock("three", async (importOriginal) => {
  const three = await importOriginal<typeof import("three")>();
  class StandInRenderer {
    constructor() {
      made.renderers += 1;
    }
    setPixelRatio(): void {}
    setClearColor(): void {}
    setSize(width: number, height: number): void {
      made.sizes.push([width, height]);
    }
    render(): void {
      made.renders += 1;
    }
    getContext(): { isContextLost: () => boolean } {
      return { isContextLost: () => made.lost };
    }
    dispose(): void {}
  }
  return { ...three, WebGLRenderer: StandInRenderer };
});
vi.mock("../three/manifest", () => ({ loadManifest: () => Promise.resolve({}) }));
vi.mock("../three/load", () => ({ loadModel: () => Promise.resolve(new Group()) }));
vi.mock("../three/people", () => ({
  figureOf: () => {
    const root = new Group();
    root.add(new Mesh(new BoxGeometry(0.5, 1.7, 0.3), new MeshBasicMaterial()));
    return { root };
  },
  poseFigure: () => undefined,
}));
vi.mock("../frontdoor/colours", () => ({ wear: () => undefined, readLook: () => null }));

const { renderFigure, renderPhoto } = await import("./photoRender");

const toBlob = vi.fn((done: BlobCallback, type?: string) => {
  // The encoding answers later, as a browser's does off the main thread.
  setTimeout(() => done(new Blob(["still"], { type: type ?? "image/png" })), 0);
});
const toDataURL = vi.fn(() => "data:image/webp;base64,UklGRg");
let addresses = 0;

beforeEach(() => {
  made.renders = 0;
  made.sizes.length = 0;
  made.lost = false;
  addresses = 0;
  toBlob.mockClear();
  toDataURL.mockClear();
  Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", { configurable: true, value: toBlob });
  Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", { configurable: true, value: toDataURL });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: () => `blob:still-${String((addresses += 1))}` });
});

afterEach(() => {
  Reflect.deleteProperty(HTMLCanvasElement.prototype, "toBlob");
  Reflect.deleteProperty(HTMLCanvasElement.prototype, "toDataURL");
  Reflect.deleteProperty(URL, "createObjectURL");
});

describe("the stills of the figure", () => {
  test("[prologue:player-colours-on-looks] given the figure drawn in two colours and the page's photo, then each figure is an object address encoded as webp off the main thread, the photo a data address, all on one renderer made once", async () => {
    const before = made.renderers;
    const first = renderFigure("shared/chr/chr_ada.glb", { skin: "skin2" }, "figure");
    const second = renderFigure("shared/chr/chr_ada.glb", { skin: "skin3" }, "cheer");
    expect(await first).toBe("blob:still-1");
    expect(await second).toBe("blob:still-2");
    expect(toBlob).toHaveBeenCalledTimes(2);
    expect(toBlob.mock.calls.map((call) => call.slice(1))).toEqual([
      ["image/webp", 0.85],
      ["image/webp", 0.85],
    ]);
    expect(await renderPhoto("shared/chr/chr_ada.glb", { skin: "skin2" }, 258)).toBe("data:image/webp;base64,UklGRg");
    expect(toDataURL).toHaveBeenCalledTimes(1);
    expect(made.renders).toBe(3);
    // Sized for each still: the figure's 400 by 800, then the photo's own box.
    expect(made.sizes[0]).toEqual([400, 800]);
    expect(made.sizes[2]?.[0]).toBe(258);
    expect(made.renderers - before).toBe(1);
  });

  test("[prologue:player-colours-on-looks] given the renderer's context taken back by the phone, when the next still is drawn, then a new renderer draws it", async () => {
    await renderFigure("shared/chr/chr_ada.glb", { skin: "skin4" }, "figure");
    const before = made.renderers;
    made.lost = true;
    expect(await renderFigure("shared/chr/chr_ada.glb", { skin: "skin5" }, "figure")).toMatch(/^blob:still-/);
    expect(made.renderers - before).toBe(1);
  });
});
