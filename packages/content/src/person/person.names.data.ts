// The name pool (names rules 1, 2, 4 and 5; docs/rules/person.md
// person:computer-names-generated): one pool grouped by people, the mix it is drawn with, and every
// named person the game's own words carry, so a check can hold the mix.
// The given names are text keys `person.name.<n>` in person.names.text.ts.
import type { Id } from "@japacity/sim";

export type NamePeople =
  | "yoruba"
  | "igbo"
  | "hausa-fulani"
  | "edo"
  | "ijaw"
  | "efik-ibibio"
  | "tiv"
  | "urhobo-isoko"
  | "kanuri"
  | "idoma"
  | "igala"
  | "nupe";

/** Who a name suits: `either` is given to both. */
export type NameSex = "f" | "m" | "either";

/** `christian` and `muslim` mark names carried mostly by one faith; most names carry none. */
export type NameFaith = "christian" | "muslim" | "neutral";

export interface PoolName {
  /** The text key is `person.name.<n>`. */
  n: number;
  people: NamePeople;
  sex: NameSex;
  faith: NameFaith;
}

/** Where each people's home is, for the rule that both faiths' names appear in the north and in the south. */
export const peopleRegion: Record<NamePeople, "north" | "south"> = {
  yoruba: "south",
  igbo: "south",
  "hausa-fulani": "north",
  edo: "south",
  ijaw: "south",
  "efik-ibibio": "south",
  tiv: "north",
  "urhobo-isoko": "south",
  kanuri: "north",
  idoma: "north",
  igala: "north",
  nupe: "north",
};

/**
 * The mix, in basis points of every name drawn (names rule 2): the three largest
 * peoples first, then a real share for the others.
 */
export const nameMix: Record<NamePeople, number> = {
  "hausa-fulani": 2200,
  yoruba: 1900,
  igbo: 1900,
  edo: 600,
  "efik-ibibio": 600,
  ijaw: 500,
  tiv: 500,
  "urhobo-isoko": 500,
  kanuri: 400,
  idoma: 300,
  igala: 300,
  nupe: 300,
};

/**
 * How far the named people of the game's own words may drift (names rule 2): at
 * least `minPeoples` peoples among them, and the two largest together at most
 * `topTwoMaxBp` of them.
 */
export const namedMix = { minPeoples: 8, topTwoMaxBp: 5000 } as const;

