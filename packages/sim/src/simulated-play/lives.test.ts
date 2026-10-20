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
import { FLIGHT_WINDOW, MONTHS_ABROAD } from "./lives.window";

/** The second recording of each life carries on abroad; the first ends on the flight. */
const flights = lifeScripts.filter((script) => !script.name.endsWith("-abroad"));
const abroad = lifeScripts.filter((script) => script.name.endsWith("-abroad"));

describe("the three real lives as golden scripts", () => {
  test("[engine:state-is-plain-data] given the scripts, when listed, then there is one to the flight and one abroad for each starting life", () => {
    // The three recorded lives. The nurse, a scenario as well, has none.
    expect(flights.map((script) => lifeStart(script.save)?.scenario).sort()).toEqual(["scenario.banker", "scenario.developer", "scenario.graduate"]);
    expect(abroad.map((script) => lifeStart(script.save)?.scenario).sort()).toEqual(["scenario.banker", "scenario.developer", "scenario.graduate"]);
    for (const script of lifeScripts) expect(content.scenario[lifeStart(script.save)!.scenario]).toBeDefined();
  });

  test.each(flights.map((script) => [script.name, script] as const))(
    "[engine:same-inputs-same-result] [engine:state-is-plain-data] given %s, when its save is replayed twice through the real content, then every command is accepted and sent by the player, both replays agree month by month, and the save ends on a flight within the recorder's window with the life going on abroad",
    (_name, script) => {
      const worldAt = (tick: number) => standInWorld(lifeStart(script.save)!.worldSeed, tick, content);
      const first = measure(script.save, content, worldAt);
      const second = measure(script.save, content, worldAt);
      expect(second).toEqual(first);

      const { state } = replay(script.save, content, worldAt);
      // route-gates:departure-grants-status: the flight does not end the life.
      expect(state.turn.ended).toBe(false);
      expect(state.place).toMatchObject({ where: "abroad", country: "country.uk" });
      expect(state.route["route.uk-masters"]?.state).toBe("departed");
      expect(state.turn.month).toBeGreaterThanOrEqual(FLIGHT_WINDOW.first);
      expect(state.turn.month).toBeLessThanOrEqual(FLIGHT_WINDOW.last);
      // Chapter 3 is left out on purpose: a borrower whose held funds lapse while the visa is decided flies with it open.
      expect(state.chapter.done).toEqual(expect.arrayContaining(["chapter.find-your-feet", "chapter.build-the-file"]));

      const saved = savedCommands(script.save);
      expect(new Set(saved.map((entry) => entry.sender))).toEqual(new Set(["player"]));
      expect(saved[saved.length - 1]?.command).toEqual(expect.objectContaining({ type: "route/depart", route: "route.uk-masters" }));
      // The master's route flies only with the school's deposit paid (route:visa-application-needs) and the credibility interview answered (route:application-opens-interview).
      const types = new Set(saved.map((entry) => entry.command.type));
      expect([...types]).toEqual(expect.arrayContaining(["route/pay-deposit", "setpiece/answer", "route/depart"]));
    },
  );

  test.each(abroad.map((script) => [script.name, script] as const))(
    "[engine:state-is-plain-data] [status:renewing-a-status] [return:december-visit-set-piece] [place:return-home-paid-or-assisted] [place:return-shape-decided-at-once] given %s, when its save is replayed through the real content, then the life flies, holds a lawful status for 36 months abroad, renews it, never misses its rent, answers the December scene and comes home by choice",
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

  test.each(abroad.map((script) => [script.name, script] as const))(
    "[chapter:met-items-close-the-chapter] [chapter:chapters-follow-lean-route] given %s, which flies on the skilled worker's route it never leaned to, when its save is replayed through the real content, then its chapters end past the send-off: the send-off and Landing are done and Secure is current",
    (_name, script) => {
      const first = lifeStart(script.save)!;
      const { state } = replay(script.save, content, (tick) => standInWorld(first.worldSeed, tick, content));
      expect(state.route["route.uk-skilled"]?.state).toBe("departed");
      expect(state.chapter.done).toEqual(["chapter.find-your-feet", "chapter.build-the-file", "chapter.decision-day", "chapter.send-off", "chapter.landing"]);
      expect(state.chapter.current).toBe("chapter.secure");
    },
  );

  // engine/goldens.test.ts replays every blessed golden; this ties each life script to its golden.
  test("[engine:state-is-plain-data] given the life scripts, when compared with the blessed goldens, then each has a golden with the same save", () => {
    for (const script of lifeScripts) {
      expect(goldens.find((golden) => golden.name === script.name)?.save).toEqual(script.save);
    }
  });
});
