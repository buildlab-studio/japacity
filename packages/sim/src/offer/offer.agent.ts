// The agent family: docs/rules/advice.md R-ADVICE-005 to 013. An agent is an
// offer whose kind (fixer, chaser, overpromiser, scammer) is drawn when it
// opens. The kind fixes the tells he carries; one shows at once and the looks
// find the rest. Nothing here reads money to decide who appears or what he is.
import { beingMade } from "../document/document.logic";
import { BP_WHOLE, divFloor } from "../engine/int";
import type { Content, Ctx, Id, OfferEntry, OfferState, Requirement, RouteEntry, State, Terms, Tuning } from "../engine/types";

/** R-ADVICE-005, 013: the four kinds, in the order the draw takes them. */
export const AGENT_KINDS = ["fixer", "chaser", "overpromiser", "scammer"] as const;
export type AgentKind = (typeof AGENT_KINDS)[number];

/**
 * R-ADVICE-013: what an agent says he does. The insider moves a paper's date
 * himself (the fixer's way); the chaser follows it up for you. An honest agent
 * says what he is; the others say one or the other.
 */
export type Pitch = "insider" | "chaser";

/** Every entry of the family, the agents and what they open, has an id that starts with this. */
const AGENT_PREFIX = "offer.agent-";
/** What an overpromiser leaves on the table: his promise, which lapses in the month he named. */
export const PROMISE: Id<"offer"> = "offer.agent-promise";
/** What a scammer offers after the fee: fake papers. */
export const PAPERS: Id<"offer"> = "offer.agent-papers";
/** R-ADVICE-013: the chaser a friend puts the player onto. Always a chaser. */
export const CHASER: Id<"offer"> = "offer.agent-chaser";
/** R-ADVICE-013: the papers a chaser follows up. The fixer moves any paper. */
export const CHASED: readonly Id<"document">[] = ["document.transcript", "document.police-certificate", "document.tb-certificate"];
/**
 * The term that keeps the kind. the contract's `secret` holds only
 * `fraud`, so the kind rides as a term the view leaves out (R-ENGINE-007).
 */
export const KIND_TERM = "kind";
/** R-ADVICE-013: the terms the sheet reads: what he says he does, the paper he would move ("" for none) and by how many months. */
export const PITCH_TERM = "pitch";
export const PAPER_TERM = "paper";
export const MONTHS_TERM = "months";
/** Terms an effect may hand an agent's follow-up offers: who he is and the route he looked at. */
const HANDED_TERMS = ["agent", "route"] as const;

/** The three free looks on an agent's sheet, and the tells each one finds (R-ADVICE-006). */
export const LOOKS = ["look-office", "look-licence", "look-name"] as const;
export type Look = (typeof LOOKS)[number];
export const LOOK_FINDS: Record<Look, readonly string[]> = {
  "look-office": ["no-office"],
  "look-licence": ["no-licence"],
  "look-name": ["cash-only", "guarantee", "holds-passport", "no-passport", "price-low", "pay-today"],
};

/** Steps a fee is drawn in: ₦1,000, in kobo. */
const FEE_STEP = 100000;

export function inFamily(id: string): boolean {
  return id.startsWith(AGENT_PREFIX);
}

/** An agent who stands in a place, as opposed to the promise and the papers he leaves behind. */
export function standsAsAgent(entry: OfferEntry): boolean {
  return inFamily(entry.id) && entry.id !== PROMISE && entry.id !== PAPERS;
}

export function isLook(id: string): id is Look {
  return (LOOKS as readonly string[]).includes(id);
}

/**
 * R-ADVICE-010: an agent entry with no scammer share (`fraudBp` 0) is a desk
 * in the agent's office, which only a fixer keeps. Its kind is still drawn so
 * the stream moves the same way.
 */
function hasDesk(entry: OfferEntry): boolean {
  return entry.fraudBp === 0;
}

/**
 * The kind an entry always is, whatever the draw: the friend's chaser
 * (R-ADVICE-013) and the desk upstairs (R-ADVICE-010). Null for the stop,
 * where the draw decides.
 */
