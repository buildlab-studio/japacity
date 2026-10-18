// The archetypes (prologue.md R-PROLOGUE-010, "The archetypes"): each a preset of the prologue's answers, never held
// by the simulation. The presets themselves are content's (`packages/content/src/prologue/prologue.preset.ts`), so the client
// offline and the server online play one source (server.md R-SERVER-046); a tile here adds the routes its words name.
// Every step has its answer: the client sends the first of the archetype's answers that is allowed, and where a draw has
// shut them all, the open answer that suits the archetype best (`doorAnswer`), so no card shows for a new life. The
// words for each live in content under `prologue.archetype.<id>.*`.
import {
  AGE_CARDS,
  agedAnswers,
  answerOf,
  type Home,
  homedAnswers,
  HOMES,
  lowestYear as presetLowestYear,
  PRESET_THROUGH,
  type PresetId,
  presetHome,
  presetHomes,
  presetOwnAnswer,
  PRESETS,
  startYearOf,
  suitingFirst,
} from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";

import { say } from "../words/text";

type Prologue = NonNullable<PlayerView["prologue"]>;

export { AGE_CARDS, type Home, HOMES, startYearOf };

/** The life from sixteen: the only scenario a tile starts. */
export const FROM_SIXTEEN = "scenario.prologue" as Id<"scenario">;

export type ArchetypeId = PresetId;

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
 * The steps an archetype chooses for itself: its preset without the steps every life passes the same way, unless it
 * answers one its own way. The age cards are the door's, never the tile's: a year set there names every path's card.
 */
export function ownSteps(archetype: Archetype): string[] {
  return Object.keys(archetype.preset).filter((step) => !AGE_CARDS.includes(step) && (!(step in PRESET_THROUGH) || (archetype.preset[step] ?? []).join() !== (PRESET_THROUGH[step] ?? []).join()));
}

/** The routes each tile's words name, its own effort among them; the presets are content's. */
const ROUTES: Readonly<Record<ArchetypeId, readonly Id<"route">[]>> = {
  developer: ["route.uk-talent", "route.uk-skilled", "route.uk-masters"],
  nurse: ["route.uk-care", "route.gulf-contract", "route.canada-points"],
  accountant: ["route.canada-points", "route.uk-skilled", "route.uk-masters"],
  writer: ["route.uk-masters", "route.canada-points"],
  trader: ["route.gulf-contract", "route.road"],
  "shop-worker": ["route.gulf-contract", "route.road"],
  water: ["route.gulf-contract", "route.road"],
};

export const ARCHETYPES: readonly Archetype[] = PRESETS.map((preset) => ({ id: preset.id, preset: preset.answers, leaning: preset.leaning, routes: ROUTES[preset.id] }));

export function archetypeOf(id: string | null | undefined): Archetype | null {
  return ARCHETYPES.find((archetype) => archetype.id === id) ?? null;
}

/**
 * The year a tile's life starts at with no step on the door (R-PROLOGUE-004, decision 0023): its cards answered as the
 * tile answers them, each draw with no setback, up to its age card, and the youngest year that card opens there.
 */
export function lowestYear(archetype: Archetype): number {
  return presetLowestYear(archetype.preset);
}

/**
 * The tile with the age the front door set (R-PROLOGUE-009, decision 0023): `years` older than the year its path
 * reaches, sent as that year on whichever age card the life comes to; a year shut there gives way to the nearest
 * open one above, then below.
 */
export function withAge(archetype: Archetype, years: number): Archetype {
  return { ...archetype, preset: agedAnswers(archetype.preset, years) };
}

/** The homes the door offers a tile (R-PROLOGUE-013): the compound room, the hostel room and the family house to every tile, Makoko to the child of the water alone. */
export function homesFor(archetype: Archetype): Home[] {
  return presetHomes(archetype.preset);
}

/** The home a tile starts in unless the player picks the other: its own preset's, else the family house. */
export function homeOf(archetype: Archetype): Home {
  return presetHome(archetype.preset);
}

/** The tile with the home picked on the door as its home step's preset (R-PROLOGUE-010, 013). */
export function withHome(archetype: Archetype, home: string | null | undefined): Archetype {
  return { ...archetype, preset: homedAnswers(archetype.preset, home) };
}

/** The naira in kobo a tile's life holds at its close, from content's `prologue.archetype.<id>.savings` (whole naira), kept honest by a test. */
export function savingsOf(archetype: Pick<Archetype, "id">): number {
  const figure = Number(say(`prologue.archetype.${archetype.id}.savings`));
  return Number.isInteger(figure) ? figure * 100 : 0;
}

/** The routes a tile opens as short words for its chips, from its one line of what it opens: "Opens: a, b. Starts at 23, or older". */
export function opensChips(id: string): string[] {
  const line = say(`prologue.archetype.${id}.opens`).replace(/^[^:]*:\s*/, "");
  const ways = line.split(/\.\s/)[0] ?? "";
  return ways
    .split(/,\s*/)
    .map((way) => way.trim())
    .filter((way) => way !== "")
    .map((way) => way.charAt(0).toUpperCase() + way.slice(1));
}

/**
 * True when the money a tile's life closes with is drawn, not set: a trade's settlement at the
 * end of its years under the master is a draw, so the door says its figure as "about".
 */
export function moneyDrawn(archetype: Archetype): boolean {
  return (archetype.preset["after-school"] ?? []).includes("apprentice");
}

/** True when one of the tile's ways out counts the person's age in points (Canada's), so its age line names the points. */
export function agePointsCount(archetype: Pick<Archetype, "routes">): boolean {
  return archetype.routes.includes("route.canada-points");
}

/** The archetype's own answer at this card while one of them is allowed, else null: a draw has shut them (R-PROLOGUE-010). */
export function presetAnswer(archetype: Archetype, prologue: Pick<Prologue, "step" | "answers">): string | null {
  return presetOwnAnswer(archetype.preset, prologue.step, prologue.answers);
}

/**
 * The answer the front door sends at this card for a new life (R-PROLOGUE-010): the preset's,
 * else the open answer that suits the archetype, else the first open one. Null only when every answer is shut.
 */
export function doorAnswer(archetype: Archetype, prologue: Pick<Prologue, "step" | "answers">): string | null {
  return answerOf({ answers: archetype.preset, leaning: archetype.leaning }, prologue.step, prologue.answers);
}

/** The card's answers with the one that suits the archetype first; the others keep their order. */
export function answersInOrder<A extends { id: string }>(archetype: Archetype | null, step: string, answers: readonly A[]): A[] {
  return suitingFirst(archetype === null ? null : { answers: archetype.preset, leaning: archetype.leaning }, step, answers);
}

/** True when the tile's years go through university: its preset sits the entrance exam after school. */
export function throughUniversity(archetype: Archetype): boolean {
  return (archetype.preset["after-school"] ?? []).includes("jamb");
}

/** The setting `prologue.full`: every card of the prologue, one answer each, no preset. No screen offers it. */
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
