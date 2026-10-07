// Placeholders for kinds that are not built yet. A kind agent replaces each
// use with real handlers, then deletes the import.
import type { BaseEvent, EffectType, KindModule, Requirement, RequirementResult } from "./types";

type Effects = NonNullable<KindModule<unknown, BaseEvent>["effects"]>;
type Requirements = NonNullable<KindModule<unknown, BaseEvent>["requirements"]>;

/** An effect handler for each type that does nothing yet. */
export function effectsNotBuilt(types: readonly EffectType[]): Effects {
  const handlers: Effects = {};
  for (const type of types) handlers[type] = () => [];
  return handlers;
}

/** A judge for each requirement type that says "not met" until the kind is built. */
export function requirementsNotBuilt(types: readonly Requirement["type"][]): Requirements {
  const judges: Requirements = {};
  const notMet = (): RequirementResult => ({ met: false });
  for (const type of types) judges[type] = notMet;
  return judges;
}
