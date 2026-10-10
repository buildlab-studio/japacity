// The archetypes (prologue.md R-PROLOGUE-010, "The archetypes"): each a preset of the prologue's answers,
// held here by the client and never by the simulation. For a step the archetype names, the client sends
// the first of its answers that is allowed; a step it leaves open, or whose answers are all shut after a
// draw, shows its card. The words for each live in content under `prologue.archetype.<id>.*`.
import type { Id, PlayerView } from "@japacity/sim";

import { sixteenPath } from "../words/sixteen";
import { say } from "../words/text";

type Prologue = NonNullable<PlayerView["prologue"]>;

export type ArchetypeId = "developer" | "nurse" | "accountant" | "writer" | "trader" | "shop-worker";

export interface Archetype {
  id: ArchetypeId;
  /** The answers to send at each step, in order of preference: the first allowed is sent. */
  preset: Readonly<Record<string, readonly string[]>>;
  /** An open card's answer that suits this person, offered first on the card. */
  leaning: Readonly<Record<string, string>>;
  /** The routes the tile names: at least one is of the character's own effort. */
  routes: readonly Id<"route">[];
}

/**
 * Steps no archetype decides, with one way through: the opening draw, the university (federal is open to
 * everyone), the strike's drag, the results and the settlement. Each is a beat, never a card of its own.
 */
const THROUGH: Readonly<Record<string, readonly string[]>> = {
  draw: ["begin"],
  university: ["federal"],
  "strike-drag": ["back"],
  graduation: ["results-nurse", "results"],
  settlement: ["settle"],
  // The age card: the years as they went, unless the front door set a step (withAge, R-PROLOGUE-009).
  age: ["as-is"],
};

/** The steps an archetype chooses for itself: its preset without the steps every life passes the same way. */
export function ownSteps(archetype: Archetype): string[] {
  return Object.keys(archetype.preset).filter((step) => !(step in THROUGH));
}

const degree = (subjects: string, course: string, side: string, hustle: string): Record<string, readonly string[]> => ({
  ...THROUGH,
  subjects: [subjects],
  "after-school": ["jamb"],
  course: [course],
  "side-skill": [side],
  hustle: [hustle],
  service: ["serve"],
});

/*
 * the table names no subjects for the trader and the shop worker, and leaves the subjects card
 * out of their open cards. Commercial suits them, and it closes no door: the master is open after it to
 * exactly the children it is open to after science (a town child of parents without schooling, or a
 * family under 40).
 */
export const ARCHETYPES: readonly Archetype[] = [
  {
    id: "developer",
    // Focus in the final year keeps the grade at the master's and the bank's bar; code stays the side skill.
    preset: degree("science", "computer-science", "code", "focus"),
    leaning: { friend: "tech" },
    routes: ["route.uk-talent", "route.uk-skilled", "route.uk-masters"],
  },
  {
    id: "nurse",
    preset: degree("science", "nursing", "books", "focus"),
    leaning: { friend: "uk" },
    routes: ["route.uk-care", "route.gulf-contract", "route.canada-points"],
  },
  {
    id: "accountant",
    preset: degree("commercial", "accounting", "trade", "campus-shop"),
    leaning: { friend: "canada" },
    routes: ["route.canada-points", "route.uk-skilled", "route.uk-masters"],
  },
  {
    id: "writer",
    preset: degree("arts", "mass-comm", "content", "focus"),
    leaning: { friend: "uk" },
    routes: ["route.uk-masters", "route.canada-points"],
  },
  {
    id: "trader",
    preset: { ...THROUGH, subjects: ["commercial"], "after-school": ["apprentice"], master: ["spare-parts"], years: ["stay"] },
    leaning: { friend: "nowhere" },
    routes: ["route.gulf-contract", "route.road"],
  },
  {
    id: "shop-worker",
    preset: { ...THROUGH, subjects: ["commercial"], "after-school": ["work"], shop: ["save"] },
    leaning: {},
    routes: ["route.gulf-contract", "route.road"],
  },
];

export function archetypeOf(id: string | null | undefined): Archetype | null {
  return ARCHETYPES.find((archetype) => archetype.id === id) ?? null;
}

/**
 * The tile with the age the front door set (R-PROLOGUE-009): the step's answer at the age card, then each step
 * nearer the tile's own age, so a card the draws pushed past a limit still takes the nearest step it can.
 */
export function withAge(archetype: Archetype, years: number): Archetype {
  const way = years < 0 ? "younger" : "older";
  const steps = Array.from({ length: Math.abs(years) }, (_, at) => `${way}-${String(Math.abs(years) - at)}`);
  return { ...archetype, preset: { ...archetype.preset, age: [...steps, "as-is"] } };
}

/** The answer the archetype sends at this card, or null when the card shows (R-PROLOGUE-010). */
export function presetAnswer(archetype: Archetype, prologue: Pick<Prologue, "step" | "answers">): string | null {
  const wanted = archetype.preset[prologue.step] ?? [];
  return wanted.find((id) => prologue.answers.some((answer) => answer.id === id && answer.allowed)) ?? null;
}

/** The card's answers with the one that suits the archetype first; the others keep their order. */
export function answersInOrder<A extends { id: string }>(archetype: Archetype | null, step: string, answers: readonly A[]): A[] {
  const first = archetype === null ? undefined : (archetype.leaning[step] ?? archetype.preset[step]?.[0]);
  return [...answers].sort((a, b) => Number(b.id === first) - Number(a.id === first));
}

/** True when the tile's years go through university: its preset sits the entrance exam after school. */
function throughUniversity(archetype: Archetype): boolean {
  return (archetype.preset["after-school"] ?? []).includes("jamb");
}

/**
 * The handover's line of who the person is (R-PROLOGUE-010, 011): the tile's kind and what it was when the life
 * went the tile's way, else the life as lived (`sixteenPath`), never the tile. Online the family's draw is made
 * once, and a trader's tile can hand over a graduate.
 */
export function handoverKind(archetype: Archetype, life: Pick<PlayerView, "scenario" | "qualities" | "pockets">): string {
  const lived = sixteenPath(life);
  if (lived === null || (lived === "degree") === throughUniversity(archetype)) {
    return say("prologue.handover.archetype", { kind: say(`prologue.archetype.${archetype.id}.name`), was: say(`prologue.archetype.${archetype.id}.was`) });
  }
  return say(`prologue.handover.lived.${lived}`);
}

/** The setting `prologue.full`: every card of the prologue, one answer each, no preset. No screen offers it yet. */
export const FULL_PROLOGUE_KEY = "japacity.prologue.full";

export function fullPrologue(storage: Pick<Storage, "getItem"> | null = safeStorage()): boolean {
  try {
    return storage?.getItem(FULL_PROLOGUE_KEY) === "on";
  } catch {
    return false;
  }
}

function safeStorage(): Pick<Storage, "getItem"> | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
