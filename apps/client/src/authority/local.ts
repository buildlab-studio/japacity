// The local authority: the first milestone's stand-in for the server
// (docs/rules/engine.md section 1). It holds the state and the save, and is
// the only part of the client that ever sees the seed. Screens talk to it only
// through the Authority type, so the server can replace it later unchanged.
import { content as realContent } from "@japacity/content";
import type { Authority, Command, Content, FlatSave, Id, PlayerView, Reply, Save, Sender, State, World } from "@japacity/sim";

import { archetypeOf, fullPrologue } from "../shared/frontdoor/archetypes";
import { tileSeed } from "../shared/frontdoor/draw";
import type { ClockView } from "../shared/net/contract";
import { lastSegment, lifeStart, loadSave, newSave, newState, recordCommand, replay, savedCommands, standInWorld, step, time, viewFor } from "@japacity/sim";
import { PERSON_KEY, readPerson } from "./person";

/** The one localStorage key the life is kept under. */
export const SAVE_KEY = "japacity.save";

/** How the authority's life began. A replaced save is shown to the player. */
export type LifeStart =
  | { kind: "loaded" }
  | { kind: "new" }
  | { kind: "replaced"; why: "other-content" | "unreadable" };

/** What the authority keeps the save in; `removeItem` lets a life end (R-ACCOUNT-030). */
export type LocalStorage = Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem">>;

export interface LocalAuthorityOptions {
  /** Grant turns freely instead of one every two real hours. Set by clockMode(). */
  fastClock: boolean;
  content?: Content;
  /** Where the save is kept. Null keeps it in memory only. Defaults to the browser's localStorage. */
  storage?: LocalStorage | null;
  /** The scenario a new life starts with. Defaults to the first in content. */
  scenario?: Id<"scenario">;
  /** Milliseconds since the epoch. Injected so tests can move time. */
  now?: () => number;
  /** A fresh seed for a new life. */
  makeSeed?: () => string;
}

export interface LocalAuthority extends Authority {
  readonly start: LifeStart;
  /** When the next month comes, from the refill's anchor (R-WORLD-027); null while the bank is full. */
  clock(): ClockView;
  /** The stand-in world's numbers at this tick: the season the meetings read (R-WORLD-020). */
  vars(): Readonly<Record<string, number>>;
  /**
   * Throws the current life away and starts another, on the named seed when one is given. Without one, a life from
   * sixteen through a tile kept beside the save starts on the front door's seed for that tile (R-PROLOGUE-011).
   * Local only: the server will own this.
   */
  newLife(scenario: Id<"scenario">, seed?: string): Promise<PlayerView>;
  /**
   * R-ACCOUNT-030: ends this life for good. The save and the person kept beside it are cleared, and nothing is
   * written again until a new life is chosen, so a reload opens the front door.
   */
  endLife(): Promise<boolean>;
}

/** What is kept under SAVE_KEY: the save, and when real time last earned a turn. */
interface Stored {
  save: Save;
  clock: { anchor: number };
}

function randomSeed(): string {
  const words = new Uint32Array(2);
  crypto.getRandomValues(words);
  return Array.from(words, (word) => word.toString(16).padStart(8, "0")).join("");
}

function browserStorage(): LocalStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Some browsers throw on access when storage is blocked.
    return null;
  }
}

/** A save in segments, or a flat one written before saves had segments (decision 0006). */
function isSave(value: unknown): value is Save | FlatSave {
  if (typeof value !== "object" || value === null) return false;
  const save = value as Record<string, unknown>;
  if (save.schema === 3) return Array.isArray(save.segments) && save.segments.length > 0;
  return (
    (save.schema === 1 || save.schema === 2) &&
    typeof save.content === "string" &&
    typeof save.scenario === "string" &&
    typeof save.seed === "string" &&
    typeof save.worldSeed === "string" &&
    Array.isArray(save.commands)
  );
}

function isStored(value: unknown): value is { save: Save | FlatSave; clock: Stored["clock"] } {
  if (typeof value !== "object" || value === null) return false;
  const { save, clock } = value as { save?: unknown; clock?: Partial<Stored["clock"]> | null };
  return isSave(save) && typeof clock === "object" && clock !== null && typeof clock.anchor === "number";
}

/** The tick the next command is sent at. Each accepted `turn/end` moves the world one tick (engine.md section 7). */
function tickAfter(save: Save): number {
  return savedCommands(save).filter(({ command }) => command.type === "turn/end").length;
}

