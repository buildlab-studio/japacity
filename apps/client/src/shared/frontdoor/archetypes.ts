// The archetypes (prologue.md R-PROLOGUE-010, "The archetypes"): each a preset of the prologue's answers,
// held here by the client and never by the simulation. Every step has its answer: the client sends the first
// of the archetype's answers that is allowed, and where a draw has shut them all, the open answer that suits
// the archetype best (`doorAnswer`), so no card shows for a new life. The words for each live in content under
// `prologue.archetype.<id>.*`.
import { content } from "@japacity/content";
import type { Id, PlayerView, PrologueStep } from "@japacity/sim";

import { sixteenPath } from "../words/sixteen";
import { say } from "../words/text";

type Prologue = NonNullable<PlayerView["prologue"]>;

/** The life from sixteen: the only scenario a tile starts. */
export const FROM_SIXTEEN = "scenario.prologue" as Id<"scenario">;

const AGE = "quality.age-months";
const YEAR = 12;
/** An age card's answer: the year the life starts at (R-PROLOGUE-004). */
const START = /^start-(\d+)$/;

/** The year an age card's answer picks, or null for any other answer. */
export function startYearOf(answer: string): number | null {
  const found = START.exec(answer);
  return found === null ? null : Number(found[1]);
}

/** The age cards (R-PROLOGUE-004, decision 0023): the steps whose answers are all years, one for each path after school. */
export const AGE_CARDS: readonly string[] = Object.values(content.prologue)
  .filter((step) => step.answers.length > 0 && step.answers.every((answer) => startYearOf(answer.id) !== null))
  .map((step) => step.id);

/** An age card's years, youngest first, so the first open one is the year its path reaches. */
function cardYears(card: string): string[] {
  return [...(content.prologue[card]?.answers ?? [])].sort((a, b) => (startYearOf(a.id) ?? 0) - (startYearOf(b.id) ?? 0)).map((answer) => answer.id);
}

export type ArchetypeId = "developer" | "nurse" | "accountant" | "writer" | "trader" | "shop-worker" | "water";

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
 * Steps every life passes the same way, never a card of its own: the opening draw, the university (federal is
 * open to everyone), the strike's drag, the results and the settlement; and the steps that were cards before the
 * short door (R-PROLOGUE-010): the exam studied for, a retake taken again, a strike waited
 * out, and the family house to sleep in.
 */
const THROUGH: Readonly<Record<string, readonly string[]>> = {
  draw: ["begin"],
  university: ["federal"],
  "strike-drag": ["back"],
  graduation: ["results-nurse", "results"],
  settlement: ["settle"],
  // The age cards: the youngest year open, the age the path reaches, unless the front door set one (withAge, R-PROLOGUE-009).
  ...Object.fromEntries(AGE_CARDS.map((card) => [card, cardYears(card)])),
  exam: ["study"],
  retake: ["again"],
  strike: ["wait"],
  home: ["family-house"],
};

/** The steps every life passes the same way, which are no archetype's own choice. */
export const THROUGH_STEPS: ReadonlySet<string> = new Set(Object.keys(THROUGH));

/**
 * The steps an archetype chooses for itself: its preset without the steps every life passes the same way, unless it
 * answers one its own way. The age cards are the door's, never the tile's: a year set there names every path's card.
 */
export function ownSteps(archetype: Archetype): string[] {
  return Object.keys(archetype.preset).filter((step) => !AGE_CARDS.includes(step) && (!(step in THROUGH) || (archetype.preset[step] ?? []).join() !== (THROUGH[step] ?? []).join()));
}

/** `friend`: the crowd at the send-off, the answers in order, the first that is open taken (the table's preset). */
const degree = (subjects: string, course: string, side: string, hustle: string, friend: readonly string[]): Record<string, readonly string[]> => ({
  ...THROUGH,
  subjects: [subjects],
  "after-school": ["jamb"],
  course: [course],
  "side-skill": [side],
  hustle: [hustle],
  service: ["serve"],
  friend,
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
    preset: degree("science", "computer-science", "code", "focus", ["tech", "uk"]),
    leaning: { friend: "tech" },
    routes: ["route.uk-talent", "route.uk-skilled", "route.uk-masters"],
  },
  {
    id: "nurse",
    preset: degree("science", "nursing", "books", "focus", ["care", "uk"]),
    leaning: { friend: "care" },
    routes: ["route.uk-care", "route.gulf-contract", "route.canada-points"],
  },
  {
    id: "accountant",
    preset: degree("commercial", "accounting", "trade", "campus-shop", ["canada"]),
    leaning: { friend: "canada" },
    routes: ["route.canada-points", "route.uk-skilled", "route.uk-masters"],
  },
  {
    id: "writer",
    preset: degree("arts", "mass-comm", "content", "focus", ["uk"]),
    leaning: { friend: "uk" },
    routes: ["route.uk-masters", "route.canada-points"],
  },
  {
    id: "trader",
    preset: { ...THROUGH, subjects: ["commercial"], "after-school": ["apprentice"], master: ["spare-parts"], years: ["stay"], friend: ["drivers"] },
    leaning: { friend: "drivers" },
    routes: ["route.gulf-contract", "route.road"],
  },
  {
    id: "shop-worker",
    // The drivers at the send-off, as the trader's: they talk of the Gulf.
    preset: { ...THROUGH, subjects: ["commercial"], "after-school": ["work"], shop: ["save"], friend: ["drivers"] },
    leaning: { friend: "drivers" },
    routes: ["route.gulf-contract", "route.road"],
  },
  {
    // The child of the water (R-PROLOGUE-012): school by canoe, then the counter and the racks, no master and no
    // settlement, and a room on the lagoon at the start, with the family house still there to go back to. The room's
    // small rent is the saving, and the motor park is the way out, as it is the trader's.
    id: "water",
    preset: { ...THROUGH, subjects: ["commercial"], "after-school": ["work"], shop: ["save"], friend: ["drivers"], home: ["makoko"] },
    leaning: { friend: "drivers" },
    routes: ["route.gulf-contract", "route.road"],
  },
];

