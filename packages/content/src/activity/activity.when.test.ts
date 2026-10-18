// When each act answers: activity:now-acts-and-month-acts.
import { describe, expect, test } from "vitest";

import { content } from "../index";
import { nowActIds } from "./activity.when.data";

describe("when each act answers", () => {
  test("[activity:now-acts-and-month-acts] given the table of now-acts, when each id is looked up, then it names an activity in content that answers now, so no now-act is a typo that leaves an act in the month", () => {
    for (const id of nowActIds) expect({ id, when: content.activity[id as keyof typeof content.activity]?.when }).toEqual({ id, when: "now" });
    expect(Object.values(content.activity).filter((entry) => entry.when === "now").map((entry) => entry.id).sort()).toEqual([...nowActIds].sort());
  });
});