export function localAuthority(options: LocalAuthorityOptions): LocalAuthority {
  const content = options.content ?? realContent;
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const now = options.now ?? (() => Date.now());
  const makeSeed = options.makeSeed ?? randomSeed;
  const firstScenario = options.scenario ?? (Object.keys(content.scenario)[0] as Id<"scenario">);

  let state: State;
  let save: Save;
  let worldSeed: string;
  let tick: number;
  let anchor: number;

  const worldAt = (at: number): World => standInWorld(worldSeed, at, content);

  /**
   * R-PROLOGUE-011: a life from sixteen through a tile kept beside the save starts on the first of a few seeds named
   * from the drawn one whose draw keeps the tile's path open, since here a life may be started over. A ready life,
   * a life with no tile, and the full prologue keep the drawn seed.
   */
  function seedFor(scenario: Id<"scenario">, drawn: string): string {
    if (content.scenario[scenario]?.prologue !== true || fullPrologue(storage)) return drawn;
    const archetype = archetypeOf(readPerson(storage)?.archetype);
    return archetype === null ? drawn : tileSeed(archetype, drawn, worldAt(0), content);
  }

  // A life not yet chosen is never written: the front door comes back after a reload instead of the first scenario's life.
  let chosen = false;

  /** False when the save was not written: a full or blocked storage loses it on reload, but play goes on. */
  function persist(): boolean {
    if (storage === null || !chosen) return false;
    const stored: Stored = { save, clock: { anchor } };
    try {
      storage.setItem(SAVE_KEY, JSON.stringify(stored));
      return true;
    } catch {
      return false;
    }
  }

  /** Starts a life on the named seed, or on a fresh one (the front door's for a tile). */
  function begin(scenario: Id<"scenario">, named?: string): void {
    const drawn = named ?? makeSeed();
    worldSeed = makeSeed();
    const seed = named ?? seedFor(scenario, drawn);
    state = newState(scenario, seed, content);
    save = newSave(scenario, seed, worldSeed, content);
    tick = 0;
    anchor = now();
  }

  function load(): LifeStart {
    const raw = storage?.getItem(SAVE_KEY) ?? null;
    if (raw === null) {
      begin(firstScenario);
      return { kind: "new" };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    if (!isStored(parsed)) {
      begin(firstScenario);
      return { kind: "replaced", why: "unreadable" };
    }
    const loaded = loadSave(parsed.save);
    if (lastSegment(loaded).content !== content.version) {
      begin(firstScenario);
      return { kind: "replaced", why: "other-content" };
    }
    const begun = lifeStart(loaded);
    if (begun === null) {
      begin(firstScenario);
      return { kind: "replaced", why: "unreadable" };
    }
    try {
      save = loaded;
      worldSeed = begun.worldSeed;
      state = replay(save, content, worldAt).state;
      tick = tickAfter(save);
      anchor = parsed.clock.anchor;
      return { kind: "loaded" };
    } catch {
      // A save the engine can no longer replay is as good as unreadable.
      begin(firstScenario);
      return { kind: "replaced", why: "unreadable" };
    }
  }

  /** Steps the state and records the command when it is accepted. */
  function apply(command: Command, sender: Sender) {
    const world = worldAt(tick);
    const result = step(state, command, world, content, sender);
    if (result.ok) {
      state = result.state;
      save = recordCommand(save, command, world.tick, sender);
      if (command.type === "turn/end") tick += 1;
    }
    return result;
  }

  function grant(count: number): void {
    if (count < 1) return;
    apply({ type: "turns/grant", count, basedOn: state.v }, "authority");
  }

  /**
   * Grants the turns real time has earned: one every TURN_REFILL_MS while the
   * bank is below the cap. A full bank earns nothing, so time spent full is
   * not banked for later. The fast clock refills an empty bank at once.
   */
  function earnTurns(): void {
    if (state.turn.ended) return;
    const cap = content.tuning.turn.cap;
    const banked = state.turn.banked;
    const at = now();
    if (options.fastClock) {
      if (banked < 1) grant(cap - banked);
      anchor = at;
      return;
    }
    if (banked >= cap) {
      anchor = at;
      return;
    }
    const earned = Math.floor((at - anchor) / time.TURN_REFILL_MS);
    if (earned < 1) return;
    const room = cap - banked;
    grant(Math.min(earned, room));
    anchor = earned >= room ? at : anchor + earned * time.TURN_REFILL_MS;
  }

  const currentView = (): PlayerView => viewFor({ state, world: worldAt(tick), content });

  const start = load();
  chosen = start.kind !== "new";
  persist();

  return {
    start,
    view() {
      earnTurns();
      persist();
      return Promise.resolve(currentView());
    },
    clock() {
      earnTurns();
      const cap = content.tuning.turn.cap;
      const next = options.fastClock ? now() : anchor + time.TURN_REFILL_MS;
      return { tick, nextTickAt: next, nextTurnAt: state.turn.banked >= cap ? null : next };
    },
    send(command): Promise<Reply> {
      // A player may not grant turns: the engine rejects it as not-yours (R-TURN-005).
      const result = apply(command, "player");
      if (!result.ok) return Promise.resolve(result);
      earnTurns();
      persist();
      return Promise.resolve({ ok: true, view: currentView(), lines: result.lines });
    },
    vars() {
      return worldAt(tick).vars;
    },
    newLife(scenario, seed) {
      begin(scenario, seed);
      chosen = true;
      persist();
      return Promise.resolve(currentView());
    },
    endLife() {
      try {
        storage?.removeItem?.(SAVE_KEY);
        storage?.removeItem?.(PERSON_KEY);
      } catch (error) {
        // A blocked storage kept nothing to clear; said in the console for whoever reads it, never to the player.
        console.warn(`Japacity: the old save was not cleared (${error instanceof Error ? error.name : "blocked"}).`);
      }
      // As at a load with no save: a life is held so the authority answers, but none is written before one is chosen.
      chosen = false;
      begin(firstScenario);
      return Promise.resolve(true);
    },
  };
}
