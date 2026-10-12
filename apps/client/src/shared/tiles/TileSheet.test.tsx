// The contact sheet of every tile, a development page (`?tiles`) for checking the pictures by eye.
import { render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { tilesAsked } from "./asked";
import { TileSheet } from "./TileSheet";
import { standIns, TILE_TABLE } from "./tiles.data";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

vi.mock("../three/manifest", async (original) => {
  const real = await original<typeof import("../three/manifest")>();
  return { ...real, loadManifest: () => new Promise(() => undefined) };
});

describe("the contact sheet", () => {
  test("given the table, when the sheet is drawn, then every row shows its tile once under its id, and the stand-ins are counted", () => {
    const { container } = render(<TileSheet />);
    const ids = Object.keys(TILE_TABLE);
    expect([...container.querySelectorAll("[data-tile]")].map((tile) => tile.getAttribute("data-tile")).sort()).toEqual([...ids].sort());
    expect(container.querySelectorAll("[data-tile][data-stand-in]")).toHaveLength(standIns().length);
    expect(container.textContent).toContain(`${String(standIns().length)} of ${String(ids.length)}`);
  });

  test("given the address, then only ?tiles asks for the sheet", () => {
    expect(tilesAsked("?tiles")).toBe(true);
    expect(tilesAsked("?tiles=1&x=2")).toBe(true);
    expect(tilesAsked("?classic")).toBe(false);
    expect(tilesAsked("")).toBe(false);
  });
});
