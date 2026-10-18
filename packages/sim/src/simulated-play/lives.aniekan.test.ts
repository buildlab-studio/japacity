// The simulated lives played beside the goldens (simulated-play/lives.data.ts),
// replayed through the real content with the checks the golden lives carry.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { measure } from "../engine/golden";
import { lifeStart, loadSave, replay, savedCommands } from "../engine/replay";
import { lifeSaves } from "../goldens/lives.data";
import { standInWorld } from "../world/standIn";
import { simulatedLifeSaves } from "./lives.data";
import { FLIGHT_WINDOW } from "./lives.window";

const recorded = Object.entries(simulatedLifeSaves).map(([name, save]) => ({ name, save: loadSave(save) }));

describe("the simulated lives played beside the goldens", () => {
  test("[engine:state-is-plain-data] given the simulated recordings, when listed, then they are Aniekan's, each starts from a life in the content, and none shares a name with a golden life", () => {
    expect(recorded.map((script) => lifeStart(script.save)?.scenario)).toEqual(["scenario.aniekan"]);
    for (const script of recorded) {
      expect(content.scenario[lifeStart(script.save)!.scenario]).toBeDefined();
      expect(lifeSaves[script.name]).toBeUndefined();
    }
  });

  test.each(recorded.map((script) => [script.name, script] as const))(
    "[engine:same-inputs-same-result] [engine:state-is-plain-data] given %s, when its save is replayed twice through the real content, then every command is accepted and sent by the player (the authority only granting turns), both replays agree month by month, and the save ends on a flight within the recorder's window",
    (_name, script) => {
      const worldAt = (tick: number) => standInWorld(lifeStart(script.save)!.worldSeed, tick, content);
      const first = measure(script.save, content, worldAt);
      expect(measure(script.save, content, worldAt)).toEqual(first);

      const { state } = replay(script.save, content, worldAt);
      expect(state.turn.ended).toBe(false);
      expect(state.place).toMatchObject({ where: "abroad", country: "country.uk" });
      expect(state.route["route.uk-masters"]?.state).toBe("departed");
      expect(state.turn.month).toBeGreaterThanOrEqual(FLIGHT_WINDOW.first);
      expect(state.turn.month).toBeLessThanOrEqual(FLIGHT_WINDOW.last);
      expect(state.chapter.done).toEqual(expect.arrayContaining(["chapter.find-your-feet", "chapter.build-the-file"]));

      const saved = savedCommands(script.save);
      // The player sends everything but the turns the authority grants when the bank runs dry over a long life, as the abroad recordings carry them.
      expect(new Set(saved.filter((entry) => entry.sender !== "player").map((entry) => entry.command.type))).toEqual(new Set(saved.some((entry) => entry.sender !== "player") ? ["turns/grant"] : []));
      expect(saved[saved.length - 1]?.command).toEqual(expect.objectContaining({ type: "route/depart", route: "route.uk-masters" }));
      const types = new Set(saved.map((entry) => entry.command.type));
      expect([...types]).toEqual(expect.arrayContaining(["route/pay-deposit", "setpiece/answer", "route/depart"]));
    },
  );
});
