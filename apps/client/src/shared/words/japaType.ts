// The japa type (decision 0024; share:cards-due-at-set-moments, share:card-contents): one of six labels read
// from the view when the send-off card is due, never a number and never money as a sum. It changes
// nothing in the simulation; it is a label for the stub, the type card and the data page.
import { content, type JapaType } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";

import { say } from "./text";

const STANDING: Id<"quality"> = "quality.standing";

/** The kiosk's two acts: the lotto and the bet slip. */
const KIOSK: ReadonlySet<Id<"activity">> = new Set(["activity.play-lotto", "activity.bet-slip"]);

/** The agents' doors: the stop and the office. */
const AGENT_VISITS: ReadonlySet<Id<"activity">> = new Set(["activity.see-agent-stop", "activity.see-agent-office"]);

/** What an agent paid leaves open: the debt owed to one, or funds one holds. */
const AGENT_OBLIGATIONS: ReadonlySet<Id<"obligation">> = new Set(["obligation.agent-debt", "obligation.held-funds-agent"]);

/** Time given to the family at home or from abroad. */
const FAMILY: ReadonlySet<Id<"activity">> = new Set(["activity.family-time", "activity.family-meeting", "activity.call-home", "activity.send-money", "activity.december-home-uk", "activity.december-home-ca", "activity.december-home-uae"]);

/** The skills a study act builds; an act that pays or meets people is not study. */
const STUDY_QUALITIES: ReadonlySet<string> = new Set(["quality.english", "quality.tech", "quality.portfolio", "quality.interview-prep"]);

function isStudy(id: Id<"activity">): boolean {
  const entry = content.activity[id];
  if (entry === undefined || entry.slot !== "free" || entry.pay !== null) return false;
  if (id === "activity.masters-at-home") return true;
  const adds = entry.effects.flatMap((effect) => (effect.type === "quality/add" ? [effect.quality as string] : []));
  return adds.some((quality) => STUDY_QUALITIES.has(quality)) && !adds.includes("quality.network");
}

/** The top band of a quality's range, as the screen's band words cut it (quarters, text:bands-not-figures). */
function inTopBand(quality: Id<"quality">, value: number): boolean {
  const entry = content.quality[quality];
  if (entry === undefined) return false;
  const span = entry.max - entry.min + 1;
  return Math.floor(((value - entry.min) * 4) / span) >= 3;
}

/** At least two thirds of the months played were kept (decision 0024): a count of months, never money. */
function keptMost(kept: number, months: number): boolean {
  return months > 0 && kept * 3 >= months * 2;
}

/**
 * The risks taken, each counted once (decision 0024: the road's pitch, agents paid, the kiosk). The road
 * is never in the routes view (road:road-route-has-no-figure), so its pitch shows only as a return from the road.
 */
function risksTaken(view: PlayerView, most: readonly Id<"activity">[]): number {
  const road = view.place.returns.some((back) => back.country === null);
  const agent = view.obligations.some((owed) => AGENT_OBLIGATIONS.has(owed.entry)) || most.some((id) => AGENT_VISITS.has(id));
  const kiosk = most.some((id) => KIOSK.has(id)) || (view.lottery?.tickets ?? 0) > 0;
  return [road, agent, kiosk].filter(Boolean).length;
}

/**
 * The type, when the send-off card is due, else null. The first reading that holds wins, the rarest and
 * most telling first:
 * 1. The Long Way Round: a return home in the record, and still going.
 * 2. The Gambler: two of the three risks.
 * 3. The Family Anchor: standing at the top of its range, or in its top band with family among the things done most.
 * 4. The Long Way Round: the way taken was refused before it was granted.
 * 5. The Night Reader: study first, a study act first among the things done most, or the study way with one among them.
 * 6. The Careful Saver: the months kept at least two thirds of the months played (decision 0024), a side job or not.
 * 7. The Hustler: everything else; work beside the job, or a life that worked its way out.
 */
export function japaTypeOf(view: PlayerView): JapaType | null {
  const card = view.card;
  if (card === null || card.kind !== "send-off") return null;
  const most = card.topActivities;
  if (view.place.returns.length > 0) return "long-way-round";
  if (risksTaken(view, most) >= 2) return "gambler";
  const standing = content.quality[STANDING];
  if (standing !== undefined && (card.standing >= standing.max || (inTopBand(STANDING, card.standing) && most.some((id) => FAMILY.has(id))))) return "family-anchor";
  const way = card.route ?? view.plan.route;
  if (way !== null && (view.routes.find((route) => route.id === way)?.refusals ?? 0) > 0) return "long-way-round";
  const studyWay = way !== null && content.route[way]?.gate === "study";
  if ((most[0] !== undefined && isStudy(most[0])) || (studyWay && most.some(isStudy))) return "night-reader";
  if (keptMost(view.keptMonths, card.months)) return "careful-saver";
  return "hustler";
}

/** The type's name and its one line, from content. */
export function typeWords(type: JapaType): { name: string; line: string } {
  return { name: say(`share.type.${type}.name`), line: say(`share.type.${type}.line`) };
}
