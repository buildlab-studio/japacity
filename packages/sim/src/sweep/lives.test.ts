// The three real lives as golden scripts: a whole plan from the first job to
// the flight, and a careful life that carries on 36 months abroad and comes
// home by choice, replayed through the real content.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { measure } from "../engine/golden";
import { lifeStart, replay, savedCommands } from "../engine/replay";
import { goldens } from "../goldens";
import { lifeScripts } from "../goldens/scripts";
import { start } from "../testing/play";
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

/** The second recording of each life carries on abroad; the first ends on the flight. */
const flights = lifeScripts.filter((script) => !script.name.endsWith("-abroad"));
const abroad = lifeScripts.filter((script) => script.name.endsWith("-abroad"));
const MONTHS_ABROAD = 36;

describe("the three real lives as golden scripts", () => {
  test("[R-ENGINE-010] given the scripts, when listed, then there is one to the flight and one abroad for each starting life", () => {
    // The three first-milestone lives. Ngozi's route needs the gates of the whole-life milestone before she can be scripted.
    expect(flights.map((script) => lifeStart(script.save)?.scenario).sort()).toEqual(["scenario.ada", "scenario.tunde", "scenario.zainab"]);
    expect(abroad.map((script) => lifeStart(script.save)?.scenario).sort()).toEqual(["scenario.ada", "scenario.tunde", "scenario.zainab"]);
    for (const script of lifeScripts) expect(content.scenario[lifeStart(script.save)!.scenario]).toBeDefined();
  });

  test.each(flights.map((script) => [script.name, script] as const))(
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

  test.each(abroad.map((script) => [script.name, script] as const))(
    "[R-ENGINE-010] [R-STATUS-006] [R-RETURN-005] [R-PLACE-004] [R-PLACE-005] given %s, when its save is replayed through the real content, then the life flies, holds a lawful status for 36 months abroad, renews it, never misses its rent, answers the December scene and comes home by choice",
    (_name, script) => {
      const first = lifeStart(script.save)!;
      const worldAt = (tick: number) => standInWorld(first.worldSeed, tick, content);
      expect(measure(script.save, content, worldAt)).toEqual(measure(script.save, content, worldAt));

      const game = start({ scenario: first.scenario, seed: first.seed, worldSeed: first.worldSeed, content });
      let departed: number | null = null;
      let renewed = 0;
      let december = 0;
      let rentMissed = 0;
      let unlawful = 0;
      for (const { command, sender } of savedCommands(script.save)) {
        const result = game.accept(command, sender);
        if (command.type === "route/depart") departed = game.state.turn.month;
        for (const event of result.events as (typeof result.events[number] & { entry?: string })[]) {
          if (event.type === "status/renewed") renewed += 1;
          if (event.type === "setpiece/closed" && event.entry === "setpiece.december") december += 1;
          if (event.type === "obligation/missed" && String(event.entry).includes("rent")) rentMissed += 1;
        }
        const status = game.state.status.current;
        if (game.state.place.where === "abroad" && (status === null || content.status[status.entry]?.work === "cash")) unlawful += 1;
      }
      expect(departed).not.toBeNull();
      expect(game.state.turn.month - (departed ?? 0)).toBe(MONTHS_ABROAD);
      expect(renewed).toBeGreaterThanOrEqual(1);
      expect(december).toBeGreaterThanOrEqual(1);
      expect(rentMissed).toBe(0);
      expect(unlawful).toBe(0);
      expect(game.state.place.where).toBe("home");
      expect(game.state.place.returns.map((entry) => entry.shape)).toEqual(["by-choice"]);
      const commands = savedCommands(script.save);
      expect(commands[commands.length - 1]?.command.type).toBe("return/home");
    },
  );

  // Finding: engine/goldens.test.ts replays every blessed golden against the
  test("[R-ENGINE-010] given the life scripts, when compared with the blessed goldens, then each has a golden with the same save", () => {
    for (const script of lifeScripts) {
      expect(goldens.find((golden) => golden.name === script.name)?.save).toEqual(script.save);
    }
  });
});