export function archetypeOf(id: string | null | undefined): Archetype | null {
  return ARCHETYPES.find((archetype) => archetype.id === id) ?? null;
}

/** The outcome of a draw that is no setback (R-PROLOGUE-004): the first that leads neither to a retake nor to a strike. */
function plainOutcome(step: PrologueStep, answer: PrologueStep["answers"][number]): string | null {
  const outcomes = answer.draw ?? [];
  const plain = outcomes.find((outcome) => !["retake", "strike-drag"].includes(outcome.next ?? ""));
  return plain?.next ?? answer.next ?? step.next;
}

/**
 * The year a tile's life starts at with no step on the door (R-PROLOGUE-004, decision 0023): its cards answered as the
 * tile answers them, each draw with no setback, up to its age card, and the youngest year that card opens there: the age
 * its path reaches with no setback, the age the tile says.
 */
export function lowestYear(archetype: Archetype): number {
  let months = content.tuning.prologue.startAgeMonths;
  let at: string | null = "draw";
  for (let guard = 0; guard < 40 && at !== null; guard += 1) {
    const step: PrologueStep | undefined = content.prologue[at];
    if (step === undefined) break;
    if (AGE_CARDS.includes(at)) {
      const open = step.answers.find((answer) => answer.requires.every((requirement) => requirement.type !== "quality/max" || requirement.quality !== AGE || months <= requirement.value));
      return startYearOf(open?.id ?? "") ?? Math.floor(months / YEAR);
    }
    const all = step.answers.map((answer) => ({ id: answer.id, allowed: true }));
    const id = presetAnswer(archetype, { step: at, answers: all }) ?? step.answers[0]?.id;
    const answer = step.answers.find((one) => one.id === id) ?? step.answers[0];
    if (answer === undefined) break;
    months += step.months;
    at = plainOutcome(step, answer);
  }
  return Math.floor(months / YEAR);
}

/**
 * The tile with the age the front door set (R-PROLOGUE-009, decision 0023): `years` older than the year its path
 * reaches, sent as that year on whichever age card the life comes to; a year shut there gives way to the nearest
 * open one above, then below.
 */
export function withAge(archetype: Archetype, years: number): Archetype {
  const year = lowestYear(archetype) + Math.max(0, years);
  const order = (card: string): string[] => {
    const all = cardYears(card);
    const above = all.filter((id) => (startYearOf(id) ?? 0) >= year);
    const below = all.filter((id) => (startYearOf(id) ?? 0) < year).reverse();
    return [...above, ...below];
  };
  return { ...archetype, preset: { ...archetype.preset, ...Object.fromEntries(AGE_CARDS.map((card) => [card, order(card)])) } };
}

/** The homes the door can start a life in (R-PROLOGUE-013): the home step's answers, the three homes play backs (R-HOME-001). */
export const HOMES = ["family-house", "compound-room", "makoko"] as const;
export type Home = (typeof HOMES)[number];

/**
 * The homes the door offers a tile (R-PROLOGUE-013): the family house and the room in a compound
 * to every tile, Makoko to the child of the water alone, whose own home it is.
 */
export function homesFor(archetype: Archetype): Home[] {
  return HOMES.filter((home) => home !== "makoko" || homeOf(archetype) === "makoko");
}

/** The home a tile starts in unless the player picks the other: its own preset's, else the family house. */
export function homeOf(archetype: Archetype): Home {
  const own = archetype.preset["home"]?.[0];
  return HOMES.find((home) => home === own) ?? "family-house";
}

/** The tile with the home picked on the door as its home step's preset (R-PROLOGUE-010, 013). */
export function withHome(archetype: Archetype, home: string | null | undefined): Archetype {
  const picked = HOMES.find((one) => one === home);
  return picked === undefined ? archetype : { ...archetype, preset: { ...archetype.preset, home: [picked] } };
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

/** The archetype's own answer at this card while one of them is allowed, else null: a draw has shut them (R-PROLOGUE-010). */
export function presetAnswer(archetype: Archetype, prologue: Pick<Prologue, "step" | "answers">): string | null {
  const wanted = archetype.preset[prologue.step] ?? [];
  return wanted.find((id) => prologue.answers.some((answer) => answer.id === id && answer.allowed)) ?? null;
}

/**
 * The answer the front door sends at this card for a new life (R-PROLOGUE-010): the preset's,
 * else the open answer that suits the archetype, else the first open one. Null only when every answer is shut.
 */
export function doorAnswer(archetype: Archetype, prologue: Pick<Prologue, "step" | "answers">): string | null {
  return presetAnswer(archetype, prologue) ?? answersInOrder(archetype, prologue.step, prologue.answers).find((answer) => answer.allowed)?.id ?? null;
}

/** The card's answers with the one that suits the archetype first; the others keep their order. */
export function answersInOrder<A extends { id: string }>(archetype: Archetype | null, step: string, answers: readonly A[]): A[] {
  const first = archetype === null ? undefined : (archetype.leaning[step] ?? archetype.preset[step]?.[0]);
  return [...answers].sort((a, b) => Number(b.id === first) - Number(a.id === first));
}

/** True when the tile's years go through university: its preset sits the entrance exam after school. */
export function throughUniversity(archetype: Archetype): boolean {
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
