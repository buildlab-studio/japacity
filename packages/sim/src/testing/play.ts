// A small game handle for rule tests: start a life, send commands, end turns,
// read the view. The tick advances by one for each turn played, as the
// in-browser authority's clock does (engine.md section 7).
import type { Registry } from "../engine/kind";
import { newSave, recordCommand } from "../engine/replay";
import { newState } from "../engine/state";
import { stepWith } from "../engine/step";
import type {
  BaseEvent,
  Command,
  Content,
  Id,
  PlayerView,
  Rejection,
  RejectionCode,
  ReportLine,
  Save,
  Sender,
  SlotPick,
  State,
  StepResult,
  World,
} from "../engine/types";
import { viewFor } from "../engine/view";
import { registry } from "../kinds";
import { standInWorld, standInWorlds } from "../world/standIn";
import { legalCommands } from "./legal";
import { miniContent } from "./miniContent";

export interface StartOptions {
  scenario?: Id<"scenario">;
  seed?: string;
  worldSeed?: string;
  content?: Content;
  /** A world builder other than the stand-in, for tests that fix the world. */
  worldAt?: (tick: number) => World;
  /** The registry to step with, for tests that watch a real kind at work. The real one by default. */
  kinds?: Registry;
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

/** The stand-in world is a pure walk from tick 0, so tests keep each seed's walk and extend it as ticks are asked for. */
const WORLDS = new Map<string, World[]>();

function cachedStandIn(worldSeed: string, content: Content): (tick: number) => World {
  const key = `${worldSeed}\u0000${content.version}\u0000${content.overlay ?? ""}\u0000${String(Object.keys(content.news).length)}`;
  return (tick: number): World => {
    const held = WORLDS.get(key);
    if (held !== undefined && held.length > tick) return held[tick]!;
    const walk = standInWorlds(worldSeed, Math.max(tick, (held?.length ?? 0) * 2, 60), content);
    WORLDS.set(key, walk);
    return walk[tick] ?? standInWorld(worldSeed, tick, content);
  };
}

export function start(options: StartOptions = {}): Game {
  const content = options.content ?? miniContent;
  const scenario = options.scenario ?? (Object.keys(content.scenario)[0] as Id<"scenario">);
  const seed = options.seed ?? "seed-1";
  const worldSeed = options.worldSeed ?? "world-1";
  const worldAt = options.worldAt ?? cachedStandIn(worldSeed, content);
  const kinds = options.kinds ?? registry();

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
      const result = stepWith(kinds, game.state, command, world, content, sender);
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
    endTurn(slots = []) {
      // activity:now-acts-and-month-acts: a now-act fills no slot; it is sent at once as `activity/now`. A month written with one in its
      // slots plays it first, at the same tick, as the recorded lives do, and the month's events and lines carry its own
      // in front. One that cannot be paid, or done again this month, does not happen, as such a slot failed before.
      const early: { events: BaseEvent[]; lines: ReportLine[] } = { events: [], lines: [] };
      const month: SlotPick[] = [];
      for (const pick of slots) {
        // An act that repeats may stand as a commitment in a slot (activity:acts-may-repeat-in-month), so it stays a slot pick.
        if (content.activity[pick.activity]?.when !== "now" || content.activity[pick.activity]?.repeat === true) {
          month.push(pick);
          continue;
        }
        const entry = content.activity[pick.activity];
        if (entry?.purchase !== true && (game.state.activity.now ?? []).some((done) => done.activity === pick.activity)) continue;
        const result = game.send({ type: "activity/now", activity: pick.activity, param: pick.param });
        if (!result.ok && result.code !== "cannot-afford") throw new Error(`activity/now ${pick.activity} was rejected with ${result.code}: ${result.detail}`);
        if (result.ok) {
          early.events.push(...result.events);
          early.lines.push(...result.lines);
        }
      }
      // An act now that opens a set piece (the visa interview) holds the month until it is answered, as the month after
      // such a slot was held; the month is then left to the test's next end.
      if (early.events.length > 0 && game.state.setpiece.open !== null) return { ok: true, state: game.state, events: early.events, lines: early.lines };
      const result = game.send({ type: "turn/end", slots: month });
      // The pair's interview holds the month the same way (interview:answers-taken-in-order).
      if (!result.ok && early.events.length > 0 && result.code === "setpiece-open") return { ok: true, state: game.state, events: early.events, lines: early.lines };
      if (!result.ok) throw new Error(`turn/end was rejected with ${result.code}: ${result.detail}`);
      return { ...result, events: [...early.events, ...result.events], lines: [...early.lines, ...result.lines] };
    },
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

/**
 * Plays a life's prologue to its close by the first legal answer each step, so
 * tests over every life can treat the prologue life like the fixed ones
 * (prologue:closing-opens-home-charges). A life whose prologue is closed is left as it is.
 */
export function finishPrologue(game: Game): void {
  for (let guard = 0; guard < 60 && game.state.prologue.open; guard += 1) {
    const [first] = legalCommands(game.view());
    if (first === undefined) throw new Error("The prologue is open with no legal answer.");
    game.accept(first);
  }
  if (game.state.prologue.open) throw new Error("The prologue did not close in 60 answers.");
}

/** Answers the prologue's open steps in turn, one answer each. */
export function answerPrologue(game: Game, answers: readonly string[]): void {
  for (const answer of answers) {
    const step = game.state.prologue.step;
    if (step === null) throw new Error(`The prologue closed before ${answer}.`);
    game.accept({ type: "prologue/choose", step, answer });
  }
}

/** Plays the prologue to its close, taking at each card the first of `preferred` open there, else its first open answer. */
export function playPrologueBy(game: Game, preferred: readonly string[]): void {
  for (let guard = 0; guard < 60 && game.state.prologue.open; guard += 1) {
    const card = game.view().prologue;
    if (card === null) throw new Error("The prologue is open with no card.");
    const allowed = card.answers.filter((answer) => answer.allowed).map((answer) => answer.id);
    const answer = preferred.find((id) => allowed.includes(id)) ?? allowed[0];
    if (answer === undefined) throw new Error(`${card.step} has no open answer.`);
    game.accept({ type: "prologue/choose", step: card.step, answer });
  }
}
