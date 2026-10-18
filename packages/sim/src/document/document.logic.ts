// Documents: docs/rules/document.md. A document waits in an office, is issued,
// and usually runs out.
//
// The contract keeps one DocumentState per document, so a new copy
// being made while an old one is held (R-DOCUMENT-004) is written as
// `state: "held"` with the held copy's `expiresMonth` and `value`, and
// `readyMonth` set to the month the new copy is due. A held document with no
// copy being made has `readyMonth` null.
import { worldVarOr } from "../engine/check";
import { clamp, mulDiv, roundDownTo } from "../engine/int";
import type { RegisteredKind } from "../engine/kind";
import { turnInProgress } from "../engine/kind";
import type {
  BaseEvent,
  Cause,
  Content,
  Ctx,
  DocumentEntry,
  DocumentSlice,
  DocumentState,
  Effect,
  Id,
  ReadCtx,
  ReportLine,
  Requirement,
  RequirementResult,
  Tuning,
} from "../engine/types";
import { passportHeldByEmployer } from "../status/status.logic";
import type { DocumentEvent } from "./document.events";

const ENGLISH = "quality.english";
const PASSPORT: Id<"document"> = "document.passport";
const TRANSCRIPT: Id<"document"> = "document.transcript";
/** director.md: months the strike adds to the transcript's wait. */
const TRANSCRIPT_EXTRA: Id<"var"> = "var.transcript-wait-extra";

/** English points the per-hundred figure is counted against. */
const ENGLISH_PER = 100;

function entryOf(content: Content, id: Id<"document">): DocumentEntry {
  const entry = content.document[id];
  if (entry === undefined) throw new Error(`The content has no document ${id}.`);
  return entry;
}

/** The month a copy now being made is due, or null when none is. */
export function beingMade(doc: DocumentState): number | null {
  switch (doc.state) {
    case "pending":
      return doc.readyMonth;
    case "held":
      return doc.readyMonth;
    case "expired":
      return null;
    default: {
      const never: never = doc.state;
      throw new Error(`Unknown document state ${String(never)}.`);
    }
  }
}

/**
 * Held and in date (R-DOCUMENT-003). A copy whose expiry month has come no
 * longer counts, even in the phases of that month before `papers` marks it.
 */
function inForce(doc: DocumentState | undefined, month: number): doc is DocumentState {
  return doc !== undefined && doc.state === "held" && (doc.expiresMonth === null || doc.expiresMonth > month);
}

/**
 * The English band (R-DOCUMENT-005): the base, plus the per-hundred figure for
 * every 100 points of English rounded down, plus the drawn band steps, moved
 * down to a step and kept in range. `steps` is the draw, from -noiseSteps to
 * noiseSteps.
 */
export function englishBand(english: number, numbers: Tuning["english"], steps: number): number {
  const raw = numbers.base + mulDiv(numbers.perHundred, english, ENGLISH_PER) + steps * numbers.bandStep;
  return clamp(roundDownTo(raw, numbers.bandStep), numbers.min, numbers.max);
}

/** The value a document takes when issued. Draws on `test` for the English band. */
function valueOnIssue(ctx: Ctx, entry: DocumentEntry): number | null {
  switch (entry.result) {
    case null:
      return null;
    case "english-band": {
      const english = ctx.state.quality[ENGLISH];
      if (english === undefined) throw new Error(`The state has no ${ENGLISH} to set the band from.`);
      const { noiseSteps } = ctx.content.tuning.english;
      return englishBand(english, ctx.content.tuning.english, ctx.random.between("test", -noiseSteps, noiseSteps));
    }
    default: {
      const never: never = entry.result;
      throw new Error(`Unknown document result ${String(never)}.`);
    }
  }
}

/** The route states that mean an application was sent (R-ROUTE-014). */
const SENT: readonly string[] = ["applying", "granted", "departed"];

/**
 * R-ADVICE-008: a fake paper counts as used once an application rests on it:
 * a route whose checklist asks for the paper has been sent, or was refused
 * for the agent's papers. The record keeps no month of use, so a
 * route's state and its last refusal are what show the use.
 */
