import { describe, expect, test } from "vitest";

import { standIns, TILE_TABLE } from "./tiles.data";
import { missingListing } from "./missing";

describe("the tiles still on stand-ins", () => {
  test("given the table of pictures, when the missing models are listed, then every stand-in's id is named once with its emoji, under the kind it belongs to, and no model's row is", () => {
    const listing = missingListing();
    for (const { id, emoji } of standIns()) expect(listing.split("\n").filter((line) => line.includes(` ${id}`))).toEqual([`  ${emoji} ${id}`]);
    const modelled = Object.entries(TILE_TABLE).flatMap(([id, row]) => (typeof row === "string" ? [id] : []));
    expect(modelled.filter((id) => listing.split("\n").some((line) => line.endsWith(` ${id}`)))).toEqual([]);
    expect(listing).toMatch(/^\d+ of \d+ pictures stand in for a model that is not drawn\./);
    expect(listing).toContain("\nactivity\n");
  });
});