export const namePool: PoolName[] = [
  { n: 1, people: "yoruba", sex: "f", faith: "neutral" },
  { n: 2, people: "yoruba", sex: "f", faith: "neutral" },
  { n: 3, people: "yoruba", sex: "m", faith: "neutral" },
  { n: 4, people: "yoruba", sex: "f", faith: "neutral" },
  { n: 5, people: "yoruba", sex: "either", faith: "neutral" },
  { n: 6, people: "yoruba", sex: "f", faith: "neutral" },
  { n: 7, people: "yoruba", sex: "m", faith: "neutral" },
  { n: 8, people: "yoruba", sex: "f", faith: "neutral" },
  { n: 9, people: "yoruba", sex: "m", faith: "neutral" },
  { n: 10, people: "yoruba", sex: "either", faith: "neutral" },
  { n: 11, people: "yoruba", sex: "m", faith: "neutral" },
  { n: 12, people: "yoruba", sex: "f", faith: "neutral" },
  { n: 13, people: "yoruba", sex: "m", faith: "neutral" },
  { n: 14, people: "yoruba", sex: "either", faith: "neutral" },
  { n: 15, people: "yoruba", sex: "f", faith: "neutral" },
  { n: 16, people: "yoruba", sex: "m", faith: "neutral" },
  { n: 17, people: "yoruba", sex: "f", faith: "muslim" },
  { n: 18, people: "yoruba", sex: "m", faith: "muslim" },
  { n: 19, people: "yoruba", sex: "f", faith: "muslim" },
  { n: 20, people: "yoruba", sex: "m", faith: "muslim" },
  { n: 21, people: "igbo", sex: "m", faith: "neutral" },
  { n: 22, people: "igbo", sex: "m", faith: "neutral" },
  { n: 23, people: "igbo", sex: "f", faith: "neutral" },
  { n: 24, people: "igbo", sex: "m", faith: "neutral" },
  { n: 25, people: "igbo", sex: "f", faith: "neutral" },
  { n: 26, people: "igbo", sex: "f", faith: "neutral" },
  { n: 27, people: "igbo", sex: "m", faith: "neutral" },
  { n: 28, people: "igbo", sex: "either", faith: "neutral" },
  { n: 29, people: "igbo", sex: "f", faith: "neutral" },
  { n: 30, people: "igbo", sex: "m", faith: "neutral" },
  { n: 31, people: "igbo", sex: "m", faith: "neutral" },
  { n: 32, people: "igbo", sex: "f", faith: "neutral" },
  { n: 33, people: "igbo", sex: "m", faith: "neutral" },
  { n: 34, people: "igbo", sex: "f", faith: "neutral" },
  { n: 35, people: "igbo", sex: "f", faith: "neutral" },
  { n: 36, people: "igbo", sex: "m", faith: "christian" },
  { n: 37, people: "hausa-fulani", sex: "m", faith: "muslim" },
  { n: 38, people: "hausa-fulani", sex: "f", faith: "muslim" },
  { n: 39, people: "hausa-fulani", sex: "m", faith: "muslim" },
  { n: 40, people: "hausa-fulani", sex: "f", faith: "muslim" },
  { n: 41, people: "hausa-fulani", sex: "m", faith: "muslim" },
  { n: 42, people: "hausa-fulani", sex: "m", faith: "muslim" },
  { n: 43, people: "hausa-fulani", sex: "f", faith: "muslim" },
  { n: 44, people: "hausa-fulani", sex: "m", faith: "muslim" },
  { n: 45, people: "hausa-fulani", sex: "f", faith: "muslim" },
  { n: 46, people: "hausa-fulani", sex: "f", faith: "muslim" },
  { n: 47, people: "hausa-fulani", sex: "m", faith: "neutral" },
  { n: 48, people: "hausa-fulani", sex: "f", faith: "neutral" },
  { n: 49, people: "hausa-fulani", sex: "m", faith: "neutral" },
  { n: 50, people: "hausa-fulani", sex: "m", faith: "christian" },
  { n: 51, people: "hausa-fulani", sex: "f", faith: "christian" },
  { n: 52, people: "edo", sex: "either", faith: "neutral" },
  { n: 53, people: "edo", sex: "m", faith: "neutral" },
  { n: 54, people: "edo", sex: "f", faith: "neutral" },
  { n: 55, people: "edo", sex: "m", faith: "neutral" },
  { n: 56, people: "edo", sex: "m", faith: "neutral" },
  { n: 57, people: "edo", sex: "f", faith: "neutral" },
  { n: 58, people: "edo", sex: "f", faith: "christian" },
  { n: 59, people: "ijaw", sex: "either", faith: "neutral" },
  { n: 60, people: "ijaw", sex: "either", faith: "neutral" },
  { n: 61, people: "ijaw", sex: "f", faith: "neutral" },
  { n: 62, people: "ijaw", sex: "m", faith: "neutral" },
  { n: 63, people: "ijaw", sex: "m", faith: "neutral" },
  { n: 64, people: "ijaw", sex: "f", faith: "neutral" },
  { n: 65, people: "ijaw", sex: "m", faith: "christian" },
  { n: 66, people: "efik-ibibio", sex: "f", faith: "neutral" },
  { n: 67, people: "efik-ibibio", sex: "either", faith: "neutral" },
  { n: 68, people: "efik-ibibio", sex: "f", faith: "neutral" },
  { n: 69, people: "efik-ibibio", sex: "m", faith: "neutral" },
  { n: 70, people: "efik-ibibio", sex: "f", faith: "neutral" },
  { n: 71, people: "efik-ibibio", sex: "either", faith: "neutral" },
  { n: 72, people: "efik-ibibio", sex: "m", faith: "neutral" },
  { n: 73, people: "efik-ibibio", sex: "m", faith: "neutral" },
  { n: 74, people: "efik-ibibio", sex: "f", faith: "neutral" },
  { n: 75, people: "efik-ibibio", sex: "m", faith: "neutral" },
  { n: 76, people: "tiv", sex: "m", faith: "neutral" },
  { n: 77, people: "tiv", sex: "m", faith: "neutral" },
  { n: 78, people: "tiv", sex: "f", faith: "neutral" },
  { n: 79, people: "tiv", sex: "f", faith: "neutral" },
  { n: 80, people: "tiv", sex: "m", faith: "neutral" },
  { n: 81, people: "tiv", sex: "f", faith: "neutral" },
  { n: 82, people: "urhobo-isoko", sex: "either", faith: "neutral" },
  { n: 83, people: "urhobo-isoko", sex: "either", faith: "neutral" },
  { n: 84, people: "urhobo-isoko", sex: "f", faith: "neutral" },
  { n: 85, people: "urhobo-isoko", sex: "m", faith: "neutral" },
  { n: 86, people: "urhobo-isoko", sex: "m", faith: "neutral" },
  { n: 87, people: "urhobo-isoko", sex: "f", faith: "neutral" },
  { n: 88, people: "urhobo-isoko", sex: "f", faith: "neutral" },
  { n: 89, people: "urhobo-isoko", sex: "f", faith: "christian" },
  { n: 90, people: "kanuri", sex: "m", faith: "muslim" },
  { n: 91, people: "kanuri", sex: "m", faith: "muslim" },
  { n: 92, people: "kanuri", sex: "m", faith: "muslim" },
  { n: 93, people: "kanuri", sex: "f", faith: "muslim" },
  { n: 94, people: "kanuri", sex: "f", faith: "muslim" },
  { n: 95, people: "kanuri", sex: "f", faith: "muslim" },
  { n: 96, people: "idoma", sex: "m", faith: "neutral" },
  { n: 97, people: "idoma", sex: "m", faith: "neutral" },
  { n: 98, people: "idoma", sex: "m", faith: "neutral" },
  { n: 99, people: "idoma", sex: "f", faith: "neutral" },
  { n: 100, people: "idoma", sex: "f", faith: "neutral" },
  { n: 101, people: "idoma", sex: "f", faith: "neutral" },
  { n: 102, people: "igala", sex: "m", faith: "neutral" },
  { n: 103, people: "igala", sex: "m", faith: "neutral" },
  { n: 104, people: "igala", sex: "m", faith: "neutral" },
  { n: 105, people: "igala", sex: "f", faith: "neutral" },
  { n: 106, people: "igala", sex: "f", faith: "neutral" },
  { n: 107, people: "igala", sex: "either", faith: "neutral" },
  { n: 108, people: "nupe", sex: "m", faith: "neutral" },
  { n: 109, people: "nupe", sex: "m", faith: "neutral" },
  { n: 110, people: "nupe", sex: "m", faith: "neutral" },
  { n: 111, people: "nupe", sex: "m", faith: "muslim" },
  { n: 112, people: "nupe", sex: "f", faith: "neutral" },
  { n: 113, people: "nupe", sex: "f", faith: "muslim" },
];

