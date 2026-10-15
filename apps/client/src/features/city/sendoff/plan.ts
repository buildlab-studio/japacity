// What the send-off scene says and shows, read from content alone (docs/rules/chapter.md R-CHAPTER-012, world.md
// R-WORLD-037): the queue's lines from the airport's own talk, Papa's at the gate, each country's hub, its staple and its
// first line, the plane's city, and the family's first messages from the senders the game has. Plain data, so each beat
// is a picture of these and every rule is tested here without a screen.
import { content, familyNames, text } from "@japacity/content";
import type { Currency, Id } from "@japacity/sim";

import { nameOf } from "../../../shared/words/text";

export const AIRPORT: Id<"place"> = "place.airport-lagos";

/** Who speaks in the hall: the family behind the rope, and the character last. */
export type Speaker = "mum" | "dad" | "cousin" | "you";

export interface QueueLine {
  /** After how many taps of Step forward the line is said: 0 is the hall as it opens. */
  at: number;
  key: string;
  who: Speaker;
}

/**
 * The hall's talk (beat 1): Mama's line as the hall opens, then one line a tap from the family, the character's own (the
 * airport's fifth) on the third. Every line is the airport's own (`place.airport-lagos.overheard.*`), none new.
 */
export const QUEUE_LINES: readonly QueueLine[] = [
  { at: 0, key: `${AIRPORT}.overheard.1`, who: "mum" },
  { at: 1, key: `${AIRPORT}.overheard.2`, who: "cousin" },
  { at: 2, key: `${AIRPORT}.overheard.4`, who: "dad" },
  { at: 3, key: `${AIRPORT}.overheard.5`, who: "you" },
];

/** The one line added for the scene: Papa's at the gate (beat 3), with its speaker beside it in content (R-CITY-024). */
export const GATE_LINE = `${AIRPORT}.overheard.6`;

/** The line said after `step` taps. */
export function queueLine(step: number): QueueLine {
  return QUEUE_LINES.find((line) => line.at === step) ?? QUEUE_LINES[0]!;
}

/** The people still ahead after `step` taps: two as the hall opens, none at the third. */
export function aheadAfter(step: number): number {
  return Math.max(0, 2 - step);
}

/** How long the character's line stands before the counter comes, after the third tap. */
export const FRONT_MS = 1400;
/** How long the plane's cut lasts (R-WORLD-037: about three seconds), moving or still. */
export const PLANE_MS = 3000;

/** The family's names as the game has them (story.text.ts, family.text.ts): Mama, Papa and the life's cousin by name. */
export function speakerName(who: Speaker, scenario: Id<"scenario">, you: string): string {
  switch (who) {
    case "mum":
      return text["chats.from.mum"] ?? "Mama";
    case "dad":
      return text[`${GATE_LINE}.by`] ?? text["chats.from.dad"] ?? "Papa";
    case "cousin": {
      const name = familyNames[scenario]?.cousin;
      return name === undefined ? (text["family.from.cousin.plain"] ?? "Your cousin") : (text["family.from.cousin"] ?? "{name}").replace("{name}", name);
    }
    case "you":
      return you;
    default: {
      const never: never = who;
      throw new Error(`Unknown speaker ${String(never)}`);
    }
  }
}

/** The flight's chip at the counter (beat 2): its amount from the tuning (route.md R-ROUTE-020), or none when the employer pays. */
export function flightCost(route: Id<"route">): { amount: number; currency: Currency } | null {
  const flight = content.tuning.route.flight;
  if (content.route[route]?.flightPaidByEmployer === true || typeof flight.amount !== "number") return null;
  return { amount: flight.amount, currency: flight.currency };
}

/** Each country's staple: what pulls in at the stop and what the first ride is (R-CHAPTER-012 beats 5 and 6). */
export type Staple = "double-decker" | "pickup" | "taxi" | "domitiana-bus";

const STAPLES: Readonly<Record<string, Staple>> = {
  "country.uk": "double-decker",
  "country.canada": "pickup",
  "country.uae": "taxi",
  "country.italy": "domitiana-bus",
};

export interface Landing {
  country: Id<"country">;
  /** The country's hub place in content: the route's first neighbourhood. */
  hub: Id<"place">;
  /** The hub place's city in content, the plane's sticker (R-WORLD-037). */
  city: string;
  staple: Staple;
  /** The hub's first overheard line, said at the stop. */
  heard: string;
  /** Snow and breath clouds (Calgary), heat shimmer (Dubai), rain (London), or none. */
  air: "rain" | "snow" | "heat" | "sea";
}

const AIR: Readonly<Record<Staple, Landing["air"]>> = { "double-decker": "rain", pickup: "snow", taxi: "heat", "domitiana-bus": "sea" };

/** The landing for a country: its hub in content, or null for a country with none (the road has no landing). */
export function landingOf(country: Id<"country">): Landing | null {
  const hub = Object.values(content.place).find((place) => place.country === country && place.hub);
  const staple = STAPLES[country];
  if (hub === undefined || staple === undefined || hub.city === null) return null;
  return { country, hub: hub.id, city: hub.city, staple, heard: `${hub.id}.overheard.1`, air: AIR[staple] };
}

/** The hub's name on the bus's blind, as a blind prints it. */
export function blindName(hub: Id<"place">): string {
  return nameOf(hub).toUpperCase();
}

/** A first message abroad (beat 6): who sends it, as the phone names them, and its words in content. */
export interface Ping {
  key: string;
  from: string;
}

/**
 * The family's first messages abroad, in the order they ping in: Mama's (the Chats line the landing brings), the
 * cousin's in the family group, and the friend's. Every one is a line the phone already carries after the landing
 * (story.chats.data.ts, family.data.ts), so the badge counts messages that are really there.
 */
export function firstPings(scenario: Id<"scenario">): Ping[] {
  return [
    { key: "chats.mum.landed.text", from: text["chats.from.mum"] ?? "Mama" },
    { key: "family.size-44.text", from: speakerName("cousin", scenario, "") },
    { key: "chats.friend.landed.text", from: text["chats.from.friend"] ?? "" },
  ].filter((ping) => text[ping.key] !== undefined && ping.from !== "");
}

/** The look of the family's stickers, never the character's own: Mama, Papa, the cousin, then the two ahead and the clerk. */
const FAMILY_LOOKS = ["chr_bisi", "chr_kunle", "chr_tobi", "chr_ngozi", "chr_segun", "chr_femi", "chr_emeka"] as const;

export interface Cast {
  mum: string;
  dad: string;
  cousin: string;
  ahead: [string, string];
  clerk: string;
}

/** The people of the hall, none wearing the character's own look. */
export function castFor(own: string): Cast {
  const looks = FAMILY_LOOKS.filter((look) => look !== own);
  const [mum = "chr_bisi", dad = "chr_kunle", cousin = "chr_tobi", first = "chr_ngozi", second = "chr_segun", clerk = "chr_femi"] = looks;
  return { mum, dad, cousin, ahead: [first, second], clerk };
}
