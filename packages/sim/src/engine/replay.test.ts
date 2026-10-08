// Saves in segments: docs/rules/server.md R-SERVER-020 to 024 and decision 0006.
import { content as realContent } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { goldens } from "../goldens";
import { lifeSaves } from "../goldens/lives.data";
import { miniContent } from "../testing/miniContent";
import type { Loose } from "../testing/play";
import { start } from "../testing/play";
import { standInWorld } from "../world/standIn";
import { measure } from "./golden";
import { hashState } from "./hash";
import { applyOverlay } from "./overlay";
import { isFlatSave, lastSegment, lifeStart, loadSave, newSave, openSegment, recordCommand, replay, savedCommands } from "./replay";
import { upgradeState } from "./state";
import { step } from "./step";
import type { Command, Content, FlatSave, Save, State } from "./types";

const CONTENTS: Record<string, Content> = { [miniContent.version]: miniContent, [realContent.version]: realContent };

function contentOf(version: string): Content {
  const found = CONTENTS[version];
  if (found === undefined) throw new Error(`No content ${version}.`);
  return found;
}

/** Every string and key equal to an old id renamed, as a content version that renames ids would read. */
function renamedDeep(value: unknown, renames: Record<string, string>): unknown {
  if (typeof value === "string") return renames[value] ?? value;
  if (Array.isArray(value)) return value.map((item) => renamedDeep(item, renames));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [renames[key] ?? key, renamedDeep(inner, renames)]));
  }
  return value;
}

const RENAMES = { "scenario.worker": "scenario.labourer", "route.mini": "route.small" };

/** The mini content's next version: two ids renamed, the table that says so, and one number moved. */
const miniTwo: Content = {
  ...(renamedDeep(miniContent, RENAMES) as Content),
  version: "mini.2",
  renames: RENAMES,
  tuning: { ...miniContent.tuning, quality: { ...miniContent.tuning.quality, wellbeingRest: miniContent.tuning.quality.wellbeingRest + 5 } },
};

const worldAt = (tick: number) => standInWorld("world-1", tick, miniContent);

/** Steps a command under `content` and records it in the save's last segment. */
function play(held: { state: State; save: Save; tick: number }, command: Loose, content: Content): void {
  const full: Command = { ...command, basedOn: held.state.v };
  const result = step(held.state, full, worldAt(held.tick), content);
  if (!result.ok) throw new Error(`${command.type} was rejected with ${result.code}: ${result.detail}`);
  held.state = result.state;
  held.save = recordCommand(held.save, full, held.tick, "player");
  if (command.type === "turn/end") held.tick += 1;
}

/** A worker's life of three months under mini.1, then carried to mini.2 and played three more. */
function twoSegments() {
  const game = start({ scenario: "scenario.worker", seed: "segments", worldSeed: "world-1" });
  game.endTurn([{ activity: "activity.study", param: null }]);
  game.endTurn([{ activity: "activity.rest", param: null }]);
  game.endTurn();
  const base = upgradeState(game.state, miniContent, miniTwo);
  const held = { state: base, save: openSegment(game.save, base, miniTwo), tick: game.tick };
  for (let month = 0; month < 3; month += 1) play(held, { type: "turn/end", slots: [{ activity: "activity.rest", param: null }] }, miniTwo);
  return { ...held, base, before: game.state };
}

describe("the flat save of the first milestone", () => {
  test("[R-SERVER-020] [R-ENGINE-010] given every committed golden and recorded life, when loaded, then each is one segment starting from its scenario and replays to its blessed months and final hash", () => {
    const flat = Object.entries(lifeSaves);
    expect(flat.length).toBe(3);
    for (const [, save] of flat) {
      expect(isFlatSave(save)).toBe(true);
      expect(loadSave(save).segments).toEqual([{ content: save.content, start: { scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed }, commands: save.commands }]);
    }
    const cases: [name: string, save: Save | FlatSave][] = [...goldens.map((golden): [string, Save | FlatSave] => [golden.name, golden.save]), ...flat];
    for (const [name, save] of cases) {
      const golden = goldens.find((one) => one.name === name)!;
      const loaded = loadSave(save);
      expect(loaded.schema).toBe(3);
      expect(loaded.segments).toHaveLength(1);
      const begun = lifeStart(loaded)!;
      const used = contentOf(loaded.segments[0]!.content);
      expect(measure(save, used, (tick) => standInWorld(begun.worldSeed, tick, used))).toEqual({ months: golden.months, finalHash: golden.finalHash });
    }
  });

  test("[R-SERVER-020] given a flat save of schema 1 with an overlay, when loaded, then the overlay is kept on its one segment and a save in segments loads as itself", () => {
    const save: FlatSave = { schema: 1, content: "mini.1", overlay: "dials-1", scenario: "scenario.plain", seed: "s", worldSeed: "w", commands: [] };
    expect(loadSave(save)).toEqual({ schema: 3, segments: [{ content: "mini.1", overlay: "dials-1", start: { scenario: "scenario.plain", seed: "s", worldSeed: "w" }, commands: [] }] });
    const segmented = newSave("scenario.plain", "s", "w", miniContent);
    expect(loadSave(segmented)).toBe(segmented);
  });
});

