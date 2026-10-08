// Preset phrases between players: docs/rules/pair.md R-PAIR-010 to 013. The
// caller passes its own clock; nothing here reads one.
import type { ConversationRow, Content, PairRecord, PhraseEntry, PlayerView, Tuning } from "../engine/types";
import type { PairWrite, Side } from "./pair.events";
import { flip } from "./pair.logic";

/** A region's `interaction` setting (R-PAIR-018). */
export type Interaction = "none" | "invited" | "matched" | "free-text";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

/**
 * Why a phrase cannot go. Anything that turns on the other side (their block,
 * their region, a bond that has ended) is `not-possible` and nothing more.
 */
export type SayRefusal = "not-possible" | "blocked" | "too-many" | "region" | "not-here" | "wrong-place" | "bad-fill";

export type SayResult = { ok: true } | { ok: false; failed: SayRefusal };

/** What the server knows when a phrase is sent in a pair's conversation. */
export interface SayPolicy {
  /** Each side's region setting. */
  regions: { a: Interaction; b: Interaction };
  /** When the sender sent each earlier phrase in this conversation, on the caller's clock in milliseconds. */
  sent: number[];
  now: number;
  tuning: Tuning["pair"];
  /** The fill-ins open to the sender: `fillOptions`. */
  fills: string[];
}

/** What the server knows when a phrase is said aloud in a place. */
export interface PlacePolicy {
  /** The sender is in the place. */
  here: boolean;
  region: Interaction;
  /** When the sender said each earlier phrase in this place, on the caller's clock in milliseconds. */
  sent: number[];
  now: number;
  tuning: Tuning["pair"];
  fills: string[];
}

function sentWithin(sent: number[], now: number, span: number): number {
  return sent.filter((at) => at > now - span && at <= now).length;
}

function fillFits(phrase: PhraseEntry, fill: string | null, fills: string[]): boolean {
  if (phrase.fill === null) return fill === null;
  return fill !== null && fills.includes(fill);
}

const refuse = (failed: SayRefusal): SayResult => ({ ok: false, failed });

/**
 * Whether `from` may send `phrase` in the pair's conversation (R-PAIR-013):
 * connected, not blocked, within the hourly count, and both regions allow
 * phrases, in that order; then the phrase itself (R-PAIR-010, R-PAIR-012).
 */
export function canSay(record: PairRecord, from: Side, phrase: PhraseEntry, fill: string | null, policy: SayPolicy): SayResult {
  const them = flip(from);
  if (record.ended !== null || record[them] === "" || record[from] === "") return refuse("not-possible");
  if (record.blocked[them]) return refuse("not-possible");
  if (record.blocked[from]) return refuse("blocked");
  if (sentWithin(policy.sent, policy.now, HOUR_MS) >= policy.tuning.phrasesPerHour) return refuse("too-many");
  if (policy.regions[from] === "none") return refuse("region");
  if (policy.regions[them] === "none") return refuse("not-possible");
  if (phrase.where === "place") return refuse("wrong-place");
  if (!fillFits(phrase, fill, policy.fills)) return refuse("bad-fill");
  return { ok: true };
}

/** Whether a phrase may be said aloud in a place (R-PAIR-012, R-PAIR-013). Who hears it is `heardBy`. */
export function canSayInPlace(phrase: PhraseEntry, fill: string | null, policy: PlacePolicy): SayResult {
  if (!policy.here) return refuse("not-here");
  if (sentWithin(policy.sent, policy.now, MINUTE_MS) >= policy.tuning.placePhrasesPerMinute) return refuse("too-many");
  if (policy.region === "none") return refuse("region");
  if (phrase.where === "conversation") return refuse("wrong-place");
  if (!fillFits(phrase, fill, policy.fills)) return refuse("bad-fill");
  return { ok: true };
}

/**
 * Who hears a phrase said in a place: everyone there but the speaker, except
 * a region that shows no other players and anyone with a block either way
 * (R-PAIR-013, R-PAIR-015).
 */
export function heardBy(speaker: string, present: { id: string; region: Interaction }[], blocks: { from: string; to: string }[]): string[] {
  const blockedWith = (listener: string): boolean =>
    blocks.some((block) => (block.from === speaker && block.to === listener) || (block.from === listener && block.to === speaker));
  return present.filter((listener) => listener.id !== speaker && listener.region !== "none" && !blockedWith(listener.id)).map((listener) => listener.id);
}

/**
 * A phrase's fill-ins, from fixed lists only (R-PAIR-010): the shared spots, the
 * routes the sender has heard of, the news delivered to the sender, or the
 * entry's own options.
 */
export function fillOptions(phrase: PhraseEntry, content: Content, view: PlayerView): string[] {
  switch (phrase.fill) {
    case null:
      return [];
    case "spot":
      return [...content.people.spots];
    case "route":
      return view.routes.filter((route) => route.state !== "unknown").map((route) => route.id);
    case "news":
      return view.news.map((story) => story.id);
    case "event":
    case "thing":
      return [...(phrase.options ?? [])];
    default: {
      const never: never = phrase.fill;
      throw new Error(`Unknown fill ${String(never)}.`);
    }
  }
}

/**
 * The `said` moment a stored phrase appends to the record (R-PAIR-011), to be
 * written from the sender's side. The fill is kept as the spot only when it is one.
 */
export function saidMoment(row: ConversationRow, phrase: PhraseEntry, tick: number): PairWrite {
  if (row.phrase !== phrase.id) throw new Error(`The row says ${row.phrase}, not ${phrase.id}.`);
  return { type: "pair/moment-added", kind: "said", spot: phrase.fill === "spot" ? row.fill : null, what: phrase.id, tick };
}
