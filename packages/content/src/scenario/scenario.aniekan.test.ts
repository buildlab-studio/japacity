import { ScenarioEntrySchema } from "@japacity/sim/schemas";
import { describe, expect, test } from "vitest";

import { content, text } from "../index";
import { aniekanScenario } from "./scenario.data";

describe("Aniekan, the fifth life", () => {
  test("[engine:content-checked-before-play] given Aniekan, when he is checked against the scenario schema, then he parses and holds every quality within its range", () => {
    expect(ScenarioEntrySchema.safeParse(aniekanScenario).error?.issues ?? []).toEqual([]);
    const out = Object.values(content.quality).filter((quality) => {
      const value = aniekanScenario.qualities[quality.id];
      return value === undefined || value < quality.min || value > quality.max;
    });
    expect(out.map((quality) => quality.id)).toEqual([]);
    expect(Object.keys(aniekanScenario.qualities).filter((id) => !(id in content.quality))).toEqual([]);
  });

  test("[engine:content-checked-before-play] given Aniekan, when the ids he names are looked up, then each exists and he is in the table", () => {
    const named = [
      ...(aniekanScenario.job === null ? [] : [aniekanScenario.job]),
      ...Object.keys(aniekanScenario.tenure),
      ...aniekanScenario.documents.map((held) => held.document),
      ...aniekanScenario.obligations.map((owed) => owed.obligation),
    ];
    const missing = named.filter((id) => {
      const kind = id.slice(0, id.indexOf(".")) as "activity" | "document" | "obligation";
      return (content[kind] as Record<string, unknown>)[id] === undefined;
    });
    expect(missing).toEqual([]);
    expect(content.scenario["scenario.aniekan"]).toBe(aniekanScenario);
  });

  test("[engine:content-checked-before-play] given Aniekan, when his words are looked up, then he has a name, a blurb and a first name for the cards", () => {
    expect((text["scenario.aniekan.name"] ?? "").trim()).not.toBe("");
    expect((text["scenario.aniekan.blurb"] ?? "").trim()).not.toBe("");
    expect(text["share.first-name.scenario.aniekan"]).toBe("Aniekan");
    expect(text["scenario.aniekan.name"]?.startsWith(text["share.first-name.scenario.aniekan"] ?? "-")).toBe(true);
  });

  test("[engine:content-checked-before-play] given Aniekan, when his starting figures are read at their edges, then he is a teacher who can just hunt for a junior developer's job and cannot drive", () => {
    const junior = content.activity["activity.job-junior-dev"]?.requires.find((need) => need.type === "quality/min");
    expect(junior).toMatchObject({ quality: "quality.tech" });
    const floor = junior !== undefined && "value" in junior ? junior.value : 0;
    expect(aniekanScenario.qualities["quality.tech"]).toBeGreaterThanOrEqual(floor);
    expect(aniekanScenario.qualities["quality.tech"]! - 3).toBeLessThan(floor);
    expect(aniekanScenario.job).toBe("activity.job-teacher");
    expect(aniekanScenario.qualities["quality.driving"]).toBe(0);
  });
});
