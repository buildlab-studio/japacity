// The family house staged (city.md place.family-house, city:party-room-sets-the-bar): one wide floor seen whole,
// Mama and Papa in the parlour, your corner, the kitchen and the yard; the same house dressed for offer.send-off-party,
// its guests idling and its dancers on their two loops in the yard while the offer is open; the family's asks,
// the pledge and home's own send-off (chapter:family-marks-the-grant), answered round the parlour's centre table; and the street front
// behind the door, which keeps the house's notice on the gate.
import { content } from "@japacity/content";
import { type PlayerView, time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import type { WallSpec } from "../../../../../../assets-src/bld/home/build";
import { HOMES3 } from "../../../../../../assets-src/bld/home/homes3";
import frontFile from "../../../../public/assets/places/family-house-compound/place.json";
import placeFile from "../../../../public/assets/places/home-family-house/place.json";
import { engineView, richView } from "../../../shared/testing/fixtures";
import { crowdSize, poolOf, sampleCrowd } from "../../../shared/scene/crowd";
import { CAR_FILE, dancerShown, DANCER_SLOT, dressPlace, filesOf, parkCar } from "../../../shared/scene/placeFile";
import { personOf } from "../../../shared/scene/roster";
import { offersHere } from "../../../shared/scene/staging";
import { MAX_ACTS, stagedNow, thingsNow } from "../scene/things";
import { checkLimits } from "../../../../../../tools/assets/world-check";
import { actEntries } from "./frontage.testing";
import { allPalette, city, instancesOf, measured, onGround, rowOf, signKeys, staged, totalsOf, wordsOf } from "./place.testing";
import { cityWords } from "../city.words";

const { file, stage, entry } = staged(placeFile, "place.family-house");
const PARTY = "offer.send-off-party";
const party = stage.dressings?.find((dressing) => dressing.offer === PARTY);
if (party === undefined) throw new Error("The family house has no party dressing");
const places = Object.values(content.place);
// The yard's gate stands in the back side's fence, built full and knee-high; the full one is read.
const walls: readonly WallSpec[] = [...HOMES3.family.walls, ...Object.values(HOMES3.family.sides).flat()];
const yard = walls.find((wall) => wall.openings?.some((opening) => opening.kind === "gate"));
if (yard === undefined) throw new Error("The family house has no yard gate");
/** The yard's floor: between the house's right wall and the yard's side fence. */
const YARD = { x0: yard.from[0], x1: yard.to[0] };

describe("the family house's budget", () => {
  test("[assets:assets-and-places-within-budget] given the house's shipped files measured as the build check measures them, when it is counted with the party's guests and dancers and the family's car at its spot, then both modes fit its row", async () => {
    expect(file.scope).toBe(entry.scope);
    const totals = await totalsOf(file);
    for (const mode of ["low", "high"] as const) {
      expect(totals[mode].drawCalls).toBeLessThanOrEqual(rowOf(file).drawCalls);
      expect(totals[mode].triangles).toBeLessThanOrEqual(rowOf(file).triangles);
    }
  });

  test("[assets:assets-and-places-within-budget] given the party set carrying the banner's sign anchor, when one copy of it is counted, then its sign faces add a draw call as a building's do", async () => {
    const one = { ...file, instances: [{ file: "places/family-house/prop_party-set.glb", count: 1 }], people: { low: 0, high: 0, sample: [] } };
    const totals = await totalsOf(one);
    const bare = await totalsOf({ ...one, instances: [] });
    const set = await measured("places/family-house/prop_party-set.glb");
    expect(set.signs).toBeGreaterThan(0);
    expect(totals.low.drawCalls - bare.low.drawCalls).toBe(set.drawCalls + 1);
  });

  test("[assets:assets-and-places-within-budget] given the house's file, when its counts are read, then the instances are the most copies of any dressing with the car at its spot, its people the party's guests and dancers in each mode, and its colours palette names", () => {
    expect(file.instances).toEqual(instancesOf(stage));
    expect(file.instances.find((instance) => instance.file === CAR_FILE)?.count).toBe(1);
    const guests = (mode: "low" | "high"): number => crowdSize({ crowd: party.crowd }, mode, city);
    expect(file.people.low).toBe(guests("low") + party.dancers.length);
    expect(file.people.high).toBe(guests("high") + party.dancers.length);
    expect(file.people.low).toBeLessThanOrEqual(city.crowdLow);
    expect(placeFile.groundRoadSky.drawCalls).toBe(1);
    expect(allPalette(stage)).toBe(true);
  });
});

describe("the send-off party", () => {
  test("[city:set-piece-shown-where-staged] given the send-off party offered at home, when the city looks for it, then it is staged at the family house, and only an open offer dresses the house", () => {
    const open = richView().offers[0];
    if (open === undefined) throw new Error("The rich view has no open offer");
    const view: Pick<PlayerView, "offers" | "place"> = { place: engineView().place, offers: [{ ...open, entry: PARTY }] };
    expect(offersHere(view, "place.family-house", places)).toEqual([PARTY]);
    expect(dressPlace(file, []).file).toBe(file);
    expect(dressPlace(file, []).crowd).toBeNull();
    expect(dressPlace(file, ["offer.nepa-bill"]).crowd).toBeNull();
  });

  test("[city:party-room-sets-the-bar] given the send-off party open, when the house is dressed, then the yard gives way to the party set and its chairs, the family's car taken out with the line and the carport, the crates of drinks moved to the fence, the banner reads from its text key, bunting hangs, the fire smokes, and about ten people are there in the high mode", () => {
    const { file: dressed, crowd } = dressPlace(parkCar(file, true), [PARTY]);
    const stageNow = dressed.stage;
    if (stageNow === undefined || crowd === null) throw new Error("Not dressed");
    const files = stageNow.models.map((model) => model.file);
    expect(files).toContain("places/family-house/prop_party-set.glb");
    for (const gone of [CAR_FILE, "shared/prop/prop_carport.glb", "shared/prop/prop_clothes-line.glb"]) expect(files).not.toContain(gone);
    const crates = (shown: typeof stage): unknown => shown.models.find((model) => model.file === "shared/prop/prop_crates.glb")?.at;
    expect(crates(stageNow)).not.toEqual(crates(stage));
    expect(stageNow.models.find((model) => model.file.endsWith("prop_plastic-chair.glb"))?.at.length).toBeGreaterThanOrEqual(10);
    expect(wordsOf("place.family-house.sign.1")).toBe("SAFE JOURNEY");
    expect(stageNow.motion.filter((motion) => motion.kind === "bunting").length).toBeGreaterThanOrEqual(2);
    expect(stageNow.motion.some((motion) => motion.kind === "smoke")).toBe(true);
    const shown = crowdSize({ crowd }, "high", city) + (stageNow.dancers ?? []).length;
    expect(shown).toBe(10);
    expect(stageNow.people.length).toBeGreaterThanOrEqual(crowdSize({ crowd }, "high", city));
    expect(stageNow.people.every((spot) => onGround(stageNow, spot))).toBe(true);
    expect(filesOf(dressed, [])).toEqual(expect.arrayContaining((stageNow.dancers ?? []).map((dancer) => dancer.file)));
    expect(checkLimits(file)).toEqual([]);
  });

  test("[city:party-room-sets-the-bar] given the party's dancers, when they are read, then the two loops are played on three bodies, one in an agbada and one in a wrapper, on the yard's floor before the banner, and a tap on one finds a resident", () => {
    const dancers = party.dancers;
    expect(dancers).toHaveLength(3);
    expect(new Set(dancers.map((dancer) => dancer.dance))).toEqual(new Set(["twoStep", "shuffle"]));
    expect(new Set(dancers.map((dancer) => dancer.file)).size).toBe(3);
    expect(dancers.map((dancer) => dancer.file)).toEqual(expect.arrayContaining(["shared/chr/chr_chief.glb", "shared/chr/chr_iya.glb"]));
    expect(dancers.every(({ at }) => at[0] > YARD.x0 && at[0] < YARD.x1)).toBe(true);
    expect(dancers.every((dancer) => !file.people.sample.includes(dancer.file))).toBe(true);
    const { file: dressed } = dressPlace(file, [PARTY]);
    if (dressed.stage === undefined) throw new Error("Not dressed");
    const tapped = dancerShown(dressed.stage, DANCER_SLOT + 1);
    expect(tapped?.kind).toBe("resident");
    expect(tapped?.person).toEqual(personOf("shared/chr/chr_iya.glb"));
    expect(dancerShown(dressed.stage, DANCER_SLOT + dancers.length)).toBeUndefined();
  });

  test("[city:dress-mix-by-place] given the party open on a hundred days, Saturdays' occasion dress included, when the guests are sampled beside the dancers, then no guest wears a dancer's outfit or another guest's", () => {
    const { file: dressed, crowd } = dressPlace(file, [PARTY]);
    if (crowd === null) throw new Error("Not dressed");
    const dancing = party.dancers.map((dancer) => dancer.file);
    const start = Date.UTC(2026, 0, 3);
    for (let day = 0; day < 100; day += 1) {
      const date = new Date(start + day * time.DAY_MS).toISOString().slice(0, 10);
      for (const mode of ["low", "high"] as const) {
        const guests = sampleCrowd({ ...entry, crowd }, poolOf(dressed.people.sample), date, mode, city, [], [], dancing).people.map((shown) => shown.person.file);
        expect(guests.filter((guest) => dancing.includes(guest))).toEqual([]);
        expect(new Set(guests).size).toBe(guests.length);
      }
    }
  });

  test("[city:party-room-sets-the-bar] [world:things-are-tappable-models] given the send-off open, when the bag's acts are read for now, then the party's sheet opens from the bag, beside the packing, in at most two acts", () => {
    const bag = stage.things?.find((thing) => thing.id === "bag");
    if (bag === undefined) throw new Error("The house has no bag");
    expect(bag.acts.length).toBeLessThanOrEqual(MAX_ACTS);
    const now = thingsNow([bag], stagedNow(new Set(), new Set(entry.stages), new Set([PARTY]), null));
    expect(now[0]?.acts.map((each) => [each.id, each.stages])).toEqual([["send-off", PARTY]]);
    expect(cityWords(bag.acts[1]?.label ?? "")).toBe("The send-off");
  });

  test("[city:place-words-are-text-keys] given the house's boards, when they are read, then the banner has its words from the text table; the street front behind the door keeps the notice on the gate, its one house lettered once", () => {
    expect(wordsOf("place.family-house.sign.1")).toBe("SAFE JOURNEY");
    expect(signKeys(stage)).toEqual([]);
    const front = staged(frontFile, "place.family-house").stage;
    expect(wordsOf("place.family-house.sign.2")).toContain("NOT FOR SALE");
    expect(front.models.find((model) => model.file.endsWith("bld_family-house.glb"))?.at).toHaveLength(1);
    expect(signKeys(front)).toEqual([]);
  });

  test("[city:crowd-sample-capped] given an ordinary day, when the house is read, then its own few people have spots on the ground, Mama and Papa sit in the parlour, and the start stands by the front door looking into the house", () => {
    expect(stage.people.length).toBeGreaterThanOrEqual(crowdSize(entry, "high", city));
    expect(stage.people.every((spot) => onGround(stage, spot))).toBe(true);
    expect(stage.acts?.filter((act) => act.pose === "sit").map((act) => act.spot)).toEqual(expect.arrayContaining([0, 1]));
    expect(stage.start[1]).toBeGreaterThan(0);
    expect(stage.start[2]).toBeCloseTo(Math.PI, 3);
  });
});

describe("the family's asks round the centre table", () => {
  const SEND_OFF = "offer.family-send-off";
  const PLEDGES = ["offer.family-pledge", "offer.family-pledge-small"];
  const table = stage.things?.find((thing) => thing.id === "family");
  if (table === undefined) throw new Error("The house has no family table");
  const open = (offers: string[]): ReturnType<typeof thingsNow> => thingsNow([table], stagedNow(new Set(), new Set(entry.stages), new Set(offers), null));

  test("[chapter:family-marks-the-grant] [world:things-are-tappable-models] given the house in content, when what its things open is read, then home's send-off is staged at the house and opens from the centre table, beside both pledges, in at most two acts", () => {
    expect(entry.stages).toContain(SEND_OFF);
    expect(actEntries(placeFile, "place.family-house")).toEqual(expect.arrayContaining([SEND_OFF, ...PLEDGES]));
    expect(table.acts.length).toBeLessThanOrEqual(MAX_ACTS);
    const act = table.acts.find((each) => each.stages === SEND_OFF);
    expect(act?.kind).toBe("sheet");
    expect(cityWords(act?.label ?? "")).toBe("Your send-off");
  });

  test("[chapter:family-marks-the-grant] [world:things-are-tappable-models] given only the send-off open, when the table's acts are read for now, then its one act opens the send-off's sheet; with nothing open the table offers nothing", () => {
    const now = open([SEND_OFF]);
    expect(now[0]?.acts.map((each) => [each.id, each.stages])).toEqual([["send-off-home", SEND_OFF]]);
    expect(open([])).toEqual([]);
  });

  test("[world:things-are-tappable-models] given either pledge open, when the table's acts are read for now, then the pledge's act opens that one, so each still opens from the table", () => {
    for (const pledge of PLEDGES) {
      const now = open([pledge]);
      expect(now[0]?.acts.map((each) => [each.id, each.stages])).toEqual([["pledge", pledge]]);
    }
    const both = open([...PLEDGES, SEND_OFF]);
    expect(both[0]?.acts.map((each) => each.id)).toEqual(["pledge", "send-off-home"]);
  });

  test("[world:things-are-tappable-models] given every entry the house stages, when its things' acts are read, then each opens from an act of a thing there", () => {
    const opened = new Set(actEntries(placeFile, "place.family-house"));
    // The rest is lived by hand (decision 0013): the bed's rest and the night's support are the table's and the bed's own acts.
    expect(entry.stages.filter((one) => !opened.has(one) && one !== "activity.rest" && one !== "activity.fill-drum")).toEqual([]);
  });
});
