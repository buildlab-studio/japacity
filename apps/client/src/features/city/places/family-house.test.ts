// The family house staged (city.md place.family-house, R-CITY-037): the party room as a place, the
// veranda and the yard on an ordinary day, and the same house dressed for offer.send-off-party,
// its guests idling and its dancers on the two dance loops while the offer is open.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import placeFile from "../../../../public/assets/places/family-house/place.json";
import { engineView, richView } from "../../../shared/testing/fixtures";
import { crowdSize, poolOf, sampleCrowd } from "../crowd";
import { dancerShown, DANCER_SLOT, dressPlace, filesOf } from "../placeFile";
import { personOf } from "../roster";
import { offersHere } from "../staging";
import { allPalette, city, instancesOf, onGround, rowOf, signKeys, staged, totalsOf, wordsOf } from "./placeTesting";

const { file, stage, entry } = staged(placeFile, "place.family-house");
const PARTY = "offer.send-off-party";
const party = stage.dressings?.find((dressing) => dressing.offer === PARTY);
if (party === undefined) throw new Error("The family house has no party dressing");
const places = Object.values(content.place);

describe("the family house's budget", () => {
  test("[R-ASSET-007] given the house's shipped files measured as the build check measures them, when it is counted with the party's guests and dancers, then both modes fit the interior row", async () => {
    expect(file.scope).toBe("interior");
    const totals = await totalsOf(file);
    for (const mode of ["low", "high"] as const) {
      expect(totals[mode].drawCalls).toBeLessThanOrEqual(rowOf(file).drawCalls);
      expect(totals[mode].triangles).toBeLessThanOrEqual(rowOf(file).triangles);
    }
  });

  test("[R-ASSET-007] given the house's file, when its counts are read, then the instances are the most copies of any dressing, its people the party's guests and dancers in each mode, and its colours palette names", () => {
    expect(file.instances).toEqual(instancesOf(stage));
    const guests = (mode: "low" | "high"): number => crowdSize({ crowd: party.crowd }, mode, city);
    expect(file.people.low).toBe(guests("low") + party.dancers.length);
    expect(file.people.high).toBe(guests("high") + party.dancers.length);
    expect(file.people.low).toBeLessThanOrEqual(city.crowdLow);
    expect(placeFile.groundRoadSky.drawCalls).toBe(1);
    expect(allPalette(stage)).toBe(true);
  });
});

