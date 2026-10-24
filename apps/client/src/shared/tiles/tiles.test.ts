// The table from ids to pictures (docs/design/09-the-games-look.md, the pictures): every act, offer, place and home thing the
// interface shows a picture for has a row, each row a published model tile or an emoji standing in for one.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { picturePath } from "./published";
import { ACT_GLYPHS, glyphTile, HOME_FILES, marketTile, PHONE_PICTURES, standIns, TILE_TABLE, tileOf } from "./tiles.data";

const ASSETS = join(import.meta.dirname, "..", "..", "..", "public", "assets");

interface Act {
  stages?: string;
  more?: string[];
}
interface Thing {
  id: string;
  file: string;
  acts: Act[];
}
interface PlaceFile {
  place: string;
  stage: { things?: Thing[] };
}

const placeFiles = readdirSync(join(ASSETS, "places"))
  .filter((folder) => existsSync(join(ASSETS, "places", folder, "place.json")))
  .map((folder) => ({ folder, file: JSON.parse(readFileSync(join(ASSETS, "places", folder, "place.json"), "utf8")) as PlaceFile }));
const staged = placeFiles.flatMap(({ file }) => (file.stage.things ?? []).flatMap((thing) => thing.acts.flatMap((act) => [act.stages ?? "", ...(act.more ?? [])])));
const published = (JSON.parse(readFileSync(join(ASSETS, "manifest.json"), "utf8")) as { files: Record<string, string> }).files;
const modelOf = (file: string): string => (file.split("/").pop() ?? "").replace(/\.glb$/, "");
const homeThings = placeFiles.filter(({ folder }) => folder in HOME_FILES).flatMap(({ folder, file }) => (file.stage.things ?? []).filter((thing) => thing.id.startsWith(HOME_FILES[folder] ?? "")));
const activities = Object.values(content.activity);

