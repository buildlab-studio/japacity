// The page's photo where WebGL can draw (prologue.md R-PROLOGUE-015): as made too, at the size
// the box shows it times the screen's pixel ratio. The render itself needs WebGL, so it stands in here and reports the
// size it was asked for; the picture on a Pixel 7 is in the build notes.
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { keepPerson, readPerson } from "../../authority/person";
import { DataPage } from "./DataPage";
import { photoHeight } from "./photo.size";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

const asked = vi.hoisted(() => [] as { file: string; style: unknown; width: number }[]);

vi.mock("./photoRender", () => ({
  renderPhoto: (file: string, style: unknown, width: number) => {
    asked.push({ file, style, width });
    return Promise.resolve(`data:image/webp;base64,${String(width)}x${String(photoHeight(width))}`);
  },
}));
vi.mock("../frontdoor/Gate", async (importOriginal) => ({ ...(await importOriginal<typeof import("../frontdoor/Gate")>()), canDraw: () => true }));

const ratio = window.devicePixelRatio;

beforeEach(() => {
  asked.length = 0;
  // A Pixel 7's screen.
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2.625 });
});

afterEach(() => {
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: ratio });
  localStorage.clear();
});

const fields = { name: "Kola", age: "", path: "", ready: "", photo: "look-picture.webp" };
const shown = (): string | null => document.querySelector("[data-photo] img[data-photo-made]")?.getAttribute("src") ?? null;

describe("the page's photo where WebGL draws", () => {
  test("[R-PROLOGUE-015] given the look as made on a Pixel 7, when the page prints, then the figure is drawn as made at the box's 98 px times 2.625, 258 by 337, never the look's small picture, and kept with the person with its width", async () => {
    keepPerson({ look: "chr_tunde", name: "Kola", archetype: null });
    render(<DataPage page={{ ...fields, wear: { look: "chr_tunde" } }} />);
    await waitFor(() => expect(shown()).toBe("data:image/webp;base64,258x337"));
    expect(asked).toEqual([{ file: "shared/chr/chr_tunde.glb", style: undefined, width: 258 }]);
    expect(document.querySelector("[data-photo] img:not([data-photo-made])")).toBeNull();
    expect(readPerson()).toMatchObject({ photo: "data:image/webp;base64,258x337", photoPx: 258 });
  });

  test("[R-PROLOGUE-015] given a style on a screen of ratio 3 and one of ratio 1, then the photo is drawn 294 by 384 and 196 by 256: the ratio held to 2 to 3", async () => {
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 3 });
    const { unmount } = render(<DataPage page={{ ...fields, wear: { look: "chr_ada", style: { top: "wine" } } }} />);
    await waitFor(() => expect(shown()).toBe("data:image/webp;base64,294x384"));
    unmount();
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });
    render(<DataPage page={{ ...fields, wear: { look: "chr_ada", style: { top: "teal" } } }} />);
    await waitFor(() => expect(shown()).toBe("data:image/webp;base64,196x256"));
    expect(asked.map((one) => one.width)).toEqual([294, 196]);
  });

  test("[R-PROLOGUE-015] given a photo kept as wide as the screen wants, then it is shown and nothing is drawn again", async () => {
    render(<DataPage page={{ ...fields, wear: { look: "chr_bisi", photo: "data:image/webp;base64,kept", photoPx: 258 } }} />);
    await waitFor(() => expect(shown()).toBe("data:image/webp;base64,kept"));
    expect(asked).toEqual([]);
  });
});
