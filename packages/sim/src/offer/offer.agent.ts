// The agent family: docs/rules/advice.md R-ADVICE-005 to 012. An agent is an
// offer whose kind (fixer, overpromiser, scammer) is drawn when it opens. The
// kind fixes the tells he carries; one shows at once and the looks find the
// rest. Nothing here reads money to decide who appears or what he is.
import { BP_WHOLE, divFloor } from "../engine/int";
import type { Content, Ctx, Id, OfferEntry, OfferState, ReadCtx, Requirement, RouteEntry, Terms, Tuning } from "../engine/types";

export type AgentKind = "fixer" | "overpromiser" | "scammer";

/** Every entry of the family, the agents and what they open, has an id that starts with this. */
export const AGENT_PREFIX = "offer.agent-";
/** What an overpromiser leaves on the table: his promise, which lapses in the month he named. */
export const PROMISE: Id<"offer"> = "offer.agent-promise";
/** What a scammer offers after the fee: fake papers. */
export const PAPERS: Id<"offer"> = "offer.agent-papers";
/**
 * The term that keeps the kind. the contract's `secret` holds only
 * `fraud`, so the kind rides as a term the view leaves out (R-ENGINE-007).
 */
export const KIND_TERM = "kind";
/** Terms an effect may hand an agent's follow-up offers: who he is and the route he looked at. */
const HANDED_TERMS = ["agent", "route"] as const;

/** The three free looks on an agent's sheet, and the tells each one finds (R-ADVICE-006). */
export const LOOKS = ["look-office", "look-licence", "look-name"] as const;
export type Look = (typeof LOOKS)[number];
export const LOOK_FINDS: Record<Look, readonly string[]> = {
  "look-office": ["no-office"],
  "look-licence": ["no-licence"],
  "look-name": ["cash-only", "guarantee", "holds-passport", "price-low", "pay-today"],
};
/** The sign a friend's warning adds: "sounds like the one your friend warned about" (R-ADVICE-011). */
export const WARNED = "friend-warned";
/**
 * R-ADVICE-011 is the online milestone's: off until then, with its tests
 * running through the switch. a constant until the tuning carries a
 * switch; `tuning.advice.warnings`.
 */
export const WARNINGS_ON = false;

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
export function hasDesk(entry: OfferEntry): boolean {
  return entry.fraudBp === 0;
}

/** R-ADVICE-005: the kind from one draw out of 10000 at the tuning's shares, fixer first. */
export function kindAt(draw: number, shares: Tuning["advice"]["agentKindsBp"]): AgentKind {
  if (draw < shares.fixer) return "fixer";
  if (draw < shares.fixer + shares.overpromiser) return "overpromiser";
  return "scammer";
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
    case "fixer":
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
  if (kind !== "fixer" && kind !== "overpromiser" && kind !== "scammer") throw new Error(`${item.id} is an agent with no kind.`);
  return kind;
}

/** The tells a look finds on this agent: every one it would find, always (R-ADVICE-006). */
export function lookFinds(entry: OfferEntry, item: OfferState, look: Look, advice: Tuning["advice"]): string[] {
  return carriedTells(entry, kindOf(item), advice).filter((key) => LOOK_FINDS[look].includes(key));
}

/** The tells the player has seen on this offer: its signs, less the marks of looks done and of a warning. */
export function tellsSeen(item: OfferState): string[] {
  return item.signs.filter((key) => !isLook(key) && key !== WARNED);
}

// ---------------------------------------------------------------------------
// The warning: R-ADVICE-011, offline side only
// ---------------------------------------------------------------------------

/** What a warning carries: facts, never a name. The month is the moment's tick. */
export interface Warning {
  place: string;
  promise: string;
  tells: string[];
}

const WARNING_HEAD = "warning";

/** The warning as the `what` a pair's moment carries. */
export function warningWhat(warning: Warning): string {
  return [WARNING_HEAD, warning.place, warning.promise, [...warning.tells].sort().join("+")].join("|");
}

export function readWarning(what: string): Warning | null {
  const [head, place, promise, tells] = what.split("|");
  if (head !== WARNING_HEAD || place === undefined || promise === undefined || tells === undefined) return null;
  return { place, promise, tells: tells === "" ? [] : tells.split("+") };
}

/** The place that stages an agent entry, or null. */
export function placeOf(content: Content, entry: Id<"offer">): string | null {
  return Object.values(content.place).find((place) => place.stages.includes(entry))?.id ?? null;
}

