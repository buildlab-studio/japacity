// What the random play files check after every command, as lists of
// problems so a test asserts each list is empty, and the ways a random life
// starts: from a starting life, or from a recorded life at its flight.
import { hashState } from "../engine/hash";
import { checkInvariants } from "../engine/invariants";
import { lifeStart, replay, savedCommands } from "../engine/replay";
import type { Content, Currency, Id, PlayerView, Save, State } from "../engine/types";
import { hiddenPaths, VIEW_KEYS } from "../engine/view";
import { lifeSaves } from "../goldens/lives.data";
import type { Game, Loose } from "../testing/play";
import { start } from "../testing/play";
import { standInWorld, standInWorlds } from "../world/standIn";
import type { StrategyName } from "./players";
import { strategies } from "./players";
import { sampleCommands } from "./sampler";

export const COMMANDS = 300;
export const SEEDS_PER_LIFE = 40;

/** R-WALLET-002: per currency, what the pockets hold less what the ledger says came in and went out. Zero when the books balance. */
export function ledgerGaps(state: State): Partial<Record<Currency, number>> {
  const gaps: Partial<Record<Currency, number>> = {};
  for (const [currency, pocket] of Object.entries(state.wallet.pockets) as [Currency, State["wallet"]["pockets"][Currency]][]) {
    let net = 0;
    for (const byCurrency of Object.values(state.wallet.totals.in)) net += byCurrency?.[currency] ?? 0;
    for (const byCurrency of Object.values(state.wallet.totals.out)) net -= byCurrency?.[currency] ?? 0;
    const gap = pocket.bank + pocket.cash + pocket.locked - net;
    if (gap !== 0) gaps[currency] = gap;
  }
  return gaps;
}

/** R-QUALITY-001: every quality held sits inside its entry's range. */
export function qualitiesOutOfRange(state: State, content: Content): string[] {
  const out: string[] = [];
  for (const [id, value] of Object.entries(state.quality)) {
    const entry = content.quality[id as Id<"quality">];
    if (entry === undefined) out.push(`${id} has no entry`);
    else if (value < entry.min || value > entry.max) out.push(`${id} is ${String(value)}, outside ${String(entry.min)} to ${String(entry.max)}`);
  }
  return out;
}

/** Every always-true rule the random play checks after one accepted command, as one list of what failed. */
export function problems(game: Game, view: PlayerView): string[] {
  const found = [...checkInvariants(game.state, game.content)];
  for (const key of VIEW_KEYS) if (!(key in view)) found.push(`the view has no ${key}`);
  for (const path of hiddenPaths(view)) found.push(`the view shows ${path}`);
  for (const [currency, gap] of Object.entries(ledgerGaps(game.state))) found.push(`the ${currency} books are out by ${String(gap)}`);
  found.push(...qualitiesOutOfRange(game.state, game.content));
  found.push(...notPlain(game.state, "state"));
  return found;
}

/** R-ENGINE-010: what in a value would not come back the same from JSON: undefined, a number that is not finite, or anything but plain objects and arrays. */
export function notPlain(value: unknown, path: string): string[] {
  if (value === null || typeof value === "string" || typeof value === "boolean") return [];
  if (typeof value === "number") return Number.isFinite(value) ? [] : [`${path} is ${String(value)}`];
  if (typeof value !== "object") return [`${path} is ${typeof value}`];
  if (Array.isArray(value)) return value.flatMap((item, index) => notPlain(item, `${path}[${String(index)}]`));
  if (Object.getPrototypeOf(value) !== Object.prototype) return [`${path} is not a plain object`];
  return Object.entries(value).flatMap(([key, item]) => notPlain(item, `${path}.${key}`));
}

/** R-ENGINE-011, read from the view: a legal command while a turn is banked, and an answer while a set piece is open. */
export function stuck(view: PlayerView, legal: Loose[]): string | null {
  if (view.ended) return null;
  if (view.prologue !== null) return legal.length > 0 ? null : "the prologue is open with no legal answer";
  if (view.turns.banked > 0 && view.setpiece === null && !legal.some((command) => command.type === "turn/end")) return "a turn is banked and no turn can be ended";
  if (view.setpiece !== null && !legal.some((command) => command.type === "setpiece/answer")) return "a set piece is open with no answer";
  return null;
}

