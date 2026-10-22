import { ScenarioEntrySchema } from "@japacity/sim/schemas";
import { describe, expect, test } from "vitest";

import { content, text } from "../index";
import { teacherScenario } from "./scenario.data";

describe("the teacher, the fifth life", () => {
  test("[engine:content-checked-before-play] given the teacher, when the life is checked against the scenario schema, then it parses and holds every quality within its range", () => {
    expect(ScenarioEntrySchema.safeParse(teacherScenario).error?.issues ?? []).toEqual([]);
    const out = Object.values(content.quality).filter((quality) => {
      const value = teacherScenario.qualities[quality.id];
      return value === undefined || value < quality.min || value > quality.max;
    });
    expect(out.map((quality) => quality.id)).toEqual([]);
    expect(Object.keys(teacherScenario.qualities).filter((id) => !(id in content.quality))).toEqual([]);
  });

  test("[engine:content-checked-before-play] given the teacher, when the ids the life names are looked up, then each exists and the life is in the table", () => {
    const named = [
      ...(teacherScenario.job === null ? [] : [teacherScenario.job]),
      ...Object.keys(teacherScenario.tenure),
      ...teacherScenario.documents.map((held) => held.document),
      ...teacherScenario.obligations.map((owed) => owed.obligation),
    ];
    const missing = named.filter((id) => {
      const kind = id.slice(0, id.indexOf(".")) as "activity" | "document" | "obligation";
      return (content[kind] as Record<string, unknown>)[id] === undefined;
    });
    expect(missing).toEqual([]);
    expect(content.scenario["scenario.teacher"]).toBe(teacherScenario);
  });

  test("[engine:content-checked-before-play] given the teacher, when its words are looked up, then it has a role and a blurb, and no name, first name or sex of its own (scenario.md)", () => {
    expect(text["scenario.teacher.kind"]).toBe("The teacher");
    expect((text["scenario.teacher.blurb"] ?? "").trim()).not.toBe("");
    expect(text["scenario.teacher.name"]).toBeUndefined();
    expect(text["share.first-name.scenario.teacher"]).toBeUndefined();
    expect(teacherScenario.sex).toBeUndefined();
  });

  test("[engine:content-checked-before-play] given the teacher, when its starting figures are read at their edges, then it is a teacher who can just hunt for a junior developer's job and cannot drive", () => {
    const junior = content.activity["activity.job-junior-developer"]?.requires.find((need) => need.type === "quality/min");
    expect(junior).toMatchObject({ quality: "quality.tech" });
    const floor = junior !== undefined && "value" in junior ? junior.value : 0;
    expect(teacherScenario.qualities["quality.tech"]).toBeGreaterThanOrEqual(floor);
    expect(teacherScenario.qualities["quality.tech"]! - 3).toBeLessThan(floor);
    expect(teacherScenario.job).toBe("activity.job-teacher");
    expect(teacherScenario.qualities["quality.driving"]).toBe(0);
  });
});
