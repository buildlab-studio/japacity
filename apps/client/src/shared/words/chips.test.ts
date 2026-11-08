// Chips earn their place (docs/design/09-the-games-look.md section 2): no Free on sleep, a bath or water,
// Free on a meal; no time chip for a morning; at most two gains, and a cost to the body or the mood always shown.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { engineView } from "../testing/fixtures";
import { chipTimeOf, freeShown } from "./chips";
import { effectTagsOf, timeWordsOf } from "./acts";
import { actFacts } from "./facts";
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

  test("[world:one-action-one-sheet] [text:show-then-tell] given an act that does several things, when its tags are read, then at most two gains show, and a cost to the body or the mood stands beside them with a down arrow", () => {
    const view = engineView();
    const many = Object.keys(content.activity).find((act) => effectTagsOf(act).filter((tag) => tag.tone === "up").length > 2 && effectTagsOf(act).some((tag) => tag.tone === "down"));
    const acts = many === undefined ? Object.keys(content.activity) : [many, ...Object.keys(content.activity)];
    for (const id of acts) {
      const { changes } = actFacts(view, { id: id as never });
      expect(changes.filter((change) => change.tone === "up").length).toBeLessThanOrEqual(2);
      expect(changes.filter((change) => change.tone === "down")).toEqual(effectTagsOf(id).filter((tag) => tag.tone === "down"));
    }
    expect(effectTagsOf("activity.study-english")).toEqual([
      { tone: "up", words: "+2 English" },
      { tone: "down", words: say("ui.act.does.tires") },
    ]);
  });
});
