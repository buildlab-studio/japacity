// Documents: docs/rules/document.md. A document waits in an office, is issued,
// and usually runs out.
//
// the contract keeps one DocumentState per document, so a new copy
// being made while an old one is held (R-DOCUMENT-004) is written as
// `state: "held"` with the held copy's `expiresMonth` and `value`, and
// `readyMonth` set to the month the new copy is due. A held document with no
// copy being made has `readyMonth` null.
import { clamp, mulDiv, roundDownTo } from "../engine/int";
import type { RegisteredKind } from "../engine/kind";
import { turnInProgress } from "../engine/kind";
import type {
  BaseEvent,
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
import type { DocumentEvent } from "./document.events";

const ENGLISH = "quality.english";

/** Bands move in steps of 5: a band times ten, to the nearest half band (R-DOCUMENT-005). */
export const BAND_STEP = 5;

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
export function inForce(doc: DocumentState | undefined, month: number): doc is DocumentState {
  return doc !== undefined && doc.state === "held" && (doc.expiresMonth === null || doc.expiresMonth > month);
}

/**
 * The English band (R-DOCUMENT-005): the base, plus the per-hundred figure for
 * every 100 points of English rounded down, plus the drawn steps of 5, moved
 * down to a step and kept in range. `steps` is the draw, from -noiseSteps to
 * noiseSteps.
 */
export function englishBand(english: number, numbers: Tuning["english"], steps: number): number {
  const raw = numbers.base + mulDiv(numbers.perHundred, english, ENGLISH_PER) + steps * BAND_STEP;
  return clamp(roundDownTo(raw, BAND_STEP), numbers.min, numbers.max);
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

/** Issue a copy now: held from this month, running out `validMonths` later (R-DOCUMENT-002). */
function issue(ctx: Ctx, id: Id<"document">): DocumentEvent {
  const entry = entryOf(ctx.content, id);
  const month = ctx.state.turn.month;
  return {
    type: "document/issued",
    document: id,
    expiresMonth: entry.validMonths === null ? null : month + entry.validMonths,
    value: valueOnIssue(ctx, entry),
  };
}

/** R-DOCUMENT-001, R-DOCUMENT-004. */
function request(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "document/request") throw new Error(`The document kind cannot request from ${effect.type}.`);
  const id = effect.document;
  const entry = entryOf(ctx.content, id);
  const doc = ctx.state.document[id];
  const due = doc === undefined ? null : beingMade(doc);
  if (due !== null) {
    // the first plan says a second request returns no events, and also
    // that the report says nothing happened. A line comes only from an event,
    // so this one event changes nothing and carries the line. The activity's
    // fee is already paid by then; that is the activity kind's business.
    const event: DocumentEvent = { type: "document/already-pending", document: id, readyMonth: due };
    return [event];
  }
  const month = ctx.state.turn.month;
  const wait = ctx.random.between("document", entry.wait[0], entry.wait[1]);
  // a request between turns, as from an offer, comes after this
  // month's papers phase, so the earliest it can be issued is next month's.
  // Inside a turn it is this month's, which is how a wait of zero from a slot
  // is issued in the same turn (R-DOCUMENT-002).
  const earliest = turnInProgress(ctx) === null ? month + 1 : month;
  const event: DocumentEvent = { type: "document/requested", document: id, readyMonth: Math.max(month + wait, earliest) };
  return [event];
}

/**
 * R-DOCUMENT-006. a grant replaces whatever is there, so a copy being
 * made is the one issued, and the English test draws its band as on any issue.
 */
function grant(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "document/grant") throw new Error(`The document kind cannot grant from ${effect.type}.`);
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
    case "document/issued":
      return { ...slice, [event.document]: { state: "held", readyMonth: null, expiresMonth: event.expiresMonth, value: event.value } };
    case "document/expired": {
      const doc = slice[event.document];
      if (doc === undefined) throw new Error(`${event.document} expired but is not in the state.`);
      const due = beingMade(doc);
      // An old copy that runs out while a new one is made leaves only the new one, pending.
      const next: DocumentState =
        due === null
          ? { ...doc, state: "expired", readyMonth: null }
          : { state: "pending", readyMonth: due, expiresMonth: null, value: null };
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
  const valid = inForce(doc, read.state.turn.month);
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
    })),
  }),
};