function fixedKind(entry: OfferEntry): AgentKind | null {
  if (entry.id === CHASER) return "chaser";
  return hasDesk(entry) ? "fixer" : null;
}

type Shares = Tuning["advice"]["agentKindsBp"];

/** Where each kind's band starts in the draw, in AGENT_KINDS order. */
function bandStart(kind: AgentKind, shares: Shares): number {
  let start = 0;
  for (const each of AGENT_KINDS) {
    if (each === kind) return start;
    start += shares[each];
  }
  return start;
}

/** R-ADVICE-005, 013: the kind from one draw out of 10000 at the tuning's shares, fixer first, then the chaser. */
export function kindAt(draw: number, shares: Shares): AgentKind {
  for (const kind of AGENT_KINDS) if (draw < bandStart(kind, shares) + shares[kind]) return kind;
  return "scammer";
}

/**
 * R-ADVICE-013: what the agent says he does, from the same draw as his kind,
 * so no draw is added. An honest agent says what he is. An overpromiser or a
 * scammer says insider or chaser in the proportion the honest kinds come in:
 * the first part of his band in the fixer's share says insider, the rest
 * chaser. So the claim never tells who is honest.
 */
export function pitchAt(draw: number, shares: Shares): Pitch {
  const kind = kindAt(draw, shares);
  switch (kind) {
    case "fixer":
      return "insider";
    case "chaser":
      return "chaser";
    case "overpromiser":
    case "scammer": {
      const offset = draw - bandStart(kind, shares);
      return offset * (shares.fixer + shares.chaser) < shares[kind] * shares.fixer ? "insider" : "chaser";
    }
    default: {
      const never: never = kind;
      throw new Error(`Unknown agent kind ${String(never)}.`);
    }
  }
}

/** R-ADVICE-005, 013: the range a kind's fee is drawn from. The chaser's is his own, cheaper one. */
export function feeRange(kind: AgentKind, advice: Tuning["advice"]): readonly [number, number] {
  return kind === "chaser" ? advice.chaserFee : advice.fees[kind];
}

/** R-ADVICE-005, 013: months a paper comes sooner for what he says he does: the insider's two, the chaser's one. */
export function pitchMonths(pitch: Pitch, advice: Tuning["advice"]): number {
  return pitch === "insider" ? advice.fixerMonths : advice.chaserMonths;
}

/**
 * R-ADVICE-005, 013: the paper being made that is due first, in content order
 * on a tie: what an insider brings forward. A chaser follows up only the
 * papers in CHASED.
 */
export function paperToMove(state: State, content: Content, pitch: Pitch): Id<"document"> | null {
  let best: { id: Id<"document">; due: number } | null = null;
  for (const id of Object.keys(content.document) as Id<"document">[]) {
    if (pitch === "chaser" && !CHASED.includes(id)) continue;
    const doc = state.document[id];
    const due = doc === undefined ? null : beingMade(doc);
    if (due !== null && (best === null || due < best.due)) best = { id, due };
  }
  return best?.id ?? null;
}

/**
 * R-ADVICE-006: the tells the kind carries, in the entry's order. A fixer
 * carries the signs marked for an honest agent (at most one); a scammer the
 * signs marked for a fraud; an overpromiser the fixer's and the first
 * `overpromiseTells` of the scammer's that a fixer does not carry. A sign is
 * marked by a chance of 10000; the agent family draws no chance on its signs.
 */
export function carriedTells(entry: OfferEntry, kind: AgentKind, advice: Tuning["advice"]): string[] {
  const honest = entry.signs.filter((sign) => sign.honestBp === BP_WHOLE).map((sign) => sign.key);
  const fraud = entry.signs.filter((sign) => sign.fraudBp === BP_WHOLE).map((sign) => sign.key);
  switch (kind) {
    // R-ADVICE-013: the chaser's signs are the fixer's.
    case "fixer":
    case "chaser":
      return honest;
    case "scammer":
      return fraud;
    case "overpromiser": {
      const more = fraud.filter((key) => !honest.includes(key)).slice(0, advice.overpromiseTells);
      return entry.signs.map((sign) => sign.key).filter((key) => honest.includes(key) || more.includes(key));
    }
    default: {
      const never: never = kind;
      throw new Error(`Unknown agent kind ${String(never)}.`);
    }
  }
}

