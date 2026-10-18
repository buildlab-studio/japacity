// Chips earn their place (docs/design/13-the-lively-layer.md section 2): no Free on sleep, a bath or water,
// Free on a meal; no time chip for a morning; at most two effect chips.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { chipEffectsOf, chipTimeOf, EFFECTS_MAX, freeShown } from "./chips";
import { effectWordsOf, timeWordsOf } from "./acts";
import { say } from "./text";

describe("chips earn their place", () => {
  test("[world:one-action-one-sheet] given sleep, a nap, a bath and water, when Free would show, then it never does; a meal at home that costs nothing would say it", () => {
    const never = ["activity.nap", "activity.bucket-bath", "activity.fetch-water", "activity.fill-drum", "activity.watch-tv"];
    expect(never.filter((act) => freeShown(act))).toEqual([]);
    expect(freeShown("activity.cook-at-home")).toBe(true);
  });

  test("[world:one-action-one-sheet] given an act that takes a morning, when its time chip is read, then there is none; a day or more shows", () => {
    expect(timeWordsOf("activity.cook-at-home")).toBe(say("ui.world.time.morning"));
    expect(chipTimeOf("activity.cook-at-home")).toBeNull();
    const longer = Object.keys(content.activity).find((act) => timeWordsOf(act) !== null && timeWordsOf(act) !== say("ui.world.time.morning")) ?? "";
    expect(longer).not.toBe("");
    expect(chipTimeOf(longer)).toBe(timeWordsOf(longer));
  });

  test("[world:one-action-one-sheet] given an act that does several things, when its effect chips are read, then there are at most two", () => {
    expect(EFFECTS_MAX).toBe(2);
    expect(chipEffectsOf("activity.cook-at-home").length).toBeLessThanOrEqual(2);
    expect(chipEffectsOf("activity.cook-at-home")).toEqual((effectWordsOf("activity.cook-at-home") ?? "").split(", ").slice(0, 2).map((part) => part.charAt(0).toUpperCase() + part.slice(1)));
  });
});