function usedInApplication(read: ReadCtx, id: Id<"document">): boolean {
  return Object.values(read.content.route).some((route) => {
    if (!route.checklist.some((item) => item.requirement.type === "document/held" && item.requirement.document === id)) return false;
    const held = read.state.route[route.id];
    if (held === undefined) return false;
    return SENT.includes(held.state) || (held.lastRefusal?.reasons.includes("agent") ?? false);
  });
}

/** Issue a copy now: held from this month, running out `validMonths` later (R-DOCUMENT-002). */
function issue(ctx: Ctx, id: Id<"document">): DocumentEvent {
  const entry = entryOf(ctx.content, id);
  const month = ctx.state.turn.month;
  const event: DocumentEvent = {
    type: "document/issued",
    document: id,
    expiresMonth: entry.validMonths === null ? null : month + entry.validMonths,
    value: valueOnIssue(ctx, entry),
  };
  // R-ADVICE-008: the mark of a fake once used stays on the record for the life.
  return ctx.state.document[id]?.genuine === false && usedInApplication(ctx, id) ? { ...event, genuine: false } : event;
}

/** The term a fixer's request carries: months to bring the copy being made forward (R-ADVICE-005). */
export const HASTEN_TERM = "hasten";
/** The term fake papers carry on their grant (R-ADVICE-008). */
const FAKE_TERM = "fake";

/**
 * R-ADVICE-005: a fixer brings the copy being made forward. The
 * contract has no effect for this, so it is read as a request for a paper
 * already being made that carries the term `hasten`. Never earlier than the
 * earliest a request at this moment could be issued.
 */
function hasten(ctx: Ctx, id: Id<"document">, due: number, months: number): DocumentEvent {
  const month = ctx.state.turn.month;
  const earliest = turnInProgress(ctx) === null ? month + 1 : month;
  return { type: "document/hastened", document: id, readyMonth: Math.max(earliest, due - months), was: due };
}

/** R-DOCUMENT-001, R-DOCUMENT-004. */
function request(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "document/request") throw new Error(`The document kind cannot request from ${effect.type}.`);
  const id = effect.document;
  const entry = entryOf(ctx.content, id);
  const doc = ctx.state.document[id];
  const due = doc === undefined ? null : beingMade(doc);
  const months = cause.terms[HASTEN_TERM];
  if (due !== null && typeof months === "number") return [hasten(ctx, id, due, months)];
  if (due !== null) {
    // A second request changes nothing, yet the report says so, and a line
    // comes only from an event: this one event changes nothing and carries the
    // line. The activity's
    // fee is already paid by then; that is the activity kind's business.
    const event: DocumentEvent = { type: "document/already-pending", document: id, readyMonth: due };
    return [event];
  }
  const month = ctx.state.turn.month;
  // director.md: the lecturers' strike adds its months to the transcript's wait while in force.
  const extra = id === TRANSCRIPT ? worldVarOr(ctx.world, TRANSCRIPT_EXTRA) : 0;
  const wait = ctx.random.between("document", entry.wait[0], entry.wait[1]) + extra;
  // R-DOCUMENT-002: a request between turns, as from an offer, comes after
  // this month's papers phase, so the earliest it can be issued is next
  // month's. Inside a turn it is this month's, so a wait of zero from a slot
  // is issued in the same turn.
  const earliest = turnInProgress(ctx) === null ? month + 1 : month;
  const event: DocumentEvent = { type: "document/requested", document: id, readyMonth: Math.max(month + wait, earliest) };
  return [event];
}

/**
 * R-DOCUMENT-006. A grant replaces whatever is there, so a copy being
 * made is the one issued, and the English test draws its band as on any issue.
 */