export function kindOf(item: OfferState): AgentKind {
  const kind = item.terms[KIND_TERM];
  const found = AGENT_KINDS.find((each) => each === kind);
  if (found === undefined) throw new Error(`${item.id} is an agent with no kind.`);
  return found;
}

/** The tells a look finds on this agent: every one it would find, always (R-ADVICE-006). */
export function lookFinds(entry: OfferEntry, item: OfferState, look: Look, advice: Tuning["advice"]): string[] {
  return carriedTells(entry, kindOf(item), advice).filter((key) => LOOK_FINDS[look].includes(key));
}

/** The tells the player has seen on this offer: its signs, less the marks of looks done. */
export function tellsSeen(item: OfferState): string[] {
  return item.signs.filter((key) => !isLook(key));
}

// ---------------------------------------------------------------------------
// Opening an agent: R-ADVICE-005, 006
// ---------------------------------------------------------------------------

/**
 * The agent's version of the route's checklist, as item ids joined by commas
 * (R-ADVICE-005): a fixer's is true; an overpromiser's or a scammer's leaves
 * out the heaviest item, the first on a tie, so it understates.
 */
function agentChecklist(route: RouteEntry | undefined, kind: AgentKind): string {
  if (route === undefined) return "";
  const items = route.checklist.map((item) => item.id);
  if (kind === "fixer" || kind === "chaser" || route.checklist.length === 0) return items.join(",");
  const heaviest = route.checklist.reduce((best, item) => (item.weight > best.weight ? item : best));
  return items.filter((id) => id !== heaviest.id).join(",");
}

/**
 * R-ADVICE-010: who stands there this time, as the text key whose `.name`
 * carries his name: `<entry>.who.<n>`, `n` drawn by the entry's term `who`.
 */
function agentName(entry: OfferEntry, own: Terms): string {
  const who = own["who"];
  return typeof who === "number" ? `${entry.id}.who.${String(who)}` : entry.id;
}

/** Only who he is and the route he looked at pass to an agent's next offer, never his kind or his fee. */
export function handedTerms(entry: OfferEntry, terms: Terms): Terms {
  if (!inFamily(entry.id)) return terms;
  const handed: Terms = {};
  for (const name of HANDED_TERMS) {
    const value = terms[name];
    if (value !== undefined) handed[name] = value;
  }
  return handed;
}

/**
 * Opens an agent (R-ADVICE-005, 006, 013): the kind on `offer`, then the fee
 * from the kind's range on `offer` in whole thousands, then the tells. One
 * tell shows at once: the first he carries. What he says he does comes from
 * the kind's draw, and the paper he names is the one he would move now.
 */
export function openAgent(ctx: Ctx, entry: OfferEntry, own: Terms, extra: Terms): OfferState {
  const advice = ctx.content.tuning.advice;
  const draw = ctx.random.int("offer", BP_WHOLE);
  const fixed = fixedKind(entry);
  const kind: AgentKind = fixed ?? kindAt(draw, advice.agentKindsBp);
  const pitch: Pitch = fixed === null ? pitchAt(draw, advice.agentKindsBp) : fixed === "chaser" ? "chaser" : "insider";
  const [min, max] = feeRange(kind, advice);
  const fee = min + FEE_STEP * ctx.random.between("offer", 0, divFloor(max - min, FEE_STEP));
  const paper = paperToMove(ctx.state, ctx.content, pitch);
  const carried = carriedTells(entry, kind, advice);
  const signs = carried.slice(0, 1);
  const route = typeof extra["route"] === "string" ? ctx.content.route[extra["route"] as Id<"route">] : undefined;
  const month = ctx.state.turn.month;
  return {
    id: ctx.nextId("offer"),
    entry: entry.id,
    openedMonth: month,
    expiresMonth: month + entry.expiresAfter,
    terms: {
      ...own,
      ...extra,
      agent: agentName(entry, own),
      fee,
      says: agentChecklist(route, kind),
      [PITCH_TERM]: pitch,
      [PAPER_TERM]: paper ?? "",
      [MONTHS_TERM]: pitchMonths(pitch, advice),
      [KIND_TERM]: kind,
    },
    signs,
    secret: { fraud: kind === "scammer" },
  };
}

