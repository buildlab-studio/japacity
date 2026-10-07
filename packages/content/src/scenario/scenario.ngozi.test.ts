import { ScenarioEntrySchema } from "@japacity/sim/schemas";
import { describe, expect, test } from "vitest";

import { content, text } from "../index";
import { ngoziScenario } from "./scenario.data";

describe("Ngozi", () => {
  test("[R-ENGINE-014] given Ngozi, when she is checked against the scenario schema, then she parses and holds every quality within its range", () => {
    expect(ScenarioEntrySchema.safeParse(ngoziScenario).error?.issues ?? []).toEqual([]);
    const out = Object.values(content.quality).filter((quality) => {
      const value = ngoziScenario.qualities[quality.id];
      return value === undefined || value < quality.min || value > quality.max;
    });
    expect(out.map((quality) => quality.id)).toEqual([]);
    expect(Object.keys(ngoziScenario.qualities).filter((id) => !(id in content.quality))).toEqual([]);
  });

  test("[R-ENGINE-014] given Ngozi, when the ids she names are looked up, then each exists and she is in the table", () => {
    const named = [
      ...(ngoziScenario.job === null ? [] : [ngoziScenario.job]),
      ...Object.keys(ngoziScenario.tenure),
      ...ngoziScenario.documents.map((held) => held.document),
      ...ngoziScenario.obligations.map((owed) => owed.obligation),
    ];
    const missing = named.filter((id) => {
      const kind = id.slice(0, id.indexOf(".")) as "activity" | "document" | "obligation";
      return (content[kind] as Record<string, unknown>)[id] === undefined;
    });
    expect(missing).toEqual([]);
    expect(content.scenario["scenario.ngozi"]).toBe(ngoziScenario);
  });

  test("[R-ENGINE-014] given Ngozi, when figures from route-gates.md are read back, then each matches the page", () => {
    expect(ngoziScenario.qualities).toMatchObject({
      "quality.age-months": 324,
      "quality.edu-grade": 4,
      "quality.english": 58,
      "quality.care": 60,
      "quality.network": 25,
      "quality.family-means": 30,
      "quality.standing": 65,
      "quality.wellbeing": 50,
      "quality.driving": 1,
    });
    expect(ngoziScenario.job).toBe("activity.job-nurse");
    expect(ngoziScenario.tenure).toEqual({ "activity.job-nurse": 30 });
    expect(ngoziScenario.pockets.NGN).toEqual({ bank: 65000000, cash: 3000000 });
    expect(ngoziScenario.documents).toEqual([
      { document: "document.passport", monthsLeft: 40, value: null },
      { document: "document.nursing-licence", monthsLeft: 30, value: null },
    ]);
    expect(ngoziScenario.obligations).toEqual([
      { obligation: "obligation.upkeep", amount: 12000000 },
      { obligation: "obligation.home-support", amount: 4000000 },
    ]);
  });

  test("[R-ENGINE-014] given the lives, when who can drive is read, then Tunde and Ngozi can and the others cannot (car.md)", () => {
    const drivers = Object.values(content.scenario).filter((life) => life.qualities["quality.driving"] === 1);
    expect(drivers.map((life) => life.id)).toEqual(["scenario.tunde", "scenario.ngozi"]);
    expect((text["scenario.ngozi.name"] ?? "").trim()).not.toBe("");
  });
});