function grant(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "document/grant") throw new Error(`The document kind cannot grant from ${effect.type}.`);
  // R-ADVICE-008. The contract has no effect for fake papers, so a grant whose cause carries the term `fake` makes one.
  if (cause.terms[FAKE_TERM] === 1) {
    const entry = entryOf(ctx.content, effect.document);
    const event: DocumentEvent = { type: "document/faked", document: effect.document, expiresMonth: entry.validMonths === null ? null : ctx.state.turn.month + entry.validMonths };
    return [event];
  }
  return [issue(ctx, effect.document)];
}

/** R-DOCUMENT-006. Voiding what is not there does nothing. */
function voidDocument(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "document/void") throw new Error(`The document kind cannot void from ${effect.type}.`);
  if (ctx.state.document[effect.document] === undefined) return [];
  const event: DocumentEvent = { type: "document/voided", document: effect.document };
  return [event];
}

/**
 * R-DOCUMENT-002, R-DOCUMENT-003. Documents are walked in content order so the
 * `test` draws come in the same order on every machine. A copy due this month
 * is issued before the old one's expiry is looked at: the new copy replaces
 * it, so a renewal that lands on the expiry month leaves no gap and no
 * "expired" line.
 */
function papers(ctx: Ctx): BaseEvent[] {
  const month = ctx.state.turn.month;
  const events: DocumentEvent[] = [];
  for (const id of Object.keys(ctx.content.document) as Id<"document">[]) {
    const doc = ctx.state.document[id];
    if (doc === undefined) continue;
    const due = beingMade(doc);
    if (due !== null && due <= month) events.push(issue(ctx, id));
    else if (doc.state === "held" && doc.expiresMonth !== null && doc.expiresMonth <= month) {
      events.push({ type: "document/expired", document: id });
    }
  }
  return events;
}

function evolve(slice: DocumentSlice, event: DocumentEvent): DocumentSlice {
  switch (event.type) {
    case "document/requested": {
      const doc = slice[event.document];
      // R-DOCUMENT-004: a held copy stays in force while the new one is made.
      const next: DocumentState =
        doc?.state === "held"
          ? { ...doc, readyMonth: event.readyMonth }
          : { state: "pending", readyMonth: event.readyMonth, expiresMonth: null, value: null };
      return { ...slice, [event.document]: next };
    }
    case "document/already-pending":
      return slice;
    case "document/issued": {
      const next: DocumentState = { state: "held", readyMonth: null, expiresMonth: event.expiresMonth, value: event.value };
      return { ...slice, [event.document]: event.genuine === false ? { ...next, genuine: false } : next };
    }
    case "document/faked":
      return { ...slice, [event.document]: { state: "held", genuine: false, readyMonth: null, expiresMonth: event.expiresMonth, value: null } };
    case "document/hastened": {
      const doc = slice[event.document];
      if (doc === undefined) throw new Error(`${event.document} was brought forward but is not in the state.`);
      return { ...slice, [event.document]: { ...doc, readyMonth: event.readyMonth } };
    }
    case "document/expired": {
      const doc = slice[event.document];
      if (doc === undefined) throw new Error(`${event.document} expired but is not in the state.`);
      const due = beingMade(doc);
      // An old copy that runs out while a new one is made leaves only the new one, pending.
      // R-ADVICE-008: an expired fake keeps its mark.
      const mark = doc.genuine === false ? { genuine: false } : {};
      const next: DocumentState =
        due === null
          ? { ...doc, state: "expired", readyMonth: null }
          : { state: "pending", readyMonth: due, expiresMonth: null, value: null, ...mark };
      return { ...slice, [event.document]: next };
    }
    case "document/voided":
      return Object.fromEntries(Object.entries(slice).filter(([id]) => id !== event.document));
    default: {
      const never: never = event;
      throw new Error(`Unknown document event ${JSON.stringify(never)}.`);
    }
  }
}

function line(key: string, params: ReportLine["params"], tone: ReportLine["tone"], attention = false): ReportLine {
  return { key: `line.document.${key}`, params, tone, attention, counts: [] };
}

