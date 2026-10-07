// The local authority: the first milestone's stand-in for the server
// (docs/rules/engine.md section 1). It holds the state and the save, and is
// the only part of the client that ever sees the seed. Screens talk to it only
// through the Authority type, so the server can replace it later unchanged.
import { content as realContent } from "@japacity/content";
import type { Authority, Command, Content, Id, PlayerView, Reply, Save, Sender, State, World } from "@japacity/sim";
import { newSave, newState, recordCommand, replay, standInWorld, step, time, viewFor } from "@japacity/sim";

/** The one localStorage key the life is kept under. */
export const SAVE_KEY = "japacity.save";

/** How the authority's life began. A replaced save is shown to the player. */
export type LifeStart =
  | { kind: "loaded" }
  | { kind: "new" }
  | { kind: "replaced"; why: "other-content" | "unreadable" };

export interface LocalAuthorityOptions {
  /** Grant turns freely instead of one every two real hours. Set by clockMode(). */
  fastClock: boolean;
  content?: Content;
  /** Where the save is kept. Null keeps it in memory only. Defaults to the browser's localStorage. */
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  /** The scenario a new life starts with. Defaults to the first in content. */
  scenario?: Id<"scenario">;
  /** Milliseconds since the epoch. Injected so tests can move time. */
  now?: () => number;
  /** A fresh seed for a new life. */
  makeSeed?: () => string;
}

export interface LocalAuthority extends Authority {
  readonly start: LifeStart;
  /** Throws the current life away and starts another. Local only: the server will own this. */
  newLife(scenario: Id<"scenario">): Promise<PlayerView>;
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

function browserStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Some browsers throw on access when storage is blocked.
    return null;
  }
}

function isStored(value: unknown): value is Stored {
  if (typeof value !== "object" || value === null) return false;
  const { save, clock } = value as Partial<Stored>;
  return (
    typeof save === "object" &&
    save !== null &&
    (save.schema === 1 || save.schema === 2) &&
    typeof save.content === "string" &&
    typeof save.scenario === "string" &&
    typeof save.seed === "string" &&
    typeof save.worldSeed === "string" &&
    Array.isArray(save.commands) &&
    typeof clock === "object" &&
    clock !== null &&
    typeof clock.anchor === "number"
  );
}

/** The tick the next command is sent at. Each accepted `turn/end` moves the world one tick (engine.md section 7). */
function tickAfter(save: Save): number {
  return save.commands.filter(({ command }) => command.type === "turn/end").length;
}

export function localAuthority(options: LocalAuthorityOptions): LocalAuthority {
  const content = options.content ?? realContent;
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const now = options.now ?? (() => Date.now());
  const makeSeed = options.makeSeed ?? randomSeed;
  const firstScenario = options.scenario ?? (Object.keys(content.scenario)[0] as Id<"scenario">);

  let state: State;
  let save: Save;
  let tick: number;
  let anchor: number;

  const worldAt = (at: number): World => standInWorld(save.worldSeed, at, content);

  function persist(): void {
    if (storage === null) return;
    const stored: Stored = { save, clock: { anchor } };
    try {
      storage.setItem(SAVE_KEY, JSON.stringify(stored));
    } catch {
      // A full or blocked storage loses the save on reload, but play goes on.
    }
  }

  function begin(scenario: Id<"scenario">): void {
    const seed = makeSeed();
    state = newState(scenario, seed, content);
    save = newSave(scenario, seed, makeSeed(), content);
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
    if (parsed.save.content !== content.version) {
      begin(firstScenario);
      return { kind: "replaced", why: "other-content" };
    }
    try {
      save = parsed.save;
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
  persist();

  return {
    start,
    view() {
      earnTurns();
      persist();
      return Promise.resolve(currentView());
    },
    send(command): Promise<Reply> {
      // A player may not grant turns: the engine rejects it as not-yours (R-TURN-005).
      const result = apply(command, "player");
      if (!result.ok) return Promise.resolve(result);
      earnTurns();
      persist();
      return Promise.resolve({ ok: true, view: currentView(), lines: result.lines });
    },
    newLife(scenario) {
      begin(scenario);
      persist();
      return Promise.resolve(currentView());
    },
  };
}
