// Carrying a state to newer content: docs/rules/server.md R-SERVER-021 and 022, decision 0006.
import { content as realContent, PREVIOUS_CONTENT_VERSION } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { lifeSaves } from "../goldens/lives.data";
import { miniContent } from "../testing/miniContent";
import { start } from "../testing/play";
import { standInWorld } from "../world/standIn";
import { checkContent } from "./content";
import { checkInvariants } from "./invariants";
import { replay } from "./replay";
import { newState, STATE_SCHEMA, upgradeState } from "./state";
import type { Content, State } from "./types";

/** Every string and key equal to an id in the table renamed. */
function renamedDeep(value: unknown, renames: Record<string, string>): unknown {
  if (typeof value === "string") return renames[value] ?? value;
  if (Array.isArray(value)) return value.map((item) => renamedDeep(item, renames));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [renames[key] ?? key, renamedDeep(inner, renames)]));
  }
  return value;
}

function reversed(renames: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(renames).map(([old, now]) => [now, old]));
}

/** A state as an older content would have held it: old ids, no lottery slice, the first schema. */
function olderState(state: State, renames: Record<string, string>, version: string): State {
  const { seed, ...rest } = state;
  const older = { ...(renamedDeep(rest, reversed(renames)) as Omit<State, "seed">), seed, schema: 1, content: version } as Partial<State>;
  delete older.lottery;
  return older as State;
}

