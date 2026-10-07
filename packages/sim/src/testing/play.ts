// A small game handle for rule tests: start a life, send commands, end turns,
// read the view. The tick advances by one for each turn played, as the first
// milestone's clock does (engine.md section 7).
import { newSave, recordCommand } from "../engine/replay";
import { newState } from "../engine/state";
import { step } from "../engine/step";
import type {
  Command,
  Content,
  Id,
  PlayerView,
  Rejection,
  RejectionCode,
  Save,
  Sender,
  SlotPick,
  State,
  StepResult,
  World,
} from "../engine/types";
import { viewFor } from "../engine/view";
import { standInWorld } from "../world/standIn";
import { miniContent } from "./miniContent";

export interface StartOptions {
  scenario?: Id<"scenario">;
  seed?: string;
  worldSeed?: string;
  content?: Content;
  /** A world builder other than the stand-in, for tests that fix the world. */
  worldAt?: (tick: number) => World;
}

/** A command without `basedOn`: the handle fills it from the state. */
export type Loose = Command extends infer C ? (C extends { basedOn: number } ? Omit<C, "basedOn"> : never) : never;

export interface Game {
  readonly content: Content;
  state: State;
  save: Save;
  tick: number;
  world(): World;
  view(): PlayerView;
  /** Sends a command based on the current version. Advances the tick after an accepted `turn/end`. */
  send(command: Loose, sender?: Sender): StepResult;
  /** Sends a command and throws if it is rejected. */
  accept(command: Loose, sender?: Sender): Extract<StepResult, { ok: true }>;
  /** Ends the turn with the given slots, or every slot resting. Throws if rejected. */
  endTurn(slots?: SlotPick[]): Extract<StepResult, { ok: true }>;
  /** Sends a command and throws unless it is rejected with the given code. */
  expectRejected(command: Loose, code: RejectionCode, sender?: Sender): Rejection;
  /** Grants turns as the authority. */
  grant(count: number): Extract<StepResult, { ok: true }>;
}

export function start(options: StartOptions = {}): Game {
  const content = options.content ?? miniContent;
  const scenario = options.scenario ?? (Object.keys(content.scenario)[0] as Id<"scenario">);
  const seed = options.seed ?? "seed-1";
  const worldSeed = options.worldSeed ?? "world-1";
  const worldAt = options.worldAt ?? ((tick: number) => standInWorld(worldSeed, tick, content));

  const game: Game = {
    content,
    state: newState(scenario, seed, content),
    save: newSave(scenario, seed, worldSeed, content),
    tick: 0,
    world: () => worldAt(game.tick),
    view: () => viewFor({ state: game.state, world: game.world(), content }),
    send(loose, sender = "player") {
      const command: Command = { ...loose, basedOn: game.state.v };
      const world = game.world();
      const result = step(game.state, command, world, content, sender);
      if (result.ok) {
        game.state = result.state;
        game.save = recordCommand(game.save, command, world.tick, sender);
        if (command.type === "turn/end") game.tick += 1;
      }
      return result;
    },
    accept(loose, sender = "player") {
      const result = game.send(loose, sender);
      if (!result.ok) throw new Error(`${loose.type} was rejected with ${result.code}: ${result.detail}`);
      return result;
    },
    endTurn: (slots = []) => game.accept({ type: "turn/end", slots }),
    expectRejected(loose, code, sender = "player") {
      const before = game.state;
      const result = game.send(loose, sender);
      if (result.ok) throw new Error(`${loose.type} was accepted; expected the rejection ${code}.`);
      if (result.code !== code) throw new Error(`${loose.type} was rejected with ${result.code}, expected ${code}: ${result.detail}`);
      if (game.state !== before) throw new Error("A rejected command changed the handle's state.");
      return result;
    },
    grant: (count) => game.accept({ type: "turns/grant", count }, "authority"),
  };
  return game;
}
