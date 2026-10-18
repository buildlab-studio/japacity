// The people part of the view read for the screens: who a bond is with, what
// ending it costs, which bond a slot of time goes to, and the words for a
// moment, an interview option and a phrase. The people tab, the month plan,
// the route gates and the interview all read these, so they live here.
import { content, text } from "@japacity/content";
import type { BondStage, Id, Moment, PersonFacts, PhraseEntry, PlayerView, ReportLine } from "@japacity/sim";

import { lowerFirst, nameOf, say } from "../words/text";

export type BondView = PlayerView["people"]["bonds"][number];
export type SlotView = PlayerView["people"]["slots"][string];

export const SEE: Id<"activity"> = "activity.see-someone";
export const CALL: Id<"activity"> = "activity.call-someone";
const COURTED: readonly BondStage[] = ["courting", "partner", "married"];
export const TOGETHER: readonly BondStage[] = ["partner", "married"];

/** The slots in the order a family is told: partner, the siblings by number, then the parents. */
export function slotOrder(keys: readonly string[]): string[] {
  const rank = (key: string): number => (key === "partner" ? 0 : key.startsWith("sibling-") ? 1 : key === "mother" ? 2 : 3);
  return [...keys].sort((left, right) => rank(left) - rank(right) || left.localeCompare(right, "en", { numeric: true }));
}

/** What a slot is for: `partner`, `sibling`, `mother` or `father`. */
export function slotKind(key: string): "partner" | "sibling" | "mother" | "father" {
  if (key === "partner" || key === "mother" || key === "father") return key;
  return "sibling";
}

/** The computer character a bond is with, as the view names it (decision 0002), or null for a player. */
export function personOf(bond: Pick<BondView, "person">): Id<"person"> | null {
  return bond.person;
}

/** A bond's name from content or who they are to the character, before siblings who share one are told apart. */
function plainName(bond: Pick<BondView, "role" | "label" | "person">): string {
  const person = personOf(bond);
  if (person !== null && text[`${person}.name`] !== undefined) return nameOf(person);
  const who = bond.label === "computer" ? say(`ui.people.who.${bond.role}`) : say("ui.people.who.player");
  return who.charAt(0).toUpperCase() + who.slice(1);
}

/**
 * A bond's name as a heading: a computer's name from content, or who they are
 * to the character. Given the other bonds, two siblings who would share a name
 * are told apart by age, since the facts carry no gender.
 */
export function bondName(bond: Pick<BondView, "id" | "role" | "label" | "person" | "facts">, bonds: readonly Pick<BondView, "id" | "role" | "label" | "person" | "facts">[] = []): string {
  const name = plainName(bond);
  if (bond.role !== "sibling") return name;
  const twins = bonds.filter((other) => other.id !== bond.id && other.role === "sibling" && plainName(other) === name);
  if (twins.length === 0) return name;
  const age = bond.facts?.ageMonths ?? null;
  const ages = twins.map((other) => other.facts?.ageMonths ?? null);
  if (age === null || ages.some((other) => other === null || other === age)) return say("ui.people.sibling.other", { name, number: bonds.filter((other) => other.role === "sibling").findIndex((other) => other.id === bond.id) + 1 });
  return say(ages.every((other) => other !== null && other < age) ? "ui.people.sibling.older" : ages.every((other) => other !== null && other > age) ? "ui.people.sibling.younger" : "ui.people.sibling.middle", { name });
}

/** A spot, a what or a call as words, from the people's lists in content. */
function listWords(kind: "spot" | "what" | "call" | "wedding-spot", value: string): string {
  return text[`people.${kind}.${value}`] ?? value;
}

