import { ScenarioEntrySchema } from "@japacity/sim/schemas";
import { describe, expect, test } from "vitest";

import { content, text } from "../index";
import { nurseScenario } from "./scenario.data";

describe("the nurse", () => {
  test("[engine:content-checked-before-play] given the nurse, when the life is checked against the scenario schema, then it parses and holds every quality within its range", () => {
    expect(ScenarioEntrySchema.safeParse(nurseScenario).error?.issues ?? []).toEqual([]);
    const out = Object.values(content.quality).filter((quality) => {
      const value = nurseScenario.qualities[quality.id];
      return value === undefined || value < quality.min || value > quality.max;
    });
    expect(out.map((quality) => quality.id)).toEqual([]);
    expect(Object.keys(nurseScenario.qualities).filter((id) => !(id in content.quality))).toEqual([]);
  });

  test("[engine:content-checked-before-play] given the nurse, when the ids the life names are looked up, then each exists and the life is in the table", () => {
    const named = [
      ...(nurseScenario.job === null ? [] : [nurseScenario.job]),
      ...Object.keys(nurseScenario.tenure),
      ...nurseScenario.documents.map((held) => held.document),
      ...nurseScenario.obligations.map((owed) => owed.obligation),
    ];
    const missing = named.filter((id) => {
      const kind = id.slice(0, id.indexOf(".")) as "activity" | "document" | "obligation";
      return (content[kind] as Record<string, unknown>)[id] === undefined;
    });
    expect(missing).toEqual([]);
    expect(content.scenario["scenario.nurse"]).toBe(nurseScenario);
  });

  test("[engine:content-checked-before-play] given the nurse, when figures from route-gates.md are read back, then each matches the page", () => {
    expect(nurseScenario.qualities).toMatchObject({
      "quality.age-months": 324,
      "quality.education-grade": 4,
      "quality.english": 58,
      "quality.care": 60,
      "quality.network": 25,
      "quality.family-means": 30,
      "quality.standing": 65,
      "quality.wellbeing": 50,
      "quality.driving": 1,
    });
    expect(nurseScenario.job).toBe("activity.job-nurse");
    expect(nurseScenario.tenure).toEqual({ "activity.job-nurse": 30 });
    expect(nurseScenario.pockets.NGN).toEqual({ bank: 65000000, cash: 3000000 });
    expect(nurseScenario.documents).toEqual([
      { document: "document.passport", monthsLeft: 40, value: null },
      { document: "document.nursing-licence", monthsLeft: 30, value: null },
    ]);
    expect(nurseScenario.obligations).toEqual([
      { obligation: "obligation.upkeep", amount: 12000000 },
      { obligation: "obligation.home-support", amount: 4000000 },
    ]);
  });

  test("[engine:content-checked-before-play] given the lives, when who can drive is read, then the banker and the nurse can and the others cannot (car.md)", () => {
    const drivers = Object.values(content.scenario).filter((life) => life.qualities["quality.driving"] === 1);
    expect(drivers.map((life) => life.id)).toEqual(["scenario.banker", "scenario.nurse"]);
    expect(text["scenario.nurse.kind"]).toBe("The nurse");
    expect(text["scenario.nurse.name"]).toBeUndefined();
  });
});
