// What must hold in every state: every kind's own invariants, plus the
// engine's four counters.
import { registry } from "../kinds";
import type { Registry } from "./kind";
import type { Content, State } from "./types";

export function checkInvariantsWith(kinds: Registry, state: State, content: Content): string[] {
  const problems: string[] = [];
  if (state.schema !== 1 && state.schema !== 4) problems.push(`The state's schema is ${String(state.schema)}.`);
  if (state.content !== content.version) problems.push(`The state is for content ${state.content}, not ${content.version}.`);
  if (!Number.isSafeInteger(state.v) || state.v < 0) problems.push(`The version is ${String(state.v)}.`);
  if (!Number.isSafeInteger(state.tick) || state.tick < 0) problems.push(`The tick is ${String(state.tick)}.`);
  if (!Number.isSafeInteger(state.nextInstance) || state.nextInstance < 1) problems.push(`nextInstance is ${String(state.nextInstance)}.`);
  for (const [stream, count] of Object.entries(state.draws)) {
    if (!Number.isSafeInteger(count) || count < 0) problems.push(`The ${stream} stream has made ${String(count)} draws.`);
  }
  for (const kind of kinds) problems.push(...(kind.invariants?.(state, content) ?? []));
  return problems;
}

/** Sentences describing what is broken. Empty when all is well (R-SCENARIO-001). */
export function checkInvariants(state: State, content: Content): string[] {
  return checkInvariantsWith(registry(), state, content);
}
