// The door's pictures (prologue.md R-PROLOGUE-009, 013; the door's second design): every look the door offers has its face, its
// whole figure and its cheer published from the shooter; every life's thing is a model's published tile; every way a
// tile opens has a picture; every home has its picture, the room as the game draws it or a model's tile.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { TILE_TABLE } from "../tiles/tiles.data";
import { ARCHETYPES, HOMES, opensChips } from "./archetypes";
import { homePicture, LIFE_THINGS, wayPicture } from "./lives";
import { LOOKS } from "./looks";

const ASSETS = join(import.meta.dirname, "..", "..", "..", "public", "assets");
const published = (JSON.parse(readFileSync(join(ASSETS, "manifest.json"), "utf8")) as { files: Record<string, string> }).files;

describe("the door's pictures", () => {
  test("[R-PROLOGUE-009] given every look the door offers, when the publish is read, then its face, its whole figure with a hand on the hip and its cheer are published as tiles, shot from the shipped model", () => {
    const missing = LOOKS.flatMap((look) => ["face", "figure", "cheer"].filter((view) => published[`tiles/${look.id}-${view}.png`] === undefined).map((view) => `${look.id}-${view}`));
    expect(missing).toEqual([]);
    expect(LOOKS.length).toBe(16);
  });

  test("[R-PROLOGUE-013] given every life, then its card's thing is a model whose tile is published, and each tint is one of the layer's", () => {
    expect(Object.keys(LIFE_THINGS).sort()).toEqual(ARCHETYPES.map((archetype) => archetype.id).sort());
    for (const archetype of ARCHETYPES) {
      const thing = LIFE_THINGS[archetype.id];
      expect({ id: archetype.id, published: published[`tiles/${thing.tile}.png`] !== undefined }).toEqual({ id: archetype.id, published: true });
      expect(["food", "study", "money", "body", "people", "plain"]).toContain(thing.tint);
    }
    // No two lives share a thing: the card says which life it is before its words do.
    expect(new Set(Object.values(LIFE_THINGS).map((thing) => thing.tile)).size).toBe(ARCHETYPES.length);
  });

  test("[R-PROLOGUE-013] given every way a tile opens, then it has a picture the table holds, a country's street or a stand-in for one", () => {
    const ways = [...new Set(ARCHETYPES.flatMap((archetype) => opensChips(archetype.id)))];
    expect(ways.length).toBeGreaterThan(4);
    for (const way of ways) {
      const picture = wayPicture(way);
      expect({ way, picture: picture !== null && picture in TILE_TABLE }).toEqual({ way, picture: true });
    }
    expect(wayPicture("Tech work in the UK")).toBe("route.uk-skilled");
    expect(wayPicture("A master's")).toBe("activity.masters-at-home");
    expect(wayPicture("The road through the desert to Europe")).toBe("route.road");
    expect(wayPicture("Something else")).toBeNull();
  });

  test("[R-PROLOGUE-013] given every home on the door and the self-contain, then each has its picture: the room as the game draws it for the three mainland homes, a published model's tile for Makoko and the goal", () => {
    for (const home of ["compound-room", "hostel-room", "family-house"] as const) expect({ home, room: "src" in homePicture(home) }).toEqual({ home, room: true });
    for (const home of [...HOMES.filter((one) => one === "makoko"), "self-contain" as const]) {
      const picture = homePicture(home);
      expect({ home, published: "model" in picture && published[`tiles/${picture.model}.png`] !== undefined }).toEqual({ home, published: true });
    }
  });
});