/**
 * R-ADVICE-011: a warning from a bond matches an agent at the same place
 * carrying the same tells, while it is under `warnMonths` old. Off unless
 * `on`: offline there is no friend to warn.
 */
export function warned(read: ReadCtx, entry: OfferEntry, carried: readonly string[], on: boolean): boolean {
  if (!on || carried.length === 0) return false;
  const place = placeOf(read.content, entry.id);
  const same = [...carried].sort().join("+");
  return Object.values(read.state.people.bonds).some((bond) =>
    bond.moments.some((moment) => {
      const warning = readWarning(moment.what);
      if (warning === null || warning.place !== place) return false;
      return read.world.tick - moment.tick < read.content.tuning.advice.warnMonths && [...warning.tells].sort().join("+") === same;
    }),
  );
}

// ---------------------------------------------------------------------------
// Opening an agent: R-ADVICE-005, 006
// ---------------------------------------------------------------------------

/**
 * The agent's version of the route's checklist, as item ids joined by commas
 * (R-ADVICE-005): a fixer's is true; an overpromiser's or a scammer's leaves
 * out the heaviest item, the first on a tie, so it understates.
 */
export function agentChecklist(route: RouteEntry | undefined, kind: AgentKind): string {
  if (route === undefined) return "";
  const items = route.checklist.map((item) => item.id);
  if (kind === "fixer" || route.checklist.length === 0) return items.join(",");
  const heaviest = route.checklist.reduce((best, item) => (item.weight > best.weight ? item : best));
  return items.filter((id) => id !== heaviest.id).join(",");
}

/**
 * R-ADVICE-010: who stands there this time, as the text key whose `.name`
 * carries his name: `<entry>.who.<n>`, `n` drawn by the entry's term `who`.
 */
export function agentName(entry: OfferEntry, own: Terms): string {
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
 * Opens an agent (R-ADVICE-005, 006): the kind on `offer`, then the fee from
 * the kind's range on `offer` in whole thousands, then the tells. One tell
 * shows at once: the first he carries. A friend's warning uncovers them all.
 */
export function openAgent(ctx: Ctx, entry: OfferEntry, own: Terms, extra: Terms): OfferState {
  const advice = ctx.content.tuning.advice;
  const drawn = kindAt(ctx.random.int("offer", BP_WHOLE), advice.agentKindsBp);
  const kind: AgentKind = hasDesk(entry) ? "fixer" : drawn;
  const [min, max] = advice.fees[kind];
  const fee = min + FEE_STEP * ctx.random.between("offer", 0, divFloor(max - min, FEE_STEP));
  const carried = carriedTells(entry, kind, advice);
  const read: ReadCtx = { state: ctx.state, world: ctx.world, content: ctx.content };
  const signs = warned(read, entry, carried, WARNINGS_ON) ? [...carried, WARNED] : carried.slice(0, 1);
  const route = typeof extra["route"] === "string" ? ctx.content.route[extra["route"] as Id<"route">] : undefined;
  const month = ctx.state.turn.month;
  return {
    id: ctx.nextId("offer"),
    entry: entry.id,
    openedMonth: month,
    expiresMonth: month + entry.expiresAfter,
    terms: { ...own, ...extra, agent: agentName(entry, own), fee, says: agentChecklist(route, kind), [KIND_TERM]: kind },
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
  const findable = new Set<string>([...Object.values(LOOK_FINDS).flat(), WARNED]);
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
    if (!hasDesk(entry) && carriedTells(entry, "scammer", advice).length < advice.scamTells) problems.push(`${entry.id}: a scammer carries fewer than ${String(advice.scamTells)} tells (R-ADVICE-006).`);
    if (!hasDesk(entry) && carriedTells(entry, "overpromiser", advice).length < advice.overpromiseTells) problems.push(`${entry.id}: an overpromiser carries too few tells (R-ADVICE-006).`);
    for (const sign of entry.signs) {
      if (!findable.has(sign.key)) problems.push(`${entry.id}: no look finds the tell ${sign.key} (R-ADVICE-006).`);
    }
    for (const look of LOOKS) {
      if (!entry.choices.some((choice) => choice.id === look)) problems.push(`${entry.id}: has no ${look} (R-ADVICE-006).`);
    }
  }
  return problems;
}