function upperFirst(words: string): string {
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** One moment of a bond's history as a short line. */
export function momentWords(moment: Moment): string {
  const said = (): string => {
    switch (moment.kind) {
      case "met":
        return upperFirst(say("ui.people.moment.met", { spot: listWords("spot", moment.spot ?? ""), what: listWords("what", moment.what) }));
      case "call":
        return say("ui.people.moment.call", { what: text[`people.call.${moment.what}`] ?? listWords("what", moment.what) });
      case "said":
        return say("ui.people.moment.said", { what: phraseWords(moment.what as Id<"phrase">, moment.spot) });
      case "wedding":
        return say("ui.people.moment.wedding", { spot: listWords("wedding-spot", moment.spot ?? "") });
      default: {
        const never: never = moment.kind;
        throw new Error(`Unknown moment ${String(never)}.`);
      }
    }
  };
  return moment.by === "them" ? say("ui.people.moment.by-them", { moment: said() }) : said();
}

/** True when the other side is where the character is: home, or the same country abroad (person:time-together-is-an-act). */
function samePlace(view: PlayerView, facts: PersonFacts): boolean {
  if (facts.where !== view.place.where) return false;
  return facts.where !== "abroad" || facts.country === view.place.country;
}

function lastTick(bond: BondView): number {
  const moments = bond.moments ?? [];
  return moments.length === 0 ? -1 : Math.max(...moments.map((moment) => moment.tick));
}

/**
 * The bond a slot of time with someone goes to (person:time-together-is-an-act): of the bonds at
 * courting or later in the same place (to see) or elsewhere (to call), the one
 * that has waited longest for a moment.
 * The view has no `lastMomentMonth`, so the wait is read from the last
 * moment's tick; with two bonds waiting since courting, the engine may pick the other.
 */
export function timeWith(view: PlayerView, activity: Id<"activity">): BondView | null {
  if (activity !== SEE && activity !== CALL) return null;
  const together = activity === SEE;
  const eligible = view.people.bonds
    .filter((bond) => COURTED.includes(bond.stage) && bond.facts !== null && samePlace(view, bond.facts) === together)
    .sort((left, right) => lastTick(left) - lastTick(right) || left.id.localeCompare(right.id));
  return eligible[0] ?? null;
}

/** The route a joint holds in this life: the lead route when leading, else the one followed on. */
function jointRoute(view: PlayerView): Id<"route"> | null {
  const joint = view.people.joint;
  if (joint === null) return null;
  if (joint.lead === "me") return joint.route;
  return content.route[joint.route]?.dependants ?? joint.route;
}

export interface EndCost {
  /** True when the stand-in is on, and ending it costs nobody anything (person:stand-in-acts-narrowly). */
  absence: boolean;
  standing: number;
  wellbeing: number;
  /** True when an application resting on the bond is withdrawn. */
  joint: boolean;
}

/** What ending a bond costs the one who ends it, said before it is done (person:ender-pays-in-standing, person:joint-collapses-with-bond). */
export function endCost(view: PlayerView, bond: BondView): EndCost {
  const numbers = content.tuning.people;
  const onJoint = view.people.joint?.bond === bond.id;
  if (bond.standIn === "on") return { absence: true, standing: 0, wellbeing: 0, joint: onJoint };
  const route = onJoint ? jointRoute(view) : null;
  const applying = route !== null && view.routes.find((held) => held.id === route)?.state === "applying";
  const byStage = bond.stage === "courting" ? numbers.endStanding.courting : bond.stage === "partner" ? numbers.endStanding.partner : bond.stage === "married" ? numbers.endStanding.married : 0;
  return { absence: false, standing: byStage + (applying ? numbers.endStanding.applying : 0), wellbeing: numbers.endWellbeing, joint: onJoint };
}

/**
 * The player's month a moment's tick fell in, through the era's own reading of
 * ticks as months (director:one-era-at-a-time), or null before the director runs.
 */
function monthOfTick(view: PlayerView, tick: number): number | null {
  const era = view.era;
  if (era === null) return null;
  return tick + era.sinceMonth - era.since;
}

/** Months since the bond's last moment, or null when it cannot be told. */
export function monthsWithout(view: PlayerView, bond: BondView): number | null {
  const tick = lastTick(bond);
  if (tick < 0) return null;
  const month = monthOfTick(view, tick);
  return month === null ? null : Math.max(0, view.month - month);
}

/**
 * The month a bond ended, read back from its cooldown (person:ended-bond-record-kept sets it to the end's month plus
 * `tuning.people.recourtMonths`), or null for a bond not ended. The view carries no end of its own (person:view-shows-people).
 */
function endedMonth(bond: Pick<BondView, "stage" | "cooldownUntil">): number | null {
  if (bond.stage !== "ended" || bond.cooldownUntil === null) return null;
  return bond.cooldownUntil - content.tuning.people.recourtMonths;
}

/**
 * True while an ended bond's thread stays in Chats (person:computer-partner-drifts): through the
 * month it ended in, with the line that says so in its head, and gone once that month ends.
 */
export function endStillTold(view: Pick<PlayerView, "month">, bond: Pick<BondView, "stage" | "cooldownUntil">): boolean {
  const month = endedMonth(bond);
  return month !== null && month >= view.month;
}

/** How a bond ended, as its thread's head tells it: they stopped waiting, they left, you ended it, or it is over. */
export type EndedHow = "drift" | "them" | "me" | "other";

const END_LINES: Readonly<Record<string, EndedHow>> = {
  "line.people.drifted": "drift",
  "line.people.left": "them",
  "line.people.ended": "me",
};

/**
 * How a bond ended, read from the lines that told it (the month's report and the lines of the month in hand and the
 * last): the line whose `who` is this bond's person, or `player` for a friend. `other` when no such line is held.
 */
export function endedHow(bond: Pick<BondView, "person">, lines: readonly ReportLine[]): EndedHow {
  const who = bond.person ?? "player";
  const told = lines.filter((line) => line.key.startsWith("line.people.") && line.params["who"] === who).map((line) => END_LINES[line.key]);
  return told.findLast((how) => how !== undefined) ?? "other";
}

/** The routes a joint may be asked on: known or later, and bringing a partner (person:joint-application-proposed, person:partner-routes-heard-via-bond). */
export function jointRoutes(view: PlayerView): Id<"route">[] {
  return view.routes
    .filter((route) => route.state !== "unknown")
    .filter((route) => {
      const entry = content.route[route.id];
      return entry !== undefined && (entry.gate === "partner" || entry.dependants !== null);
    })
    .map((route) => route.id);
}

/** The steps a bond may be asked to take at its stage. The engine still judges each (person:proposing-a-step, person:joint-application-proposed). */
export function stepsFor(view: PlayerView, bond: BondView): ("partner" | "marry" | "joint")[] {
  if (bond.role !== "partner") return [];
  switch (bond.stage) {
    case "courting":
      return ["partner"];
    case "partner":
      return view.people.joint === null ? ["marry", "joint"] : ["marry"];
    case "married":
      return view.people.joint === null ? ["joint"] : [];
    case "connected":
    case "ended":
      return [];
    default: {
      const never: never = bond.stage;
      throw new Error(`Unknown stage ${String(never)}.`);
    }
  }
}

/** A preset phrase as it reads, with its fill-in put in or left as dots. */
export function phraseWords(id: Id<"phrase">, fill: string | null): string {
  const template = text[`${id}.name`] ?? id;
  return template.replace(/\{([a-z]+)\}/, (_whole, kind: string) => (fill === null ? "..." : fillWords(id, kind, fill)));
}

/** A fill-in as words: a spot, a route or a story by name, or the phrase's own option. */
export function fillWords(id: Id<"phrase">, kind: string, fill: string): string {
  switch (kind) {
    case "spot":
      return listWords("spot", fill);
    case "route":
      return text[`${fill}.name`] ?? fill;
    case "news":
      return text[`${fill}.name`] ?? text[`${fill}.announced.head`] ?? fill;
    default:
      return text[`${id}.fill.${fill}`] ?? fill;
  }
}

/** The phrases that may be said in a conversation (pair:preset-phrases-only, pair:place-phrases-not-stored): every one not kept for places. */
export function conversationPhrases(): PhraseEntry[] {
  return Object.values(content.phrase).filter((phrase) => phrase.where !== "place");
}

const INTERVIEW = "interview.genuineness";

/** The interview's name from content, as it reads mid-sentence: "the relationship interview". */
export function interviewName(): string {
  return lowerFirst(nameOf(INTERVIEW));
}

/** One option of an interview question as words: the entry's own, or the spot, what, call, job or phrase it names. */
export function optionWords(question: string, option: string): string {
  const own = text[`${INTERVIEW}.a.${question}.${option}`];
  if (own !== undefined) return own;
  const named = text[`people.spot.${option}`] ?? text[`people.what.${option}`] ?? text[`people.call.${option}`];
  if (named !== undefined) return named.charAt(0).toUpperCase() + named.slice(1);
  if (option.startsWith("phrase.")) return phraseWords(option as Id<"phrase">, null);
  return text[`${option}.name`] ?? option;
}