/** What a named person is in the story. A name never predicts it (names rule 5). */
/**
 * `tout`, `runner`, `middleman`: the agents at Ojuelegba's stop; `adviser`: the licensed adviser
 * (advice:advisers-are-invented-people); `chaser`: the chasers a friend puts the player onto (advice:chaser-runs-around-cheaper).
 */
export type NamedRole = "partner" | "agent" | "friend" | "fx" | "landlord" | "auntie" | "relative" | "tout" | "runner" | "middleman" | "adviser" | "chaser";

/** Roles that take the player's money or may cheat them: no people holds two of these (names rule 5). */
export const takingRoles: NamedRole[] = ["agent", "fx", "landlord", "tout", "runner", "middleman", "adviser", "chaser"];

export interface NamedPerson {
  name: string;
  people: NamePeople;
  role: NamedRole;
  /** The text keys whose words carry the name. */
  keys: string[];
}

/**
 * The people of each ready life's family (names rule 3, scenario.md): the ready lives carry no name of their own, and
 * their families' names (familyNames in family.data.ts, siblingNames in story.chats.data.ts) are of these peoples, the
 * three largest and at least one other.
 */
export const familyPeople: Record<Id<"scenario">, NamePeople> = {
  "scenario.graduate": "igbo",
  "scenario.banker": "yoruba",
  "scenario.developer": "hausa-fulani",
  "scenario.nurse": "igbo",
  "scenario.teacher": "efik-ibibio",
};

/**
 * Every named person in the game's own words, drawn from the pool. The
 * place and guide words are scenery kept by their own checks.
 */
export const namedPeople: NamedPerson[] = [
  { name: "Gbenga", people: "yoruba", role: "agent", keys: ["offer.held-funds-agent.name", "offer.held-funds-agent.who", "obligation.held-funds-agent.name"] },
  { name: "Terna", people: "tiv", role: "friend", keys: ["offer.send-off-party.name", "offer.send-off-party.who", "offer.agent-chaser.who", "prologue.friend.card", "chats.from.friend", "offer.agent-chaser.title", "offer.agent-chaser.body"] },
  { name: "Dele", people: "yoruba", role: "partner", keys: ["person.dele-banker.name"] },
  { name: "Hauwa", people: "hausa-fulani", role: "partner", keys: ["person.hauwa-nurse.name"] },
  { name: "Kelechi", people: "igbo", role: "partner", keys: ["person.kelechi-developer.name"] },
  { name: "Ejiro", people: "urhobo-isoko", role: "partner", keys: ["person.ejiro-uk.name"] },
  { name: "Uduak", people: "efik-ibibio", role: "partner", keys: ["person.uduak-canada.name"] },
  { name: "Tonye", people: "ijaw", role: "partner", keys: ["person.tonye-dubai.name"] },
  // advice:chaser-runs-around-cheaper: the chaser a friend puts the player onto.
  { name: "Hadiza", people: "hausa-fulani", role: "chaser", keys: ["offer.agent-chaser.who.1.name"] },
  // The person News names as the source of a story she tells.
  { name: "Tolu", people: "yoruba", role: "friend", keys: ["news.uk-unis-recruit.in-force.source", "chapter.landing.brief.giver", "chapter.secure.brief.giver"] },
  // The friend at the hub who hands the first briefs (the briefs' words, chapter.text.ts).
  { name: "Lanre", people: "yoruba", role: "friend", keys: ["chapter.brief.giver", "chapter.find-your-feet.brief.giver", "chapter.build-the-file.brief.giver"] },
];
