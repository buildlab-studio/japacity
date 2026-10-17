// What is on a share card, as words, read from the view's card alone
// (docs/rules/share.md R-SHARE-004 to R-SHARE-008, R-SHARE-011). The screen's
// card and the drawn image both read this, so they never say different things.
import { content, type ShareKind } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";

import { readPerson } from "../../authority/person";
import { bandWords, hasWords, nameOf, say, sayCount, words } from "../words/text";

export type ShareCard = NonNullable<PlayerView["card"]>;

export interface CardFace {
  kind: ShareKind;
  /** False for the ending: it is shown, never shared (R-SHARE-002). */
  shareable: boolean;
  kicker: string;
  title: string;
  /** The chapter a chapter card closes, by name. */
  chapter: string | null;
  /** The character's first name, never the account's (R-SHARE-008). */
  name: string | null;
  route: string | null;
  percent: number | null;
  percentLabel: string;
  monthsLabel: string;
  standingLabel: string;
  mostLabel: string;
  /**
   * The time played as years and months, and how home sees the character as its band, never a
   * figure (docs/rules/text.md R-TEXT-005). Null where the moment has no figures to show: the road's two cards.
   */
  stats: { months: string; standing: string } | null;
  /** The things done most, as words, at most three. */
  most: string[];
  body: string | null;
  /** The credits for the journalism behind the road, on the real-story card on screen only (R-ROAD-011). */
  credits: string[];
  /** The composition drawn behind the words (R-SHARE-007). */
  art: string;
  sender: string;
  address: string;
  officialLine: string;
  disclaimer: string;
}

const MOST = 3;

/** Months played as a person says them: "2 years", "1 year and 3 months", "5 months". */
export function playedWords(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearWords = sayCount("ui.card.played.years", years, { count: years });
  const monthWords = sayCount("ui.card.played.months", rest, { count: rest });
  if (years === 0) return monthWords;
  return rest === 0 ? yearWords : say("ui.card.played.years-months", { years: yearWords, months: monthWords });
}

/** How home sees the character, as the standing's band. */
export function standingWords(standing: number): string {
  return bandWords("quality.standing", standing) ?? "";
}

/** The road's cards tell a story, not a score. */
const STORY_KINDS: ReadonlySet<ShareKind> = new Set(["real-story", "lost"]);

/** The moments that come only once the character has flown. */
const ABROAD_KINDS: ReadonlySet<ShareKind> = new Set(["first-pay-abroad", "secured", "december"]);

/** The chapter the plane opens: it and every chapter after it are lived abroad. */
const LANDING = "chapter.landing";

/** The cards' words for the moments abroad, first drafts in the voice of docs/rules/text.md; content's table wins. */
const CARD_TEXT: Record<string, string> = {
  "share.first-pay-abroad.body": "A room with a lock, a job, and the first month's pay in.",
};

export function cardWords(key: string): string {
  return hasWords(key) ? say(key) : (CARD_TEXT[key] ?? key);
}

/**
 * The japacity figure is how ready the move is, so a card for a moment after the flight carries none
 * (R-SHARE-004, "where the moment has them"): the first pay abroad, a status
 * secured, the December visit, and the landing's chapter or one after it.
 */
function afterTheFlight(card: ShareCard): boolean {
  if (ABROAD_KINDS.has(card.kind)) return true;
  if (card.kind !== "chapter" || card.chapter === undefined || card.chapter === null) return false;
  const order = content.chapter[card.chapter]?.order;
  const landing = content.chapter[LANDING]?.order;
  return order !== undefined && landing !== undefined && order >= landing;
}

function artOf(card: ShareCard): string {
  const byChapter = card.kind === "chapter" && card.chapter !== undefined && card.chapter !== null ? `share.${card.chapter}.art` : null;
  return say(byChapter !== null && hasWords(byChapter) ? byChapter : `share.${card.kind}.art`);
}

/**
 * The character's name as the band says it (share.md R-SHARE-004), the one source for the card, the
 * stub, the image that travels and the send-off scene: the name given at the door, else the first
 * word of the life's own name ("Adaeze"), else the scenario's `share.first-name`. Null with no life.
 */
export function bandName(scenario: string | null): string | null {
  const given = readPerson()?.name.trim() ?? "";
  if (given !== "") return given;
  if (scenario === null) return null;
  const first = hasWords(`${scenario}.name`) ? (words(`${scenario}.name`).trim().split(/\s+/)[0] ?? "") : "";
  if (first !== "") return first;
  const key = `share.first-name.${scenario}`;
  return hasWords(key) ? say(key) : null;
}

/** The name the player chose when the view carries one, else the name the band says. */
function nameFor(card: ShareCard, scenario: Id<"scenario"> | null): string | null {
  if (card.name !== undefined && card.name !== null && card.name.trim() !== "") return card.name.trim();
  return bandName(scenario);
}

function bodyOf(card: ShareCard): string | null {
  switch (card.kind) {
    case "send-off":
      return words("chapter.send-off.close");
    case "real-story":
      return hasWords("road.real-story.line") ? say("road.real-story.line") : say("ui.card.real-story.body");
    case "lost":
      return sayCount("ui.card.lost.body", card.months, { months: card.months });
    case "first-pay-abroad":
      return cardWords("share.first-pay-abroad.body");
    case "chapter":
    case "granted":
    case "secured":
    case "december":
    case "draw-win":
      return null;
    default: {
      const never: never = card.kind;
      throw new Error(`Unknown card kind: ${String(never)}`);
    }
  }
}

/**
 * R-ROAD-011 puts the credits on the real-story card, and R-SHARE-006 bars a
 * real institution's name from any card, so the card on screen lists the
 * credits and the image that travels leaves them off.
 */
function creditsOf(card: ShareCard): string[] {
  if (card.kind !== "real-story") return [];
  const credits: string[] = [];
  for (let number = 1; hasWords(`road.real-story.credit.${String(number)}`); number += 1) credits.push(say(`road.real-story.credit.${String(number)}`));
  return credits;
}

export function cardFace(card: ShareCard, scenario: Id<"scenario"> | null): CardFace {
  const story = STORY_KINDS.has(card.kind);
  const label = `share.${card.kind}.japacity`;
  return {
    kind: card.kind,
    shareable: card.kind !== "lost",
    kicker: say(`share.${card.kind}.kicker`),
    title: say(`share.${card.kind}.title`),
    chapter: card.kind === "chapter" && card.chapter !== undefined && card.chapter !== null ? nameOf(card.chapter) : null,
    name: story ? null : nameFor(card, scenario),
    route: story || card.route === null ? null : nameOf(card.route),
    percent: story || afterTheFlight(card) ? null : card.percent,
    percentLabel: say(hasWords(label) ? label : "share.japacity"),
    monthsLabel: say("share.months"),
    standingLabel: say("share.standing"),
    mostLabel: say("share.most"),
    stats: story ? null : { months: playedWords(card.months), standing: standingWords(card.standing) },
    most: story ? [] : card.topActivities.slice(0, MOST).map((id) => nameOf(id)),
    body: bodyOf(card),
    credits: creditsOf(card),
    art: artOf(card),
    sender: say("share.sender"),
    address: say("share.address"),
    officialLine: say("share.official-line"),
    disclaimer: say("share.disclaimer"),
  };
}

/** The link a shared card travels with: the game's address and the kind, nothing about the player (R-SHARE-010, R-SHARE-011). */
export function cardLink(kind: ShareKind): string {
  return `https://${say("share.address")}/?card=${kind}`;
}

