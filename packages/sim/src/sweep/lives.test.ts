// The three real lives as golden scripts: a whole plan from the first job to
// the flight, replayed through the real content.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { measure } from "../engine/golden";
import { replay } from "../engine/replay";
import { goldens } from "../goldens";
import { lifeScripts } from "../goldens/scripts";
import { standInWorld } from "../world/standIn";

const SLOTS_EVERY_PLAN_PLAYS = [
  "activity.job-hunt",
  "activity.study-english",
  "activity.get-passport",
  "activity.get-transcript",
  "activity.sit-english-test",
  "activity.apply-to-school",
  "activity.family-meeting",
  "activity.tb-test",
  "activity.apply-for-visa",
];

describe("the three real lives as golden scripts", () => {
  test("[R-ENGINE-010] given the scripts, when listed, then there is one for each starting life", () => {
    expect(lifeScripts.map((script) => script.save.scenario).sort()).toEqual(Object.keys(content.scenario).sort());
  });

  test.each(lifeScripts.map((script) => [script.name, script] as const))(
    "[R-ENGINE-001] [R-ENGINE-010] given %s, when its save is replayed twice through the real content, then every command is accepted, both replays agree month by month, and the life ends on the flight within 24 to 40 months",
    (_name, script) => {
      const worldAt = (tick: number) => standInWorld(script.save.worldSeed, tick, content);
      const first = measure(script.save, content, worldAt);
      const second = measure(script.save, content, worldAt);
      expect(second).toEqual(first);

      const { state } = replay(script.save, content, worldAt);
      expect(state.turn.ended).toBe(true);
      expect(state.route["route.uk-masters"]?.state).toBe("departed");
      expect(state.turn.month).toBeGreaterThanOrEqual(24);
      expect(state.turn.month).toBeLessThanOrEqual(40);
      // Chapter 3 is left out on purpose: a borrower whose held funds lapse while the visa is decided flies with it open (see the playtest report).
      expect(state.chapter.done).toEqual(expect.arrayContaining(["chapter.find-your-feet", "chapter.build-the-file"]));

      const commands = script.save.commands.map((entry) => entry.command);
      const slots = new Set(commands.flatMap((command) => (command.type === "turn/end" ? command.slots.map((pick) => pick.activity) : [])));
      expect([...slots]).toEqual(expect.arrayContaining(SLOTS_EVERY_PLAN_PLAYS));
      const types = new Set(commands.map((command) => command.type));
      expect([...types]).toEqual(expect.arrayContaining(["offer/choose", "route/pay-deposit", "setpiece/answer", "route/depart"]));
    },
  );

  // Finding: engine/goldens.test.ts replays every blessed golden against the
  // mini content only, so a golden on the real content cannot be blessed
  // without failing it. These scripts stay out of `goldenScripts` until that
  // test looks the content up by the save's version, as tools/bless.ts does.
  test.fails("[R-ENGINE-010] given the life scripts, when compared with the blessed goldens, then each has a golden with the same save", () => {
    for (const script of lifeScripts) {
      expect(goldens.find((golden) => golden.name === script.name)?.save).toEqual(script.save);
    }
  });
});
