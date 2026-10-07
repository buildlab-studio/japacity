// Amounts and requirements: the plain-data language content is written in.
// The engine judges the requirement types that are about no kind in
// particular. Every other type goes to the kind that owns it.
import { kindByKey } from "../kinds";
import { bp } from "./int";
import type { PrefixOf, Registry, SliceKey } from "./kind";
import { prefixOf } from "./kind";
import type { Amount, ReadCtx, Requirement, RequirementResult, Terms } from "./types";

type RequirementType = Requirement["type"];

/** Requirement types the engine judges itself. */
const ENGINE_REQUIREMENTS = ["not", "any", "month/min", "var/min", "var/max"] as const satisfies readonly RequirementType[];

type KindRequirementPrefix = Exclude<PrefixOf<RequirementType>, "month" | "var">;

/** Which kind judges each requirement type, by the part before the slash. */
export const REQUIREMENT_OWNER: Record<KindRequirementPrefix, SliceKey> = {
  quality: "quality",
  job: "activity",
  activity: "activity",
  document: "document",
  route: "route",
  money: "wallet",
  chapter: "chapter",
};

function isEngineRequirement(type: RequirementType): type is (typeof ENGINE_REQUIREMENTS)[number] {
  return (ENGINE_REQUIREMENTS as readonly string[]).includes(type);
}

/** A world variable. A missing one is a content or world bug, so it throws. */
export function worldVar(read: ReadCtx, id: string): number {
  const value = (read.world.vars as Record<string, number | undefined>)[id];
  if (value === undefined) throw new Error(`The world has no variable ${id}.`);
  return value;
}

/** Turn an amount into a number: a fixed number, a world variable, or a term scaled by basis points. */
export function resolveAmount(read: ReadCtx, amount: Amount, terms: Terms = {}): number {
  if (typeof amount === "number") {
    if (!Number.isSafeInteger(amount)) throw new Error(`An amount must be a whole number, got ${String(amount)}.`);
    return amount;
  }
  if ("var" in amount) return worldVar(read, amount.var);
  const value = terms[amount.term];
  if (value === undefined) throw new Error(`The amount reads the term ${amount.term}, which is not in hand.`);
  if (typeof value !== "number") throw new Error(`The term ${amount.term} is not a number.`);
  return amount.bp === undefined ? value : bp(value, amount.bp);
}

function judgeHere(read: ReadCtx, requirement: Requirement, terms: Terms, kinds: Registry | undefined): RequirementResult {
  switch (requirement.type) {
    case "not":
      return { met: !checkWith(read, requirement.of, terms, kinds).met };
    case "any":
      return { met: requirement.of.some((inner) => checkWith(read, inner, terms, kinds).met) };
    case "month/min": {
      const have = read.state.turn.month;
      return { met: have >= requirement.value, have, need: requirement.value };
    }
    case "var/min": {
      const have = worldVar(read, requirement.var);
      return { met: have >= requirement.value, have, need: requirement.value };
    }
    case "var/max": {
      const have = worldVar(read, requirement.var);
      return { met: have <= requirement.value, have, need: requirement.value };
    }
    default:
      throw new Error(`The engine does not judge ${requirement.type}.`);
  }
}

/** Judge a requirement with a given registry. Tests use this to swap kinds in. */
export function checkWith(
  read: ReadCtx,
  requirement: Requirement,
  terms: Terms = {},
  kinds?: Registry,
): RequirementResult {
  if (isEngineRequirement(requirement.type)) return judgeHere(read, requirement, terms, kinds);
  const owner = REQUIREMENT_OWNER[prefixOf(requirement.type) as KindRequirementPrefix];
  const judge = kindByKey(owner, kinds).requirements?.[requirement.type];
  if (judge === undefined) throw new Error(`No kind judges the requirement ${requirement.type}.`);
  return judge(read, requirement, terms);
}

/** Judge a requirement outside a step, against a state and a world. The view uses this. */
export function check(read: ReadCtx, requirement: Requirement, terms: Terms = {}): RequirementResult {
  return checkWith(read, requirement, terms);
}

/** True when every requirement holds. */
export function allMet(read: ReadCtx, requirements: readonly Requirement[], terms: Terms = {}): boolean {
  return requirements.every((requirement) => check(read, requirement, terms).met);
}

/** The requirements that do not hold, in order. */
export function unmet(read: ReadCtx, requirements: readonly Requirement[], terms: Terms = {}): Requirement[] {
  return requirements.filter((requirement) => !check(read, requirement, terms).met);
}