describe("the table of pictures", () => {
  test("given every act that answers now, when its picture is asked for, then the table has a row for it", () => {
    const nowActs = activities.filter((entry) => entry.when === "now").map((entry) => entry.id);
    expect(nowActs.length).toBeGreaterThan(60);
    expect(nowActs.filter((id) => !(id in TILE_TABLE))).toEqual([]);
  });

  test("given every job in content, when its picture is asked for, then the table has a row for it", () => {
    const jobs = activities.filter((entry) => entry.id.startsWith("activity.job-")).map((entry) => entry.id);
    expect(jobs.length).toBeGreaterThan(20);
    expect(jobs.filter((id) => !(id in TILE_TABLE))).toEqual([]);
  });

  test("given every activity and offer a thing in the world stages, when its picture is asked for, then the table has a row for it", () => {
    const named = [...new Set(staged.filter((id) => id.startsWith("activity.") || id.startsWith("offer.")))];
    expect(named.filter((id) => id.startsWith("offer.")).length).toBeGreaterThan(10);
    expect(named.filter((id) => !(id in TILE_TABLE))).toEqual([]);
  });

  test("[world:phone-holds-what-phones-hold] given every paper and every way out in content, when the phone's Papers and Japa ask for its picture, then the table has a row for it", () => {
    expect(Object.keys(content.document).filter((id) => !(id in TILE_TABLE))).toEqual([]);
    expect(Object.keys(content.route).filter((id) => !(id in TILE_TABLE))).toEqual([]);
  });

  test("given every place with a place file, when its picture is asked for, then the table has a row for it, a model the place stands", () => {
    const places = [...new Set(placeFiles.map(({ file }) => file.place))];
    expect(places.filter((id) => !(id in TILE_TABLE))).toEqual([]);
    for (const id of places) {
      const row = TILE_TABLE[id];
      expect({ id, standIn: typeof row !== "string" }).toEqual({ id, standIn: false });
    }
  });

  test("given every thing of a home, when its picture is asked for by its id in the place file, then it is the model the thing is built from", () => {
    expect(homeThings.length).toBeGreaterThan(20);
    const wrong = homeThings.filter((thing) => TILE_TABLE[`thing.${thing.id}`] !== modelOf(thing.file));
    expect(wrong.map((thing) => `${thing.id}: ${modelOf(thing.file)}`)).toEqual([]);
  });

  test("[assets:pictures-shipped-light] [assets:pictures-sharp-at-three] given every row naming a model, when the publish is read, then that model's tile is published as WebP, and its small size beside it", () => {
    const models = Object.values(TILE_TABLE).filter((row): row is string => typeof row === "string");
    expect([...new Set(models)].filter((model) => published[picturePath(model)] === undefined || published[picturePath(`${model}-small`)] === undefined)).toEqual([]);
    expect(picturePath("prop_bed")).toBe("tiles/prop_bed.webp");
  });

  test("given every row, when it is read, then it names something there is: an act, an offer, a place, a paper or a way out in content, a home's thing, one of the phone's own pictures, or an act's glyph", () => {
    const things = new Set(homeThings.map((thing) => `thing.${thing.id}`));
    const unknown = Object.keys(TILE_TABLE).filter((id) => {
      if (id.startsWith("thing.")) return !things.has(id);
      // The acts' glyphs (world:fan-of-sticker-buttons): `act.<glyph>` for each glyph drawn, and only those.
      if (id.startsWith("act.")) return !(ACT_GLYPHS as readonly string[]).includes(id.slice("act.".length));
      if (id.startsWith("phone.")) return !PHONE_PICTURES.includes(id);
      // The market's things: `market.<slug>` for the thing `thing.<slug>` of content.
      if (id.startsWith("market.")) return !(`thing.${id.slice("market.".length)}` in content.thing);
      const [kind] = id.split(".");
      const table = kind === "activity" ? content.activity : kind === "offer" ? content.offer : kind === "place" ? content.place : kind === "document" ? content.document : kind === "route" ? content.route : null;
      return table === null || !(id in table);
    });
    expect(unknown).toEqual([]);
  });

  test("given a stand-in, when it is read, then it is one emoji marked as standing in, and the list of stand-ins names exactly those rows", () => {
    // Every row that is neither a model nor an act's drawn glyph is a stand-in.
    const rows = Object.entries(TILE_TABLE).filter(([id]) => !id.startsWith("act."));
    const standing = rows.flatMap(([id, row]) => (typeof row === "string" ? [] : [{ id, standIn: "standIn" in row && row.standIn, emoji: "emoji" in row && row.emoji.length > 0 && row.emoji.length <= 8 }]));
    expect(standing.filter((row) => !row.standIn || !row.emoji)).toEqual([]);
    expect(standIns().map((row) => row.id)).toEqual(rows.filter(([, row]) => typeof row !== "string").map(([id]) => id).sort());
  });

  test("[world:fan-of-sticker-buttons] given the acts with no activity of their own, when their pictures are asked for, then each kind has its drawn glyph, none stands in, and the glyph rows are exactly those", () => {
    expect([...ACT_GLYPHS]).toEqual(expect.arrayContaining(["sit", "lie", "sleep", "pay", "papers", "pack", "out", "talk"]));
    for (const glyph of ACT_GLYPHS) expect(tileOf(glyphTile(glyph))).toEqual({ glyph });
    expect(Object.keys(TILE_TABLE).filter((id) => id.startsWith("act.")).sort()).toEqual(ACT_GLYPHS.map(glyphTile).sort());
    expect(standIns().filter((row) => row.id.startsWith("act."))).toEqual([]);
  });

  test("[home:home-slice-fields] given every thing of the market, when the phone's Market asks for its picture, then the table has a row for it naming a model, never a stand-in", () => {
    const rows = Object.keys(content.thing).map((id) => ({ id, row: TILE_TABLE[marketTile(id)] }));
    expect(rows.filter(({ row }) => typeof row !== "string").map(({ id }) => id)).toEqual([]);
  });

  test("given an id the table does not know, when its picture is asked for, then it is a stand-in rather than nothing", () => {
    expect(tileOf("activity.not-there")).toEqual({ standIn: true, emoji: expect.any(String) as string });
    expect(tileOf("activity.nap")).toEqual({ model: "prop_bed" });
  });
});