describe("saves in segments", () => {
  test("[R-SERVER-020] given a new life, when commands are recorded, then the save is one segment from the scenario holding them in order", () => {
    const game = start({ scenario: "scenario.worker", seed: "rec", worldSeed: "world-1" });
    expect(game.save).toEqual({ schema: 3, segments: [{ content: miniContent.version, start: { scenario: "scenario.worker", seed: "rec", worldSeed: "world-1" }, commands: [] }] });
    game.endTurn();
    game.grant(2);
    expect(savedCommands(game.save).map((entry) => [entry.command.type, entry.tick, entry.sender])).toEqual([
      ["turn/end", 0, "player"],
      ["turns/grant", 1, "authority"],
    ]);
    expect(lastSegment(game.save).commands).toHaveLength(2);
  });

  test("[R-SERVER-020] [R-SERVER-021] [R-SERVER-022] given a life carried from one content to the next in a second segment, when the save is replayed with both contents, then each segment runs under its own and the final state and every version match", () => {
    const { state, save, base, before } = twoSegments();
    expect(save.segments.map((segment) => segment.content)).toEqual(["mini.1", "mini.2"]);
    expect(save.segments[1]!.start).toEqual({ base });
    expect(before.scenario).toBe("scenario.worker");
    expect(base.scenario).toBe("scenario.labourer");
    const rebuilt = replay(save, [miniContent, miniTwo], worldAt);
    expect(rebuilt.state).toEqual(state);
    expect(rebuilt.versions).toEqual([1, 2, 3, 4, 5, 6]);
    expect(hashState(replay(save, [miniTwo, miniContent], worldAt).state)).toBe(hashState(state));
    expect(replay(JSON.parse(JSON.stringify(save)) as Save, [miniContent, miniTwo], worldAt).state).toEqual(state);
  });

  test("[R-SERVER-021] given a second segment whose base is not the upgrade of the first segment's end, when replayed, then it throws", () => {
    const { save, base } = twoSegments();
    const doctored = { ...base, wallet: { ...base.wallet, pockets: { ...base.wallet.pockets, NGN: { ...base.wallet.pockets.NGN, bank: base.wallet.pockets.NGN.bank + 100 } } } };
    const tampered: Save = { ...save, segments: [save.segments[0]!, { ...save.segments[1]!, start: { base: doctored } }] };
    expect(() => replay(tampered, [miniContent, miniTwo], worldAt)).toThrow(/base is not the state the segment before ended in/);
  });

  test("[R-SERVER-020] given a save of two segments, when replayed without the content one names, or with a second segment that starts a new life, then it throws", () => {
    const { save } = twoSegments();
    expect(() => replay(save, [miniContent], worldAt)).toThrow(/No content mini.2 under overlay none/);
    expect(() => replay(save, miniContent, worldAt)).toThrow(/for content mini.2, not mini.1/);
    const restart: Save = { ...save, segments: [save.segments[0]!, { ...save.segments[1]!, start: { scenario: "scenario.plain", seed: "x", worldSeed: "y" } }] };
    expect(() => replay(restart, [miniContent, miniTwo], worldAt)).toThrow(/only the first segment may/);
  });

  test("[R-SERVER-024] [R-ENGINE-010] given a new overlay on the same content, when the life goes on in a new segment, then the segment records the overlay and the save replays with both", () => {
    const over = applyOverlay(miniContent, { version: "dials-9", tuning: { quality: { wellbeingRest: 20 } } });
    const game = start({ scenario: "scenario.plain", seed: "dials", worldSeed: "world-1" });
    game.endTurn();
    const base = upgradeState(game.state, miniContent, over);
    expect(base).toEqual(game.state);
    const held = { state: base, save: openSegment(game.save, base, over), tick: game.tick };
    play(held, { type: "turn/end", slots: [{ activity: "activity.rest", param: null }] }, over);
    expect(held.save.segments.map((segment) => segment.overlay)).toEqual([undefined, "dials-9"]);
    expect(replay(held.save, [miniContent, over], worldAt).state).toEqual(held.state);
    expect(() => replay(held.save, miniContent, worldAt)).toThrow(/overlay dials-9, not none/);
  });

  test("[R-SERVER-021] given a base for other content, when a segment is opened on it, then it throws", () => {
    const game = start({ scenario: "scenario.plain" });
    expect(() => openSegment(game.save, game.state, miniTwo)).toThrow(/for content mini.1, not mini.2/);
  });
});
