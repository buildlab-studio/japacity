// The three real lives as golden scripts: a whole plan from the first job to
// the flight, replayed through the real content.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { measure } from "../engine/golden";
import { lifeStart, replay, savedCommands } from "../engine/replay";
import { goldens } from "../goldens";
import { lifeScripts } from "../goldens/scripts";
import { standInWorld } from "../world/standIn";

/** What every plan that reaches the flight must have played; the risky player skips the prep and the family meeting. */
const SLOTS_EVERY_PLAN_PLAYS = [
  "activity.job-hunt",
  "activity.get-passport",
  "activity.get-transcript",
  "activity.sit-english-test",
  "activity.apply-to-school",
  "activity.tb-test",
  "activity.apply-for-visa",
];

describe("the three real lives as golden scripts", () => {
  test("[R-ENGINE-010] given the scripts, when listed, then there is one for each starting life", () => {
    // The three first-milestone lives. Ngozi's route needs the gates of the whole-life milestone before she can be scripted.
    expect(lifeScripts.map((script) => lifeStart(script.save)?.scenario).sort()).toEqual(["scenario.ada", "scenario.tunde", "scenario.zainab"]);
    for (const script of lifeScripts) expect(content.scenario[lifeStart(script.save)!.scenario]).toBeDefined();
  });

  test.each(lifeScripts.map((script) => [script.name, script] as const))(
    "[R-ENGINE-001] [R-ENGINE-010] given %s, when its save is replayed twice through the real content, then every command is accepted, both replays agree month by month, and the flight leaves within 24 to 40 months with the life going on abroad",
    (_name, script) => {
      const worldAt = (tick: number) => standInWorld(lifeStart(script.save)!.worldSeed, tick, content);
      const first = measure(script.save, content, worldAt);
      const second = measure(script.save, content, worldAt);
      expect(second).toEqual(first);

      const { state } = replay(script.save, content, worldAt);
      // R-GATE-003: the flight no longer ends the life.
      expect(state.turn.ended).toBe(false);
      expect(state.place).toMatchObject({ where: "abroad", country: "country.uk" });
      expect(state.route["route.uk-masters"]?.state).toBe("departed");
      expect(state.turn.month).toBeGreaterThanOrEqual(24);
      expect(state.turn.month).toBeLessThanOrEqual(40);
      // Chapter 3 is left out on purpose: a borrower whose held funds lapse while the visa is decided flies with it open (see the playtest report).
      expect(state.chapter.done).toEqual(expect.arrayContaining(["chapter.find-your-feet", "chapter.build-the-file"]));

      const commands = savedCommands(script.save).map((entry) => entry.command);
      const slots = new Set(commands.flatMap((command) => (command.type === "turn/end" ? command.slots.map((pick) => pick.activity) : [])));
      expect([...slots]).toEqual(expect.arrayContaining(SLOTS_EVERY_PLAN_PLAYS));
      const types = new Set(commands.map((command) => command.type));
      expect([...types]).toEqual(expect.arrayContaining(["offer/choose", "route/pay-deposit", "setpiece/answer", "route/depart"]));
    },
  );

  // Finding: engine/goldens.test.ts replays every blessed golden against the
  test("[R-ENGINE-010] given the life scripts, when compared with the blessed goldens, then each has a golden with the same save", () => {
    for (const script of lifeScripts) {
      expect(goldens.find((golden) => golden.name === script.name)?.save).toEqual(script.save);
    }
  });
});