describe("the send-off party", () => {
  test("[R-CITY-011] given the send-off party offered at home, when the city looks for it, then it is staged at the family house, and only an open offer dresses the house", () => {
    const open = richView().offers[0];
    if (open === undefined) throw new Error("The rich view has no open offer");
    const view: Pick<PlayerView, "offers" | "place"> = { place: engineView().place, offers: [{ ...open, entry: PARTY }] };
    expect(offersHere(view, "place.family-house", places)).toEqual([PARTY]);
    expect(dressPlace(file, []).file).toBe(file);
    expect(dressPlace(file, []).crowd).toBeNull();
    expect(dressPlace(file, ["offer.nepa-bill"]).crowd).toBeNull();
  });

  test("[R-CITY-037] given the send-off party open, when the house is dressed, then the parlour gives way to the party set and its chairs, the banner reads from its text key, bunting hangs, the fire smokes, and about ten people are there in the high mode", () => {
    const { file: dressed, crowd } = dressPlace(file, [PARTY]);
    const stageNow = dressed.stage;
    if (stageNow === undefined || crowd === null) throw new Error("Not dressed");
    const files = stageNow.models.map((model) => model.file);
    expect(files).toContain("places/family-house/prop_party-set.glb");
    expect(files).not.toContain("places/family-house/prop_parlour-set.glb");
    expect(stageNow.models.find((model) => model.file.endsWith("prop_plastic-chair.glb"))?.at.length).toBeGreaterThanOrEqual(10);
    expect(wordsOf("place.family-house.sign.1")).toBe("SAFE JOURNEY");
    expect(stageNow.motion.filter((motion) => motion.kind === "bunting").length).toBeGreaterThanOrEqual(2);
    expect(stageNow.motion.some((motion) => motion.kind === "smoke")).toBe(true);
    const shown = crowdSize({ crowd }, "high", city) + (stageNow.dancers ?? []).length;
    expect(shown).toBe(10);
    expect(stageNow.people.length).toBeGreaterThanOrEqual(crowdSize({ crowd }, "high", city));
    expect(stageNow.people.every((spot) => onGround(stageNow, spot))).toBe(true);
    expect(filesOf(dressed, [])).toEqual(expect.arrayContaining((stageNow.dancers ?? []).map((dancer) => dancer.file)));
  });

  test("[R-CITY-037] given the party's dancers, when they are read, then the two loops are played on three bodies, one in an agbada and one in a wrapper, on the veranda's floor, and a tap on one finds a resident", () => {
    const dancers = party.dancers;
    expect(dancers).toHaveLength(3);
    expect(new Set(dancers.map((dancer) => dancer.dance))).toEqual(new Set(["twoStep", "shuffle"]));
    expect(new Set(dancers.map((dancer) => dancer.file)).size).toBe(3);
    expect(dancers.map((dancer) => dancer.file)).toEqual(expect.arrayContaining(["shared/chr/chr_chief.glb", "shared/chr/chr_iya.glb"]));
    expect(dancers.every(({ at }) => at[1] < 0 && at[1] > -6)).toBe(true);
    expect(dancers.every((dancer) => !file.people.sample.includes(dancer.file))).toBe(true);
    const { file: dressed } = dressPlace(file, [PARTY]);
    if (dressed.stage === undefined) throw new Error("Not dressed");
    const tapped = dancerShown(dressed.stage, DANCER_SLOT + 1);
    expect(tapped?.kind).toBe("resident");
    expect(tapped?.person).toEqual(personOf("shared/chr/chr_iya.glb"));
    expect(dancerShown(dressed.stage, DANCER_SLOT + dancers.length)).toBeUndefined();
  });

  test("[R-CITY-016] given the party open on a hundred days, Saturdays' occasion dress included, when the guests are sampled beside the dancers, then no guest wears a dancer's outfit or another guest's", () => {
    const { file: dressed, crowd } = dressPlace(file, [PARTY]);
    if (crowd === null) throw new Error("Not dressed");
    const dancing = party.dancers.map((dancer) => dancer.file);
    const start = Date.UTC(2026, 0, 3);
    for (let day = 0; day < 100; day += 1) {
      const date = new Date(start + day * 86_400_000).toISOString().slice(0, 10);
      for (const mode of ["low", "high"] as const) {
        const guests = sampleCrowd({ ...entry, crowd }, poolOf(dressed.people.sample), date, mode, city, [], [], dancing).people.map((shown) => shown.person.file);
        expect(guests.filter((guest) => dancing.includes(guest))).toEqual([]);
        expect(new Set(guests).size).toBe(guests.length);
      }
    }
  });

  test("[R-CITY-024] given the house's boards, when they are read, then the notice on the gate and the banner have their words from the text table, and no copy of the house is lettered twice", () => {
    expect(wordsOf("place.family-house.sign.2")).toContain("NOT FOR SALE");
    expect(wordsOf("place.family-house.sign.1")).toBe("SAFE JOURNEY");
    expect(stage.models.find((model) => model.file.endsWith("bld_family-house.glb"))?.at).toHaveLength(1);
    expect(signKeys(stage)).toEqual([]);
  });

  test("[R-CITY-014] given an ordinary day, when the house is read, then its own few people have spots on the ground, and the start looks into the veranda from the yard", () => {
    expect(stage.people.length).toBeGreaterThanOrEqual(crowdSize(entry, "high", city));
    expect(stage.people.every((spot) => onGround(stage, spot))).toBe(true);
    expect(stage.start[1]).toBeGreaterThan(0);
    expect(stage.start[2]).toBeCloseTo(Math.PI, 3);
  });
});
