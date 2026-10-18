// What the send-off scene says and shows, read from content alone (chapter:send-off-scene-in-beats, world.md
// world:plane-cut-at-send-off): the queue's lines from the airport's own talk, Papa's at the gate, each country's hub, its staple and its
// first line, the plane's city, and the family's first messages from the senders the game has. Plain data, so each beat
// is a picture of these and every rule is tested here without a screen.
import { content, familyNames, text } from "@japacity/content";
import type { Currency, Id } from "@japacity/sim";

import { nameOf } from "../../../shared/words/text";

const AIRPORT: Id<"place"> = "place.airport-lagos";

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
const QUEUE_LINES: readonly QueueLine[] = [
  { at: 0, key: `${AIRPORT}.overheard.1`, who: "mum" },
  { at: 1, key: `${AIRPORT}.overheard.2`, who: "cousin" },
  { at: 2, key: `${AIRPORT}.overheard.4`, who: "dad" },
  { at: 3, key: `${AIRPORT}.overheard.5`, who: "you" },
];

/** The one line added for the scene: Papa's at the gate (beat 3), with its speaker beside it in content (city:place-words-are-text-keys). */
export const GATE_LINE = `${AIRPORT}.overheard.6`;

/** The line said after `step` taps. */
export function queueLine(step: number): QueueLine {
  return QUEUE_LINES.find((line) => line.at === step) ?? QUEUE_LINES[0]!;
}

/** How long the character's line stands before the counter comes, after the third tap. */
export const FRONT_MS = 1400;
/** How long the plane's cut lasts (world:plane-cut-at-send-off: about three seconds), moving or still. */
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

/** The flight's chip at the counter (beat 2): its amount from the tuning (route:departure-pays-flight), or none when the employer pays. */
export function flightCost(route: Id<"route">): { amount: number; currency: Currency } | null {
  const flight = content.tuning.route.flight;
  if (content.route[route]?.flightPaidByEmployer === true || typeof flight.amount !== "number") return null;
  return { amount: flight.amount, currency: flight.currency };
}

/** Each country's staple: what pulls in at the stop and what the first ride is (chapter:send-off-scene-in-beats beats 5 and 6). */
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
  /** The hub place's city in content, the plane's sticker (world:plane-cut-at-send-off). */
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

/** The friend's line as content has it: "Even the bus stop.", which fits the two buses. */
const FRIEND_LANDED = "chats.friend.landed.text";

/**
 * The friend's line on the ride, by the staple she rides (chapter:send-off-scene-in-beats (k)): content's own for a bus, and content's
 * line for the taxi or the truck (`chats.friend.landed.text.<staple>`), so the ping fits the ride it pings in and the
 * words have one home.
 */
const FRIEND_BY_STAPLE: Readonly<Record<Staple, string>> = {
  "double-decker": FRIEND_LANDED,
  "domitiana-bus": FRIEND_LANDED,
  taxi: `${FRIEND_LANDED}.taxi`,
  pickup: `${FRIEND_LANDED}.pickup`,
};

/**
 * The family's first messages abroad, in the order they ping in: Mama's (the Chats line the landing brings), the
 * cousin's in the family group, and the friend's. Every one is a line the phone already carries after the landing
 * (story.chats.data.ts, family.data.ts), so the badge counts messages that are really there; the friend's ends on the
 * staple she rides in.
 */
export function firstPings(scenario: Id<"scenario">, staple: Staple = "double-decker"): Ping[] {
  // Each ping stands for a message the phone carries: the friend's shows only where content has the friend's line.
  return [
    { key: "chats.mum.landed.text", carried: "chats.mum.landed.text", from: text["chats.from.mum"] ?? "Mama" },
    { key: "family.size-44.text", carried: "family.size-44.text", from: speakerName("cousin", scenario, "") },
    { key: FRIEND_BY_STAPLE[staple], carried: FRIEND_LANDED, from: text["chats.from.friend"] ?? "" },
  ]
    .filter((ping) => text[ping.carried] !== undefined && ping.from !== "")
    .map(({ key, from }) => ({ key, from }));
}

/**
 * Who stands at the stop on the landing (chapter:send-off-scene-in-beats (j)), each city its own person from the published looks, and of
 * the sex the stop's label names: an aunty in London, a neighbour in Calgary, a man at the corner in Dubai, a brother
 * at Castel Volturno. The second look stands in when the first is the character's own.
 */
export const STOP_PEOPLE: Readonly<Record<string, { sex: "f" | "m"; looks: readonly [string, string] }>> = {
  "country.uk": { sex: "f", looks: ["person_amaka", "person_zainab"] },
  "country.canada": { sex: "m", looks: ["person_dayo", "person_tunde"] },
  "country.uae": { sex: "m", looks: ["person_emeka", "person_femi"] },
  "country.italy": { sex: "m", looks: ["person_bayo", "person_segun"] },
};

/** The look of the person at the stop in a country, never the character's own. */
export function stopLookFor(country: Id<"country">, own: string): string {
  const [first, second] = STOP_PEOPLE[country]?.looks ?? ["person_ngozi", "person_kemi"];
  return first === own ? second : first;
}

/**
 * The looks of the hall's people, never the character's own: Mama, Papa, the cousin, the two ahead in the queue, the
 * clerk at counter 4 (the counter's officer), and the clerks at counters 3 and 5. One more than the hall needs, so the
 * character's own look is left out and every person of the hall still wears a look of their own.
 */
const HALL_LOOKS = ["person_bisi", "person_kunle", "person_tobi", "person_ngozi", "person_segun", "person_femi", "person_kemi", "person_dayo", "person_emeka"] as const;

export interface Cast {
  mum: string;
  dad: string;
  cousin: string;
  ahead: [string, string];
  clerk: string;
  /** The clerks behind counters 3 and 5. */
  desks: [string, string];
}

/** The people of the hall, none wearing the character's own look, no two the same. */
export function castFor(own: string): Cast {
  const looks = HALL_LOOKS.filter((look) => look !== own);
  const [mum = "person_bisi", dad = "person_kunle", cousin = "person_tobi", first = "person_ngozi", second = "person_segun", clerk = "person_femi", left = "person_kemi", right = "person_dayo"] = looks;
  return { mum, dad, cousin, ahead: [first, second], clerk, desks: [left, right] };
}
