// The cargo office on Bode Thomas Street: a booth built from the kit's shopfront with its painted
// board, cartons and bags waiting, a clerk at the counter, and the player's parcel there while one
// waits (docs/rules/world.md R-WORLD-005, R-WORLD-011; city.md R-CITY-011, R-CITY-024). The street's
// own file, as the game loads it, also passes every frontage check.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import placeFile from "../../../public/assets/places/bode-thomas-front/place.json";
import { dressPlace, type Stage } from "../scene/placeFile";
import { frontageTests } from "../../features/city/places/frontage.testing";
import { copiesOf, staged, wordsOf } from "../../features/city/places/place.testing";
import { sceneWords } from "../../features/city/scene.words";
import { offersHere, stagedAt } from "../scene/staging";
import { stagedNow, thingsNow } from "../../features/city/things";
import { PARCEL } from "./parcel.ask";

const { file, stage, entry } = staged(placeFile, "place.bode-thomas");
const BOOTH = "shop_provisions.glb";
const PARCEL_MODEL = "shared/prop/prop_travel-bag.glb";
const things = stage.things ?? [];
const cargo = things.find((thing) => thing.id === "cargo");

describe("Bode Thomas Street's frontage", () => {
  frontageTests(placeFile, "place.bode-thomas");
});

describe("the cargo office", () => {
  test("[R-CITY-010] given a parcel waiting at home, when the city asks where it is staged, then it is Bode Thomas Street, so the street is dressed for it there", () => {
    const places = Object.values(content.place);
    expect(stagedAt(PARCEL, { where: "home", country: null }, places)).toBe("place.bode-thomas");
    const view = { offers: [{ entry: PARCEL }], place: { where: "home", country: null } } as unknown as Parameters<typeof offersHere>[0];
    expect(offersHere(view, "place.bode-thomas", places)).toEqual([PARCEL]);
  });

  test("[R-WORLD-005] given the street's things, when the cargo office is read, then it stands at the booth, is named, and its one act opens the parcel's sheet", () => {
    if (cargo === undefined) throw new Error("No cargo office on the street");
    expect(cargo.file.endsWith(BOOTH)).toBe(true);
    expect(sceneWords(cargo.label)).toBe(wordsOf(`${PARCEL}.booth`));
    expect(cargo.acts).toEqual([{ id: "collect", label: `${PARCEL}.act`, kind: "sheet", stages: PARCEL }]);
    expect(sceneWords(cargo.acts[0]!.label)).toBe(wordsOf(`${PARCEL}.act`));
  });

  test("[R-WORLD-005] given no parcel waiting and then one, when the things the player can act on are read, then the office shows no name and no act until a parcel waits", () => {
    const none = thingsNow(things, stagedNow(new Set(), new Set(), new Set(), null));
    expect(none.some((thing) => thing.id === "cargo")).toBe(false);
    const waiting = thingsNow(things, stagedNow(new Set(), new Set(), new Set([PARCEL]), null));
    expect(waiting.find((thing) => thing.id === "cargo")?.acts.map((act) => act.id)).toEqual(["collect"]);
  });

  test("[R-CITY-024] given the booth's boards, when they are read, then the board names the cargo trade and the way to Lagos, the notice says to collect your parcel here, and neither carries a figure of money", () => {
    const booth = stage.models.find((model) => model.file.endsWith(BOOTH));
    const [board, notice] = booth?.signs?.[0] ?? [];
    if (board === undefined || notice === undefined) throw new Error("The booth is not lettered");
    expect(wordsOf(board)).toContain("CARGO");
    expect(wordsOf(board)).toContain("LAGOS");
    expect(wordsOf(notice)).toContain("PARCEL");
    for (const key of [board, notice]) expect(wordsOf(key)).not.toMatch(/[₦$£€\d]/);
  });

  test("[R-WORLD-005] given the booth, when the street around it is read, then cartons and bags wait beside it and a crowd spot of the low mode stands at its counter for the clerk", () => {
    const [booth] = copiesOf(stage, BOOTH);
    const [bales] = copiesOf(stage, "prop_bales.glb");
    if (booth === undefined || bales === undefined) throw new Error("The booth or its bags are missing");
    expect(Math.hypot(bales[0] - booth[0], bales[1] - booth[1])).toBeLessThan(4);
    const low = file.people.low;
    expect(stage.people.slice(0, low).some(([x, z]) => Math.hypot(x - booth[0], z - booth[1]) < 3.2)).toBe(true);
    expect(cargo?.at).toBeDefined();
    const [x, z] = cargo?.at ?? [0, 0];
    expect(Math.hypot(x - booth[0], z - booth[1])).toBeLessThan(4);
  });

  test("[R-CITY-011] given a parcel waiting and then none, when the street is dressed, then a second bag stands at the counter only while it waits, and nothing else of the street changes", () => {
    const bags = (models: Stage["models"]): number[][] =>
      models.filter((model) => model.file === PARCEL_MODEL).flatMap((model) => model.at);
    const plain = dressPlace(file, []);
    const dressed = dressPlace(file, [PARCEL]);
    const waiting = bags(plain.file.stage?.models ?? []);
    const shown = bags(dressed.file.stage?.models ?? []);
    expect(waiting).toHaveLength(1);
    expect(shown).toHaveLength(2);
    // The one added stands nearest where the player collects it.
    const [x, z] = cargo?.at ?? [0, 0];
    const added = shown.find((spot) => !waiting.some((other) => other[0] === spot[0] && other[1] === spot[1]));
    if (added === undefined) throw new Error("No parcel at the counter while one waits");
    expect(Math.hypot((added[0] ?? 0) - x, (added[1] ?? 0) - z)).toBeLessThan(1.5);
    expect(dressed.file.stage?.models.map((model) => model.file).sort()).toEqual(stage.models.map((model) => model.file).sort());
    expect(dressed.file.stage?.things).toEqual(stage.things);
    // The street's own crowd while the parcel waits, under the world's caps.
    expect(dressed.crowd).toEqual({ low: file.people.low, high: file.people.high, target: entry.crowd.target });
  });
});