/** The terms the view shows: all but the kind (R-ENGINE-007). */
export function shownTerms(terms: Terms): Terms {
  const shown: Terms = { ...terms };
  delete shown[KIND_TERM];
  return shown;
}

// ---------------------------------------------------------------------------
// The content check: R-ADVICE-006, 007, 012
// ---------------------------------------------------------------------------

/** Requirement types an agent's `when` may read: routes, documents, the place and the chapter (R-ADVICE-007). */
const AGENT_READS: readonly string[] = ["route/", "document/", "place/is", "chapter/done"];
const MONEY: readonly Requirement["type"][] = ["money/min", "money/can-pay", "wallet/total"];
const FIRST_CHAPTER: Id<"chapter"> = "chapter.find-your-feet";

function flatten(requirements: readonly Requirement[]): Requirement[] {
  return requirements.flatMap((requirement): Requirement[] => {
    if (requirement.type === "not") return flatten([requirement.of]);
    if (requirement.type === "any") return flatten(requirement.of);
    return [requirement];
  });
}

/** R-ADVICE-007: true when an agent entry's `when` reads money, directly or inside `not` or `any`. */
export function agentReadsMoney(entry: OfferEntry): boolean {
  return inFamily(entry.id) && flatten(entry.when).some((requirement) => MONEY.includes(requirement.type));
}

/** Problems with the agent family in content. Empty when it holds. For `checkContent`. */
export function agentProblems(content: Content): string[] {
  const problems: string[] = [];
  const advice = content.tuning.advice;
  const findable = new Set<string>(Object.values(LOOK_FINDS).flat());
  for (const entry of Object.values(content.offer)) {
    if (!inFamily(entry.id)) continue;
    if (agentReadsMoney(entry)) problems.push(`${entry.id}: an agent's when reads money (R-ADVICE-007).`);
    for (const requirement of flatten(entry.when)) {
      if (!AGENT_READS.some((prefix) => requirement.type.startsWith(prefix))) problems.push(`${entry.id}: an agent's when reads ${requirement.type} (R-ADVICE-007).`);
    }
    if (!standsAsAgent(entry)) continue;
    if (!entry.when.some((requirement) => requirement.type === "chapter/done" && requirement.chapter === FIRST_CHAPTER)) {
      problems.push(`${entry.id}: opens before ${FIRST_CHAPTER} is done (R-ADVICE-012).`);
    }
    if (carriedTells(entry, "fixer", advice).length > 1) problems.push(`${entry.id}: a fixer carries more than one tell (R-ADVICE-006).`);
    if (fixedKind(entry) === null && carriedTells(entry, "scammer", advice).length < advice.scamTells) problems.push(`${entry.id}: a scammer carries fewer than ${String(advice.scamTells)} tells (R-ADVICE-006).`);
    if (fixedKind(entry) === null && carriedTells(entry, "overpromiser", advice).length < advice.overpromiseTells) problems.push(`${entry.id}: an overpromiser carries too few tells (R-ADVICE-006).`);
    for (const sign of entry.signs) {
      if (!findable.has(sign.key)) problems.push(`${entry.id}: no look finds the tell ${sign.key} (R-ADVICE-006).`);
    }
    for (const look of LOOKS) {
      if (!entry.choices.some((choice) => choice.id === look)) problems.push(`${entry.id}: has no ${look} (R-ADVICE-006).`);
    }
  }
  return problems;
}