function lines(event: DocumentEvent): ReportLine[] {
  switch (event.type) {
    case "document/requested":
      return [line("requested", { document: event.document, month: event.readyMonth }, "plain")];
    case "document/already-pending":
      return [line("already-pending", { document: event.document, month: event.readyMonth }, "plain")];
    case "document/issued":
      // A result is news the player waited for: it asks for attention.
      return event.value === null
        ? [line("issued", { document: event.document }, "good")]
        : [line("issued-band", { document: event.document, band: event.value }, "good", true)];
    case "document/faked":
      return [line("faked", { document: event.document }, "bad", true)];
    case "document/hastened":
      return [line("hastened", { document: event.document, month: event.readyMonth }, "good")];
    case "document/expired":
      return [line("expired", { document: event.document }, "bad")];
    case "document/voided":
      return [line("voided", { document: event.document }, "bad")];
    default: {
      const never: never = event;
      throw new Error(`Unknown document event ${JSON.stringify(never)}.`);
    }
  }
}

function held(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "document/held") throw new Error(`The document kind cannot judge ${requirement.type} as held.`);
  const doc = read.state.document[requirement.document];
  // R-STATUS-009: while the employer holds the passport, no route can use it.
  const valid = inForce(doc, read.state.turn.month) && !(requirement.document === PASSPORT && passportHeldByEmployer(read));
  if (requirement.min === undefined) return { met: valid };
  const have = valid ? (doc.value ?? 0) : 0;
  return { met: valid && have >= requirement.min, have, need: requirement.min };
}

function absent(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "document/absent") throw new Error(`The document kind cannot judge ${requirement.type} as absent.`);
  const doc = read.state.document[requirement.document];
  const made = doc === undefined ? null : beingMade(doc);
  return { met: !inForce(doc, read.state.turn.month) && made === null };
}

function genuine(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "document/genuine") throw new Error(`The document kind cannot judge ${requirement.type} as genuine.`);
  const doc = read.state.document[requirement.document];
  // R-ADVICE-008: a paper from a scammer is held but never genuine.
  return { met: inForce(doc, read.state.turn.month) && doc.genuine !== false };
}

function pending(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "document/pending") throw new Error(`The document kind cannot judge ${requirement.type} as pending.`);
  const doc = read.state.document[requirement.document];
  return { met: doc !== undefined && beingMade(doc) !== null };
}

export const documentKind: RegisteredKind<DocumentSlice, DocumentEvent> = {
  kind: "document",
  // A scenario's papers are held, running out `monthsLeft` months from month 0.
  initial(scenario) {
    const slice: DocumentSlice = {};
    for (const held of scenario.documents) {
      slice[held.document] = { state: "held", readyMonth: null, expiresMonth: held.monthsLeft, value: held.value };
    }
    return slice;
  },
  effects: {
    "document/request": request,
    "document/grant": grant,
    "document/void": voidDocument,
  },
  phases: { papers },
  evolve,
  lines,
  requirements: {
    "document/held": held,
    "document/absent": absent,
    "document/pending": pending,
    "document/genuine": genuine,
  },
  invariants(state, content) {
    const problems: string[] = [];
    for (const [id, doc] of Object.entries(state.document)) {
      const entry = content.document[id as Id<"document">];
      if (entry === undefined) {
        problems.push(`The state holds ${id}, which is not a document in content.`);
        continue;
      }
      if (doc.state === "pending" && doc.readyMonth === null) problems.push(`${id} is pending with no month it is due.`);
      if (doc.state === "held" && entry.validMonths !== null && doc.expiresMonth === null) {
        problems.push(`${id} is held with no expiry month, but it is valid for ${String(entry.validMonths)} months.`);
      }
      if (doc.value !== null && entry.result === null) problems.push(`${id} has the value ${String(doc.value)}, but its entry sets no result.`);
    }
    return problems;
  },
  view: ({ state }) => ({
    documents: Object.entries(state.document).map(([id, held]) => ({
      id: id as Id<"document">,
      state: held.state,
      readyMonth: held.readyMonth,
      expiresMonth: held.expiresMonth,
      value: held.value,
      // R-DOCUMENT-008: a held paper with a new copy requested is on its way as a pending one is.
      onItsWay: beingMade(held),
    })),
  }),
};
