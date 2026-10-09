// The archetypes (prologue.md R-PROLOGUE-010, "The archetypes"): each a preset of the prologue's answers,
// held here by the client and never by the simulation. For a step the archetype names, the client sends
// the first of its answers that is allowed; a step it leaves open, or whose answers are all shut after a
// draw, shows its card. The words for each live in content under `prologue.archetype.<id>.*`.
import type { Id, PlayerView } from "@japacity/sim";

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
};

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
    preset: degree("science", "computer-science", "code", "freelance"),
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
