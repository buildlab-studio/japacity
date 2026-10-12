// The street's things of decision 0037 (docs/rules/streets.md R-STREET-011; world.md R-WORLD-005): the suya spot
// and the mallam's bench on Ojuelegba, the barber, the viewing centre and the joint on Bode Thomas, the clothes stall
// at Tejuosho. Each stands on the pavement as a model the player taps, opens the act content stages there, and keeps
// the hours the world's clock gives it (clock.md R-CLOCK-033). Bode Thomas's whole frontage is checked in cargo.test.ts;
// Ojuelegba's and Tejuosho's here on what the new things touch: the budget, the ground, the floors and the staged acts.
import { type Footprint, isFootprint } from "@japacity/assets";
import { content, text } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import bodeRaw from "../../../../public/assets/places/bode-thomas-front/place.json";
import ojuelegbaRaw from "../../../../public/assets/places/ojuelegba-front/place.json";
import tejuoshoRaw from "../../../../public/assets/places/tejuosho-front/place.json";
import type { Act, Thing } from "../../../shared/world/contract";
import { plainActLine } from "../actLines";
import type { Stage } from "../placeFile";
import { sceneWords } from "../scene.words";
import { thingSpot, thingsNow } from "../things";
import { checkFaces, type ModelFace } from "../../../../../../tools/assets/faces-check";
import { checkWalkable } from "../../../../../../tools/assets/footprint-check";
import { actEntries } from "./frontageTesting";
import { instancesOf, measured, rowOf, staged, totalsOf } from "./placeTesting";

interface Expected {
  thing: string;
  model: string;
  name: string;
  act: Act;
}

const STREETS: { raw: unknown; id: Id<"place">; things: Expected[] }[] = [
  {
    raw: ojuelegbaRaw,
    id: "place.ojuelegba",
    things: [
      { thing: "suya", model: "shared/prop/prop_suya-grill.glb", name: "Suya spot", act: { id: "suya", label: "city.act.suya", kind: "sheet", stages: "activity.buy-suya" } },
      { thing: "tea", model: "places/peckham/prop_street-bench.glb", name: "The mallam's bench", act: { id: "tea", label: "city.act.tea", kind: "sheet", stages: "activity.mallam-tea", more: ["activity.pure-water"], pose: "sit" } },
    ],
  },
  {
    raw: bodeRaw,
    id: "place.bode-thomas",
    things: [
      { thing: "barber", model: "places/bode-thomas/shop_barber-kiosk.glb", name: "Barber", act: { id: "cut", label: "city.act.barber", kind: "sheet", stages: "activity.barber" } },
      { thing: "viewing", model: "places/bode-thomas/shop_viewing-centre.glb", name: "Viewing centre", act: { id: "match", label: "city.act.match", kind: "sheet", stages: "activity.viewing-centre", parts: ["evening", "night"], pose: "sit" } },
      { thing: "joint", model: "shared/prop/prop_joint-set.glb", name: "The joint", act: { id: "drink", label: "city.act.joint", kind: "sheet", stages: "activity.beer-joint", more: ["activity.night-out"], parts: ["evening", "night"], pose: "sit" } },
    ],
  },
  {
    raw: tejuoshoRaw,
    id: "place.tejuosho-market",
    things: [{ thing: "clothes", model: "places/tejuosho-market/prop_market-stall.glb", name: "Clothes stall", act: { id: "clothes", label: "city.act.clothes", kind: "sheet", stages: "activity.buy-clothes" } }],
  },
];

/** The raised strips either side of the carriageway: the kerbs, nearest the street's middle. */
function carriageway(stage: Stage): [number, number] {
  const kerbs = stage.roads.filter((road) => road.raise !== undefined && road.colour === "concrete").map((road) => road.at[1]);
  return [Math.min(...kerbs), Math.max(...kerbs)];
}

function thingOf(stage: Stage, id: string): Thing {
  const found = (stage.things ?? []).find((thing) => thing.id === id);
  if (found === undefined) throw new Error(`No ${id}`);
  return found;
}

