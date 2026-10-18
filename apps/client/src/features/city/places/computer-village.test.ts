// Computer Village rebuilt as one frontage (city.md place.computer-village, world.md R-WORLD-011):
// the phone plaza and the laptop house across the road, and on the near pavement the repair bench
// where the laptop's fault and the side gig open, a phone shop where a phone is bought, an accessories stall
// where the trade is learned and phones are sold (streets.md R-STREET-001 to 003), a danfo and an okada.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import raw from "../../../../public/assets/places/computer-village/place.json";
import { stagedAt } from "../../../shared/scene/staging";
import { thingSpot, vehicleOf } from "../scene/things";
import { frontageTests } from "./frontage.testing";
import { copiesOf, staged, wordsOf } from "./place.testing";
import { cityWords } from "../city.words";

const ID = "place.computer-village";
const { stage } = staged(raw, ID);
const thing = (id: string) => {
  const found = (stage.things ?? []).find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`No ${id}`);
  return found;
};

describe("Computer Village", () => {
  frontageTests(raw, ID);

  test("[R-WORLD-005] given the repair bench, when its acts are read, then the laptop's fault opens as a sheet while its offer is open and the side gig as a second, each under its own words", () => {
    const bench = thing("repair-bench");
    expect(bench.file.endsWith("prop_repair-table.glb")).toBe(true);
    expect(bench.acts.map((act) => [act.kind, act.stages])).toEqual([
      ["sheet", "offer.laptop-fault"],
      ["sheet", "activity.side-gig"],
    ]);
    expect(bench.acts.map((act) => cityWords(act.label))).toEqual(["The laptop", "Side gig"]);
  });

  test("[R-STREET-001] given the phone stall, when its acts are read, then buying a phone opens as a sheet under its own words and looking stays a plain act", () => {
    const stall = thing("phone-stall");
    expect(stall.acts.map((act) => [act.kind, act.stages])).toEqual([
      ["sheet", "activity.buy-phone"],
      ["plain", undefined],
    ]);
    expect(stall.acts.map((act) => cityWords(act.label))).toEqual(["Buy a phone", "Look"]);
  });

  test("[R-STREET-002] [R-STREET-003] given the accessories stall, when its acts are read, then the apprenticeship and the phone sales job each open as a sheet under their own words", () => {
    const stall = thing("accessories");
    expect(stall.acts.map((act) => [act.kind, act.stages])).toEqual([
      ["sheet", "activity.apprentice-repair"],
      ["sheet", "activity.job-phone-sales"],
    ]);
    expect(stall.acts.map((act) => cityWords(act.label))).toEqual(["Learn repairs", "Sell phones"]);
  });

  test("[R-CITY-011] given what Computer Village stages, when the city looks for where each is shown at home, then it is shown here", () => {
    const places = Object.values(content.place);
    for (const id of ["offer.laptop-fault", "activity.side-gig", "activity.buy-phone", "activity.job-phone-sales", "activity.apprentice-repair"]) expect(stagedAt(id, { where: "home", country: null }, places)).toBe(ID);
  });

  test("[R-CITY-014] given the repair bench, when the crowd stands, then the repairer keeps the spot behind it and those waiting stand on the near side", () => {
    const [bench] = copiesOf(stage, "prop_repair-table.glb");
    if (bench === undefined) throw new Error("No bench");
    const repairer = stage.people[stage.prefer?.trader?.[0] ?? -1];
    if (repairer === undefined) throw new Error("No repairer's spot");
    expect(Math.hypot(repairer[0] - bench[0], repairer[1] - bench[1])).toBeLessThan(1.5);
    expect(repairer[1]).toBeLessThan(bench[1]);
    const waiting = stage.people.slice(1, 3);
    expect(waiting.every(([x, z]) => z > bench[1] && Math.hypot(x - bench[0], z - bench[1]) < 2.5)).toBe(true);
  });

  test("[R-WORLD-017] given the danfo and the okada at the kerb, when they are tapped, then each opens the ride sheet for its own vehicle", () => {
    for (const id of ["danfo", "okada"]) {
      expect(thing(id).acts.map((act) => act.kind)).toEqual(["ride"]);
      expect(vehicleOf(thing(id))).toBe(id);
      expect(thingSpot(stage, thing(id))).not.toBeNull();
    }
  });

  test("[R-CITY-024] given the shops across the road and the phone shop, when their boards are read, then they sell and fix phones and laptops in the place's own words", () => {
    const words = stage.models.flatMap((model) => (model.signs ?? []).flat()).map(wordsOf);
    expect(words.some((said) => said.includes("PHONES"))).toBe(true);
    expect(words.some((said) => said.includes("LAPTOP"))).toBe(true);
    expect(words.some((said) => said.includes("REPAIR"))).toBe(true);
  });
});
