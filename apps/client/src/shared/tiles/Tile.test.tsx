// The picture on a choice (design page 09, the pictures): a model's published tile, or the emoji standing in for one.
import { render, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { Tile } from "./Tile";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

vi.mock("../three/manifest", async (original) => {
  const real = await original<typeof import("../three/manifest")>();
  return { ...real, loadManifest: () => Promise.resolve({ files: { "tiles/prop_bed.png": "tiles/prop_bed.0123456789ab.png" } }) };
});

describe("a tile", () => {
  test("given an act with a model, when it is drawn, then it shows the model's published tile at the size asked, named by its id", async () => {
    const { container } = render(<Tile of="activity.nap" size={48} className="extra" />);
    const tile = container.querySelector<HTMLElement>("[data-tile='activity.nap']")!;
    expect(tile.hasAttribute("data-stand-in")).toBe(false);
    expect(tile.className).toContain("extra");
    expect(tile.style.width).toBe("48px");
    expect(tile.style.height).toBe("48px");
    await waitFor(() => expect(tile.querySelector("img")?.getAttribute("src")).toMatch(/assets\/tiles\/prop_bed\.0123456789ab\.png$/));
    expect(tile.querySelector("img")?.getAttribute("alt")).toBe("");
  });

  test("given an act on a stand-in, when it is drawn, then it shows the emoji, marked as standing in, and fetches nothing", () => {
    const { container } = render(<Tile of="activity.pure-water" />);
    const tile = container.querySelector<HTMLElement>("[data-tile='activity.pure-water']")!;
    expect(tile.getAttribute("data-stand-in")).toBe("true");
    expect(tile.querySelector("img")).toBeNull();
    expect(tile.textContent).toBe("💧");
    expect(tile.style.width).toBe("64px");
  });

  test("[world:fan-of-sticker-buttons] given an act with no activity of its own, when its glyph is drawn, then it is the drawing itself at the size asked, standing in for nothing, and fetches nothing", () => {
    const { container } = render(<Tile of="act.sit" size={40} />);
    const tile = container.querySelector<HTMLElement>("[data-tile='act.sit']")!;
    expect(tile.dataset.glyph).toBe("sit");
    expect(tile.hasAttribute("data-stand-in")).toBe(false);
    expect(tile.querySelector("img")).toBeNull();
    expect(tile.querySelector("svg[data-glyph-drawing='sit']")?.getAttribute("width")).toBe("40");
    expect(tile.style.width).toBe("40px");
  });
});
