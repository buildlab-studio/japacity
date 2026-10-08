// Building a new state and applying one event to a state.
import { registry } from "../kinds";
import type { EngineEvent } from "./events";
import type { IdSource, Registry, SliceKey } from "./kind";
import { prefixOf, SLICE_KEYS } from "./kind";
import type { BaseEvent, Content, Id, State } from "./types";

/** The first instance number a new state hands out. */
export const FIRST_INSTANCE = 1;

/** The shape of the state this code builds. */
export const STATE_SCHEMA = 2;

/** A counter-backed IdSource, and a way to read where it got to. */
export function idSource(start: number): IdSource & { peek(): number } {
  let next = start;
  return {
    next(prefix) {
      const id = `${prefix}-${String(next)}`;
      next += 1;
      return id;
    },
    peek: () => next,
  };
}

/** A new state from a scenario, a seed and the content, built from every kind's `initial` (R-SCENARIO-001). */
export function newStateWith(kinds: Registry, scenarioId: Id<"scenario">, seed: string, content: Content): State {
  const scenario = content.scenario[scenarioId];
  if (scenario === undefined) throw new Error(`The content has no scenario ${scenarioId}.`);
  const ids = idSource(FIRST_INSTANCE);
  const slices: Partial<Record<SliceKey, unknown>> = {};
  for (const kind of kinds) slices[kind.kind] = kind.initial(scenario, content, ids);
  for (const key of SLICE_KEYS) {
    if (!(key in slices)) throw new Error(`No kind built the ${key} slice.`);
  }
  return {
    schema: STATE_SCHEMA,
    content: content.version,
    v: 0,
    seed,
    scenario: scenarioId,
    tick: 0,
    nextInstance: ids.peek(),
    draws: {},
    ...(slices as Pick<State, SliceKey>),
  };
}

export function newState(scenarioId: Id<"scenario">, seed: string, content: Content): State {
  return newStateWith(registry(), scenarioId, seed, content);
}

function evolveEngine(state: State, event: EngineEvent): State {
  switch (event.type) {
    case "engine/stepped":
      return { ...state, v: event.v, tick: event.tick, draws: { ...event.draws }, nextInstance: event.nextInstance };
    default: {
      const never: never = event.type;
      throw new Error(`Unknown engine event ${String(never)}.`);
    }
  }
}

function isSliceKey(prefix: string): prefix is SliceKey {
  return (SLICE_KEYS as readonly string[]).includes(prefix);
}

/**
 * Apply one event: the kind named before the slash evolves its own slice, and
 * only that slice is replaced (R-ENGINE-013). Engine events change only the
 * engine's four counters.
 */
export function applyEventWith(kinds: Registry, state: State, event: BaseEvent, content: Content): State {
  const prefix = prefixOf(event.type);
  if (prefix === "engine") return evolveEngine(state, event as EngineEvent);
  if (!isSliceKey(prefix)) throw new Error(`The event ${event.type} names no kind with a slice.`);
  const kind = kinds.find((candidate) => candidate.kind === prefix);
  if (kind === undefined) throw new Error(`The registry has no kind ${prefix} for the event ${event.type}.`);
  const slice = kind.evolve(state[prefix], event, state, content);
  return { ...state, [prefix]: slice };
}

export function applyEvent(state: State, event: BaseEvent, content: Content): State {
  return applyEventWith(registry(), state, event, content);
}

/** Every string equal to an old id, and every key that is one, renamed. The seed is never an id and is left alone. */
function renamed(value: unknown, renames: Readonly<Record<string, string>>): unknown {
  if (typeof value === "string") return renames[value] ?? value;
  if (Array.isArray(value)) return value.map((item) => renamed(item, renames));
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) out[renames[key] ?? key] = renamed(inner, renames);
    return out;
  }
  return value;
}

/**
 * A state carried from one content to the next (R-SERVER-022, decision 0006):
 * ids renamed through the newer content's table, any slice the state lacks
 * built by its kind's `initial` (decision 0003), the schema raised to the
 * current shape and the newer content's version recorded. Pure. Between two
 * loads of the same version (a new overlay, R-SERVER-024) nothing is renamed.
 */
export function upgradeStateWith(kinds: Registry, state: State, from: Content, to: Content): State {
  if (state.content !== from.version) throw new Error(`The state is for content ${state.content}, not ${from.version}.`);
  const renames = from.version === to.version ? {} : (to.renames ?? {});
  const { seed, ...rest } = state;
  const moved: State = { ...(renamed(rest, renames) as Omit<State, "seed">), seed };
  const scenario = to.scenario[moved.scenario];
  if (scenario === undefined) throw new Error(`The content ${to.version} has no scenario ${moved.scenario}.`);
  const ids = idSource(moved.nextInstance);
  const slices: Partial<Record<SliceKey, unknown>> = {};
  for (const kind of kinds) {
    if (!(kind.kind in moved)) slices[kind.kind] = kind.initial(scenario, to, ids);
  }
  return { ...moved, ...(slices as Partial<Pick<State, SliceKey>>), schema: STATE_SCHEMA, content: to.version, nextInstance: ids.peek() };
}

export function upgradeState(state: State, from: Content, to: Content): State {
  return upgradeStateWith(registry(), state, from, to);
}
