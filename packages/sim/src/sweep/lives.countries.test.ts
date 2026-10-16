// One recorded life per country beyond the UK (design page 15 section 7; sweep/lives.countries.data.ts), replayed through
// the real content with the checks the golden lives carry, so the three countries are reached by a real life.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { measure } from "../engine/golden";
import type { Id } from "../engine/types";
import { lifeStart, loadSave, replay, savedCommands } from "../engine/replay";
import { lifeSaves } from "../goldens/lives.data";
import { standInWorld } from "../world/standIn";
import { countryLifeSaves } from "./lives.countries.data";
import { newLifeSaves } from "./lives.data";

// Canada's and Italy's lives wait on the players' strategies (tools/record-lives.ts): the Gulf's is recorded.
const LANDS: Record<string, { country: Id<"country">; route: Id<"route"> }> = {
  "tunde-gulf": { country: "country.uae", route: "route.gulf-contract" },
};
const recorded = Object.entries(countryLifeSaves).map(([name, save]) => ({ name, save: loadSave(save) }));

describe("the lives recorded for the three countries", () => {
  test("[R-ENGINE-010] given the countries' recordings, when listed, then a life lands in each country recorded (the UAE today), each starts from a life in the content, and none shares a name with another recording", () => {
    expect(recorded.map((script) => script.name).sort()).toEqual(Object.keys(LANDS).sort());
    for (const script of recorded) {
      expect(content.scenario[lifeStart(script.save)!.scenario]).toBeDefined();
      expect(lifeSaves[script.name]).toBeUndefined();
      expect(newLifeSaves[script.name]).toBeUndefined();
    }
  });

  test.each(recorded.map((script) => [script.name, script] as const))(
    "[R-ENGINE-001] [R-ENGINE-010] given %s, when its save is replayed twice through the real content, then every command is accepted, both replays agree, and the life stands in its country by its route",
    (name, script) => {
      const worldAt = (tick: number) => standInWorld(lifeStart(script.save)!.worldSeed, tick, content);
      const first = measure(script.save, content, worldAt);
      expect(measure(script.save, content, worldAt)).toEqual(first);

      const { state } = replay(script.save, content, worldAt);
      const land = LANDS[name]!;
      expect(state.turn.ended).toBe(false);
      expect(state.place).toMatchObject({ where: "abroad", country: land.country });
      expect(state.route[land.route]?.state).toBe("departed");

      const saved = savedCommands(script.save);
      expect(new Set(saved.filter((entry) => entry.sender !== "player").map((entry) => entry.command.type))).toEqual(new Set(saved.some((entry) => entry.sender !== "player") ? ["turns/grant"] : []));
      expect(saved.some((entry) => entry.command.type === "route/depart")).toBe(true);
    },
  );
});
