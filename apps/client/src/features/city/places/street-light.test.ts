// The layer's light and dressing in the Lagos streets and offices: the night
// keeps its bulbs and lanterns as the home's real point lights where a place has a lamp, a few to a place so the
// phone's frame holds, and each place stands more of life from the kit (assets:lighting-set-by-place; city:two-graphics-modes).
import { Mesh } from "three";
import { describe, expect, test } from "vitest";

import agentRaw from "../../../../public/assets/places/agent-office/place.json";
import bankRaw from "../../../../public/assets/places/bank-counter/place.json";
import bodeRaw from "../../../../public/assets/places/bode-thomas-front/place.json";
import villageRaw from "../../../../public/assets/places/computer-village/place.json";
import testRaw from "../../../../public/assets/places/english-test-centre/place.json";
import inverterRaw from "../../../../public/assets/places/inverter-room/place.json";
import makokoRaw from "../../../../public/assets/places/makoko/place.json";
import ojuelegbaRaw from "../../../../public/assets/places/ojuelegba-front/place.json";
import clinicRaw from "../../../../public/assets/places/tb-clinic/place.json";
import tejuoshoRaw from "../../../../public/assets/places/tejuosho-front/place.json";
import visaRaw from "../../../../public/assets/places/visa-centre/place.json";
import hubRaw from "../../../../public/assets/places/yaba-hub/place.json";
import { lightKindOf } from "../scene/daylight";
import { type PlaceFile, stageOf } from "../../../shared/scene/placeFile";
import { lampGlowOf } from "../../../shared/scene/world";

const PLACES: [string, unknown][] = [
  ["yaba-hub", hubRaw],
  ["inverter-room", inverterRaw],
  ["visa-centre", visaRaw],
  ["agent-office", agentRaw],
  ["bank-counter", bankRaw],
  ["english-test-centre", testRaw],
  ["tb-clinic", clinicRaw],
  ["ojuelegba-front", ojuelegbaRaw],
  ["bode-thomas-front", bodeRaw],
  ["tejuosho-front", tejuoshoRaw],
  ["computer-village", villageRaw],
  ["makoko", makokoRaw],
];

/** The kit's dressing for a street or an office: one of these stands in every place above. */
const DRESSING = ["prop_poster-board", "prop_cooler-stand", "prop_mat", "prop_office-cabinet", "prop_potted-plant", "prop_crates"].map((name) => `shared/prop/${name}.glb`);

/** The most real lights a street or an office carries, so the low mode's frame holds on a phone. */
const MOST_LIGHTS = 2;

describe("the streets' and offices' light and dressing", () => {
  test.each(PLACES)("[assets:lighting-set-by-place] [clock:game-day-on-real-time] given %s, when its lamps are read, then every lamp carries a real light of some strength and reach, and it carries at most two", (_, raw) => {
    const file = raw as PlaceFile;
    const lamps = stageOf(file).light.lamps ?? [];
    expect(lamps.length).toBeGreaterThan(0);
    expect(lamps.length).toBeLessThanOrEqual(MOST_LIGHTS);
    for (const lamp of lamps) {
      expect(lamp.light?.strength ?? 0).toBeGreaterThan(0);
      expect(lamp.light?.reach ?? 0).toBeGreaterThan(0);
    }
  });

  test.each(PLACES)("[assets:assets-and-places-within-budget] [clock:game-day-on-real-time] given %s, when its lamps' glow is built, then every lamp, bead and halo stands in one mesh with one material, so the night adds one draw call to the place", (_, raw) => {
    const lamps = stageOf(raw as PlaceFile).light.lamps ?? [];
    const lit = lampGlowOf(lamps);
    expect(lit).toBeInstanceOf(Mesh);
    expect(lit.children).toEqual([]);
    expect(Array.isArray(lit.material)).toBe(false);
    expect(lit.geometry.getAttribute("position").count).toBe(lamps.length * 4);
  });

  test.each(PLACES)("[assets:lighting-set-by-place] given %s, when its light is read, then it is lit as a street or an office, never as a home's rooms", (_, raw) => {
    const file = raw as PlaceFile;
    expect(lightKindOf({ scope: file.scope, stage: stageOf(file) })).toBe(file.scope === "interior" ? "office" : "street");
  });

  test.each(PLACES)("[world:place-is-one-screen] given %s, when its models are read, then it stands at least one piece of the kit's street or office dressing", (_, raw) => {
    const files = stageOf(raw as PlaceFile).models.map((model) => model.file);
    expect(files.some((path) => DRESSING.includes(path))).toBe(true);
  });
});