describe.each(STREETS)("the street's things at $id", ({ raw, id, things }) => {
  const { file, stage, entry } = staged(raw, id);

  test.each(things)(`[R-WORLD-005] [R-STREET-011] given ${id}'s $thing, when it is read, then it stands at its own model with its name and the one act that opens what content stages there`, ({ thing: thingId, model, name, act }) => {
    const thing = thingOf(stage, thingId);
    expect(thing.file).toBe(model);
    expect(sceneWords(thing.label)).toBe(name);
    const { seat, ...rest } = thing.acts[0] ?? act;
    expect(thing.acts).toHaveLength(1);
    expect(rest).toEqual(act);
    expect(seat === undefined).toBe(act.pose === undefined);
    for (const stages of [act.stages ?? "", ...(act.more ?? [])]) {
      expect(entry.stages).toContain(stages);
      expect(content.activity[stages as Id<"activity">]).toBeDefined();
      expect(text[`${stages}.name`]?.trim()).toBeTruthy();
    }
  });

  test.each(things)(`[R-WORLD-005] [R-STREET-011] given ${id}'s $thing, when its model and its spots are read, then the model stands on a pavement clear of the carriageway, the thing is beside it and a seat is on the model`, ({ thing: thingId }) => {
    const thing = thingOf(stage, thingId);
    const copy = stage.models.find((model) => model.file === thing.file)?.at[thing.copy];
    if (copy === undefined) throw new Error(`${thingId} has no copy`);
    const [north, south] = carriageway(stage);
    expect(copy[1] < north - 1 || copy[1] > south + 1).toBe(true);
    const spot = thingSpot(stage, thing);
    if (spot === null || thing.at === undefined) throw new Error(`${thingId} names no spot`);
    expect(Math.hypot(thing.at[0] - copy[0], thing.at[1] - copy[1])).toBeLessThan(3.5);
    const seat = thing.acts[0]?.seat;
    expect(seat === undefined || Math.hypot(seat[0] - copy[0], seat[1] - copy[1]) < 2).toBe(true);
  });

  test(`[R-ASSET-007] given ${id} with its new things, when the frontage is counted as the build check counts it, then both modes stay inside the exterior row and the instances are the copies staged`, async () => {
    const totals = await totalsOf(file);
    for (const mode of ["low", "high"] as const) {
      expect(totals[mode].drawCalls).toBeLessThanOrEqual(rowOf(file).drawCalls);
      expect(totals[mode].triangles).toBeLessThanOrEqual(rowOf(file).triangles);
    }
    expect(file.instances).toEqual(instancesOf(stage));
  });

  test(`[R-WORLD-005] [R-STREET-011] given what ${id} stages in content, when its things' acts are read, then every staged entry opens from an act of a thing there`, () => {
    const opened = new Set(actEntries(raw, id));
    expect(entry.stages.filter((stages) => !opened.has(stages))).toEqual([]);
  });

  test(`[R-CITY-014] [R-WORLD-012] [R-ASSET-030] given ${id}'s models with the new things, when the ground is read, then the crowd and the start stand clear of every footprint and no two floors lie within a centimetre`, async () => {
    const models = [...new Set(stage.models.map((model) => model.file))];
    const footprints = new Map<string, Footprint>();
    const floors = new Map<string, readonly ModelFace[]>();
    for (const path of models) {
      const found = await measured(path);
      if (isFootprint(found.extras.footprint)) footprints.set(path, found.extras.footprint);
      floors.set(path, found.floors ?? []);
    }
    expect(checkWalkable(id, stage, footprints)).toEqual([]);
    expect(checkFaces(id, stage, (path) => floors.get(path) ?? [])).toEqual([]);
  });
});

describe("the hours on Bode Thomas", () => {
  const { stage } = staged(bodeRaw, "place.bode-thomas");
  const street = stage.things ?? [];
  const all = () => true;

  test("[R-CLOCK-033] [R-WORLD-005] [R-STREET-011] given the viewing centre and the joint, when the world stands in the evening or at night, then each opens its sheet and sits the figure on its bench or chair", () => {
    for (const part of ["evening", "night"] as const) {
      const now = thingsNow(street, all, part);
      expect(thingOf({ ...stage, things: now }, "viewing").acts[0]).toMatchObject({ kind: "sheet", stages: "activity.viewing-centre", pose: "sit" });
      expect(thingOf({ ...stage, things: now }, "joint").acts[0]).toMatchObject({ kind: "sheet", stages: "activity.beer-joint", more: ["activity.night-out"], pose: "sit" });
    }
  });

  test("[R-CLOCK-033] [R-WORLD-005] [R-STREET-011] given the viewing centre and the joint, when the world stands in the morning or the afternoon, then both still stand shut, saying they open in the evening and why, while the barber stays open", () => {
    for (const part of ["morning", "afternoon"] as const) {
      const now = { ...stage, things: thingsNow(street, all, part) };
      const viewing = thingOf(now, "viewing");
      const joint = thingOf(now, "joint");
      expect(viewing.acts.map((act) => sceneWords(act.label))).toEqual(["Opens in the evening"]);
      expect(joint.acts.map((act) => sceneWords(act.label))).toEqual(["Opens in the evening"]);
      expect(plainActLine(viewing, viewing.acts[0] ?? { label: "" })).toEqual({ kind: "tell", words: "Shut till evening. The screen is dark." });
      expect(plainActLine(joint, joint.acts[0] ?? { label: "" })).toEqual({ kind: "tell", words: "The chairs are stacked. Come back in the evening." });
      expect(thingOf(now, "barber").acts[0]?.stages).toBe("activity.barber");
    }
  });
});