/** R-ENGINE-010: the save replays to the same state. */
export function replays(game: Game): boolean {
  // The stand-in world is a walk from tick 0, so it is built once for the whole replay.
  const worldSeed = lifeStart(game.save)?.worldSeed ?? "";
  const worlds = standInWorlds(worldSeed, game.tick + 1, game.content);
  const rebuilt = replay(game.save, game.content, (tick) => worlds[tick] ?? standInWorld(worldSeed, tick, game.content));
  return hashState(rebuilt.state) === hashState(game.state);
}

/** A recorded life replayed command by command up to and including its flight, so random play starts abroad. */
export function atFlight(name: string, content: Content): Game {
  const save = lifeSaves[name];
  if (save === undefined) throw new Error(`${name} is not recorded.`);
  const first = lifeStart(save);
  if (first === null) throw new Error(`${name} does not start a life.`);
  const game = start({ scenario: first.scenario, seed: first.seed, worldSeed: first.worldSeed, content });
  let held = FLOWN.get(name);
  if (held === undefined) {
    const commands = savedCommands(save);
    const flight = commands.findIndex((entry) => entry.command.type === "route/depart");
    for (const { command, sender } of commands.slice(0, flight + 1)) game.accept(command, sender);
    if (game.state.place.where !== "abroad") throw new Error(`${name} is not abroad after its flight.`);
    held = { state: game.state, save: game.save, tick: game.tick };
    FLOWN.set(name, held);
  }
  // States are never changed in place, so every handle may start from the one replay.
  game.state = held.state;
  game.save = held.save;
  game.tick = held.tick;
  return game;
}

const FLOWN = new Map<string, { state: State; save: Save; tick: number }>();

/**
 * Known breaks of the always-true rules in the kinds, each with the seed it
 * was found on. A random life that meets one stops there and is counted; any other break fails the test.
 */
export const KNOWN_FINDINGS: { pattern: string; finding: string }[] = [];

/** The result of a random life with the known findings let through: null when it held or stopped on one of them. */
export function unexplained(result: string | null): string | null {
  if (result === null) return null;
  return KNOWN_FINDINGS.some((known) => result.includes(known.pattern)) ? null : result;
}

/** What one random life went through, for the coverage the files report. */
export interface Walk {
  places: Set<string>;
  types: Set<Loose["type"]>;
}

/**
 * Plays the picks: each one chooses from the sampler's list, or, when a
 * strategy is named, one pick in four does and the strategy chooses the rest.
 * Returns the first broken rule, or null; `walk` records where the life went.
 */
export function play(game: Game, picks: number[], walk: Walk, strategy: StrategyName | null = null): string | null {
  let view = game.view();
  for (const pick of picks) {
    walk.places.add(view.place.where);
    if (view.ended) break;
    const legal = sampleCommands(view);
    const blocked = stuck(view, legal);
    if (blocked !== null) return `month ${String(view.month)}: ${blocked}`;
    if (view.prologue === null && view.turns.banked === 0 && view.setpiece === null) {
      game.grant(1);
      view = game.view();
      continue;
    }
    const wanted = strategy === null || (pick % 4 === 0 && legal.length > 0) ? [legal[pick % legal.length]!] : strategies[strategy](view, game.content);
    let sent: Loose | null = null;
    const refused: string[] = [];
    for (const command of wanted) {
      let result: ReturnType<Game["send"]>;
      try {
        result = game.send(command);
      } catch (error) {
        return `month ${String(view.month)}: ${command.type} threw: ${error instanceof Error ? error.message : String(error)}`;
      }
      if (result.ok) {
        sent = command;
        break;
      }
      if (strategy === null) return `month ${String(view.month)}: ${command.type} from the sampler was rejected with ${result.code}: ${result.detail}`;
      refused.push(`${JSON.stringify(command)} ${result.code}: ${result.detail}`);
    }
    if (sent === null) return `month ${String(view.month)}: nothing the ${String(strategy)} player wanted was accepted: ${refused.join("; ")}`;
    walk.types.add(sent.type);
    const month = view.month;
    view = game.view();
    const broken = problems(game, view);
    if (broken.length > 0) return `month ${String(month)} after ${sent.type}: ${broken.join("; ")}`;
  }
  walk.places.add(view.place.where);
  return replays(game) ? null : "the save does not replay to the same state";
}