/** A copy of `value` without the named keys. */
function without(value: object, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

const MINI_RENAMES = { "scenario.worker": "scenario.labourer", "route.mini": "route.small" };
const miniTwo: Content = { ...(renamedDeep(miniContent, MINI_RENAMES) as Content), version: "mini.2", renames: MINI_RENAMES };

describe("upgradeState", () => {
  test("[R-SERVER-022] given a state under one content and a newer content that renames two ids, when upgraded, then every value and key holding an old id holds the new one, the seed is untouched and the newer version is recorded", () => {
    const game = start({ scenario: "scenario.worker", seed: "route.mini" });
    game.endTurn([{ activity: "activity.study", param: null }]);
    const before = game.state;
    expect(Object.keys(before.route)).toContain("route.mini");
    const text = JSON.stringify(before);
    const after = upgradeState(before, miniContent, miniTwo);
    expect(JSON.stringify(before)).toBe(text);
    expect(after.scenario).toBe("scenario.labourer");
    expect(Object.keys(after.route)).toContain("route.small");
    expect(JSON.stringify({ ...after, seed: null })).not.toMatch(/"route\.mini"|"scenario\.worker"/);
    expect(after.seed).toBe("route.mini");
    expect(after.content).toBe("mini.2");
    expect(after.v).toBe(before.v);
    expect(checkInvariants(after, miniTwo)).toEqual([]);
  });

  test("[R-SERVER-022] given a state of the first schema without the lottery slice, when upgraded, then the slice is built by its kind's initial and the schema is raised", () => {
    const game = start({ scenario: "scenario.plain" });
    game.endTurn();
    const older = olderState(game.state, {}, miniContent.version);
    expect(older).not.toHaveProperty("lottery");
    const after = upgradeState(older, miniContent, miniContent);
    expect(after.lottery).toEqual(newState("scenario.plain", "any", miniContent).lottery);
    expect(after.schema).toBe(STATE_SCHEMA);
    expect(after).toEqual(game.state);
  });

  test("[R-SERVER-022] [R-SERVER-024] given the same content version under a new overlay, when upgraded, then no id is renamed even if the content carries a table", () => {
    const game = start({ scenario: "scenario.worker" });
    game.endTurn();
    const overlaid: Content = { ...miniContent, overlay: "dials-1", renames: MINI_RENAMES };
    expect(upgradeState(game.state, miniContent, overlaid)).toEqual(game.state);
  });

  test("[R-SERVER-022] given a state for content other than the one it is said to come from, when upgraded, then it throws", () => {
    const game = start({ scenario: "scenario.plain" });
    expect(() => upgradeState(game.state, miniTwo, miniTwo)).toThrow(/for content mini.1, not mini.2/);
  });

  const renames = { "route.uk-study": "route.uk-masters", "activity.hustle": "activity.job-hunt", "chapter.first-steps": "chapter.find-your-feet" };
  const current: Content = { ...realContent, renames };
  const previous: Content = { ...(renamedDeep(realContent, reversed(renames)) as Content), version: "m0.0" };

  test.each(Object.entries(lifeSaves))(
    "[R-SERVER-021] [R-SERVER-022] given the end state of the golden life %s under a previous content with older ids and no lottery, when upgraded to the current content, then it is the life's own end state, the invariants hold and the content passes its check",
    (_name, save) => {
      expect(checkContent(current)).toEqual([]);
      const { state } = replay(save, realContent, (tick) => standInWorld(save.worldSeed, tick, realContent));
      const older = olderState(state, renames, previous.version);
      expect(JSON.stringify(older)).toMatch(/"route\.uk-study"/);
      const after = upgradeState(older, previous, current);
      expect(after).toEqual(state);
      expect(checkInvariants(after, current)).toEqual([]);
    },
  );

  /**
   * A state as the server stored it before schema 4: no `turn.spent`, no
   * `offer.rolled` or `offer.rolledMonth`, no body qualities, schema 3.
   */
  function schemaThree(state: State, version: string): State {
    const turn = without(state.turn, ["spent"]);
    const offer = without(state.offer, ["rolled", "rolledMonth"]);
    const quality = without(state.quality, ["quality.belly", "quality.energy"]);
    return { ...state, schema: 3, content: version, turn, offer, quality } as unknown as State;
  }

  const before: Content = { ...realContent, version: PREVIOUS_CONTENT_VERSION };

  test.each(Object.entries(lifeSaves))(
    "[R-SERVER-021] [R-SERVER-022] given the end state of the golden life %s in the schema 3 shape under the previous content, when upgraded to the current content, then the month's spent half-days, the offers rolled and the body's qualities are filled as a new life starts them, everything else is kept, the schema is raised and the invariants hold",
    (_name, save) => {
      const { state } = replay(save, realContent, (tick) => standInWorld(save.worldSeed, tick, realContent));
      const older = schemaThree(state, before.version);
      expect(older.turn).not.toHaveProperty("spent");
      expect(older.offer).not.toHaveProperty("rolled");
      expect(checkInvariants({ ...older, schema: STATE_SCHEMA, content: realContent.version }, realContent)).toContain("The state holds no value for quality.belly.");
      const after = upgradeState(older, before, realContent);
      const fresh = newState(state.scenario, state.seed, realContent);
      expect(after.schema).toBe(4);
      expect(after.content).toBe(realContent.version);
      expect(after.turn.spent).toBe(0);
      expect([after.offer.rolled, after.offer.rolledMonth]).toEqual([0, 0]);
      expect(after.quality["quality.belly"]).toBe(fresh.quality["quality.belly"]);
      expect(after.quality["quality.energy"]).toBe(fresh.quality["quality.energy"]);
      const kept = (one: State) => ({ ...one, turn: { ...one.turn, spent: 0 }, offer: { ...one.offer, rolled: 0, rolledMonth: 0 }, quality: { ...one.quality, "quality.belly": 0, "quality.energy": 0 } });
      expect(kept(after)).toEqual(kept({ ...state, content: realContent.version }));
      expect(after.nextInstance).toBe(state.nextInstance);
      expect(checkInvariants(after, realContent)).toEqual([]);
    },
  );

  test("[R-SERVER-022] given a state already of the current schema whose turn has spent half-days, when upgraded to a newer version, then nothing inside its slices is refilled", () => {
    const game = start({ scenario: "scenario.plain" });
    game.endTurn();
    const spent: State = { ...game.state, turn: { ...game.state.turn, spent: 3 }, offer: { ...game.state.offer, rolled: 2, rolledMonth: 1 } };
    const after = upgradeState(spent, miniContent, { ...miniContent, version: "mini.2" });
    expect(after.turn.spent).toBe(3);
    expect([after.offer.rolled, after.offer.rolledMonth]).toEqual([2, 1]);
  });
});
