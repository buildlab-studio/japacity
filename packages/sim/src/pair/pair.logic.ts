// The one record two players share: pair:one-record-per-two, pair:record-fields, pair:record-holds-no-personal-data, pair:only-server-writes-record, pair:joint-steps-need-both-sides, pair:who-may-read-a-record, pair:block-ends-every-bond and pair:report-holds-conversation. Pure functions over plain data, read and written by the
// server and both clients alike. No clock, no randomness, no platform feature.
import type { BondStage, Id, InterviewResult, Moment, PairRecord, Proposal } from "../engine/types";
import type { PairWrite, Side } from "./pair.events";

export type { PairWrite, Side } from "./pair.events";

const JOIN = "~";

/** Every surface that shows another player carries these, one tap away (pair:block-and-report-one-tap). */
export const SAFETY_CONTROLS = ["block", "report"] as const;

/** The record's id: the two character ids, sorted, joined by `~` (pair:one-record-per-two). */
export function pairId(x: string, y: string): string {
  if (x === y) throw new Error(`A pair needs two characters, not ${x} twice.`);
  return x < y ? `${x}${JOIN}${y}` : `${y}${JOIN}${x}`;
}

export function flip(side: Side): Side {
  return side === "a" ? "b" : "a";
}

/** Which side `me` is. Throws for anyone not in the record. */
export function side(record: PairRecord, me: string): Side {
  if (me !== "" && record.a === me) return "a";
  if (me !== "" && record.b === me) return "b";
  throw new Error(`${me} is not in the pair ${record.id}.`);
}

/** The other side's character id, or "" once that account is deleted. */
export function other(record: PairRecord, me: string): string {
  return record[flip(side(record, me))];
}

/** A record at `connected`, made when a partner link is opened (pair:invite-link-single-use). */
export function newRecord(x: string, y: string, role: PairRecord["role"], invitedBy: string, tick: number): PairRecord {
  if (invitedBy !== x && invitedBy !== y) throw new Error(`${invitedBy} is not one of the two.`);
  const id = pairId(x, y);
  const [a, b] = x < y ? [x, y] : [y, x];
  return {
    id,
    a,
    b,
    role,
    stage: "connected",
    since: { connected: tick },
    invitedBy: invitedBy === a ? "a" : "b",
    pending: { a: null, b: null },
    consent: { a: { countFunds: false, standInMay: false }, b: { countFunds: false, standInMay: false } },
    moments: [],
    joint: null,
    interview: null,
    blocked: { a: false, b: false },
    standIn: { a: null, b: null },
    ended: null,
    held: false,
  };
}

/** A proposal as the other side reads it: the lead seen from there. */
export function mirror(proposal: Proposal): Proposal {
  const lead = proposal.lead === null ? null : proposal.lead === "me" ? "them" : "me";
  return { step: proposal.step, route: proposal.route, lead };
}

function sameTerms(left: Proposal, right: Proposal): boolean {
  return left.step === right.step && left.route === right.route && left.lead === right.lead;
}

/**
 * The step both sides hold, in side a's terms, or null (pair:joint-steps-need-both-sides). Each
 * pending proposal is kept in its own side's terms.
 */
export function agreed(record: PairRecord): Proposal | null {
  const { a, b } = record.pending;
  if (a === null || b === null) return null;
  return sameTerms(a, mirror(b)) ? { ...a } : null;
}

function stepFits(record: PairRecord, step: Proposal["step"]): boolean {
  switch (step) {
    case "partner":
      return record.role === "partner" && record.stage === "courting";
    case "marry":
      return record.role === "partner" && record.stage === "partner";
    case "joint":
    case "landed":
      return record.stage === "partner" || record.stage === "married";
    default: {
      const never: never = step;
      throw new Error(`Unknown step ${String(never)}.`);
    }
  }
}

function withStage(record: PairRecord, stage: BondStage, tick: number): PairRecord {
  return { ...record, stage, since: { ...record.since, [stage]: tick } };
}

function endWith(record: PairRecord, by: NonNullable<PairRecord["ended"]>["by"], tick: number): PairRecord {
  return {
    ...withStage(record, "ended", tick),
    ended: { by, tick },
    pending: { a: null, b: null },
    joint: null,
    // An interview not yet scored closes unscored when the bond ends (interview:players-answer-at-own-pace).
    interview: record.interview !== null && record.interview.result !== null ? record.interview : null,
    standIn: { a: null, b: null },
  };
}

function bySide<T>(pair: { a: T; b: T }, at: Side, value: T): { a: T; b: T } {
  return at === "a" ? { a: value, b: pair.b } : { a: pair.a, b: value };
}

function applyAgreed(record: PairRecord, tick: number): PairRecord {
  const deal = agreed(record);
  if (deal === null) return record;
  const cleared: PairRecord = { ...record, pending: { a: null, b: null } };
  switch (deal.step) {
    case "partner":
      return withStage(cleared, "partner", tick);
    case "marry":
      return withStage(cleared, "married", tick);
    case "joint":
      if (deal.route === null || deal.lead === null) return record;
      return { ...cleared, joint: { route: deal.route, lead: deal.lead === "me" ? "a" : "b" } };
    case "landed":
      return cleared;
    default: {
      const never: never = deal.step;
      throw new Error(`Unknown step ${String(never)}.`);
    }
  }
}

/**
 * The record after one write from one side (pair:only-server-writes-record). The lives have
 * already accepted the command; a write that no longer fits the record (a
 * proposal on an ended bond, a second answer) leaves it as it was.
 */
export function writeEvent(record: PairRecord, from: Side, write: PairWrite): PairRecord {
  const live = record.ended === null;
  const them = flip(from);
  switch (write.type) {
    case "pair/linked": {
      // Lifting a block restores nothing: a new invite relinks an ended record (pair:block-ends-every-bond).
      if (live || record.blocked.a || record.blocked.b || record.a === "" || record.b === "") return record;
      return {
        ...record,
        stage: "connected",
        since: { connected: write.tick },
        invitedBy: from,
        pending: { a: null, b: null },
        consent: { a: { countFunds: false, standInMay: false }, b: { countFunds: false, standInMay: false } },
        joint: null,
        interview: null,
        standIn: { a: null, b: null },
        ended: null,
      };
    }
    case "pair/courted":
      if (!live || record.role !== "partner" || record.stage !== "connected") return record;
      return withStage(record, "courting", write.tick);
    case "pair/moment-added": {
      if (!live) return record;
      const last = record.moments.at(-1);
      // Only the six fields of a moment are kept, whatever else a write carries (pair:record-holds-no-personal-data).
      const moment = { n: last === undefined ? 1 : last.n + 1, by: from, kind: write.kind, spot: write.spot, what: write.what, tick: write.tick };
      return { ...record, moments: [...record.moments, moment] };
    }
    case "pair/proposed": {
      if (!live || !stepFits(record, write.proposal.step)) return record;
      const proposal: Proposal = { step: write.proposal.step, route: write.proposal.route, lead: write.proposal.lead };
      return { ...record, pending: bySide(record.pending, from, proposal) };
    }
    case "pair/answered": {
      const theirs = record.pending[them];
      if (!live || theirs === null || theirs.step !== write.step) return record;
      if (!write.yes) return { ...record, pending: bySide(record.pending, them, null) };
      return { ...record, pending: bySide(record.pending, from, mirror(theirs)) };
    }
    case "pair/agreed":
      return live ? applyAgreed(record, write.tick) : record;
    case "pair/withdrawn":
      return { ...record, pending: bySide(record.pending, from, null) };
    case "pair/consented":
      if (!live) return record;
      return { ...record, consent: bySide(record.consent, from, { countFunds: write.countFunds, standInMay: write.standInMay }) };
    case "pair/ended":
      if (!live) return record;
      // Only the waiting side ends by absence, and only while the stand-in is on (person:stand-in-acts-narrowly).
      if (write.absence && record.standIn[them] !== "on") return record;
      return endWith(record, write.absence ? "absence" : from, write.tick);
    case "pair/blocked": {
      const blocked = { ...record, blocked: bySide(record.blocked, from, true) };
      return live ? endWith(blocked, "block", write.tick) : blocked;
    }
    case "pair/unblocked":
      return { ...record, blocked: bySide(record.blocked, from, false) };
    case "pair/stand-in-changed":
      if (!live && write.stage !== null) return record;
      return { ...record, standIn: bySide(record.standIn, from, write.stage) };
    case "pair/interview-opened":
      if (!live) return record;
      return {
        ...record,
        interview: {
          route: write.route,
          questions: write.questions.map((question) => ({ id: question.id, options: [...question.options] })),
          answers: { a: null, b: null },
          standIn: { a: false, b: false },
          result: null,
        },
      };
    case "pair/interview-answered": {
      const interview = record.interview;
      if (!live || interview === null || interview.result !== null || interview.answers[from] !== null) return record;
      if (write.answers.length !== interview.questions.length) return record;
      return {
        ...record,
        interview: { ...interview, answers: bySide(interview.answers, from, [...write.answers]), standIn: bySide(interview.standIn, from, write.standIn) },
      };
    }
    case "pair/interview-scored": {
      const interview = record.interview;
      if (interview === null || interview.result !== null || interview.answers.a === null || interview.answers.b === null) return record;
      return { ...record, interview: { ...interview, result: write.result } };
    }
    case "pair/deleted": {
      if (record[from] === "") return record;
      const ended = live ? endWith(record, "deleted", write.tick) : record;
      // The record's id still carries both character ids, as the server's key and the moderator's lookup while held.
      const consent = bySide(ended.consent, from, { countFunds: false, standInMay: false });
      return from === "a" ? { ...ended, a: "", consent } : { ...ended, b: "", consent };
    }
    case "pair/held":
      return { ...record, held: true };
    case "pair/released":
      return { ...record, held: false };
    default: {
      const never: never = write;
      throw new Error(`Unknown pair write ${JSON.stringify(never)}.`);
    }
  }
}

/** What one side may see of a record (pair:who-may-read-a-record). */
export interface PairView {
  id: string;
  side: Side;
  /** The other side's character id, or "" once that account is deleted. */
  them: string;
  role: PairRecord["role"];
  stage: BondStage;
  since: PairRecord["since"];
  invitedBy: "me" | "them";
  /** Both in this side's terms. */
  pending: { mine: Proposal | null; theirs: Proposal | null };
  /** This side's own consents only. */
  consent: { countFunds: boolean; standInMay: boolean };
  moments: Moment[];
  joint: { route: Id<"route">; lead: "me" | "them" } | null;
  interview: {
    route: Id<"route">;
    questions: { id: string; options: string[] }[];
    mine: string[] | null;
    /** Null until the interview is scored. */
    theirs: string[] | null;
    waiting: boolean;
    standIn: { mine: boolean; theirs: boolean };
    result: InterviewResult | null;
  } | null;
  /** Whether this side has blocked the other. The other side's block is never shown. */
  blocked: boolean;
  standIn: { mine: "warned" | "on" | null; theirs: "warned" | "on" | null };
  /** `by` is null where this side may learn only that the bond ended (pair:block-ends-every-bond). */
  ended: { by: "me" | "them" | "absence" | "block" | null; tick: number } | null;
  controls: typeof SAFETY_CONTROLS;
}

function endedFor(record: PairRecord, mine: Side): PairView["ended"] {
  const ended = record.ended;
  if (ended === null) return null;
  switch (ended.by) {
    case "a":
    case "b":
      return { by: ended.by === mine ? "me" : "them", tick: ended.tick };
    case "absence":
      return { by: "absence", tick: ended.tick };
    // The one who stays sees an absence end (person:leaving-player-ends-bonds).
    case "deleted":
      return { by: "absence", tick: ended.tick };
    case "block":
      return { by: record.blocked[mine] ? "block" : null, tick: ended.tick };
    default: {
      const never: never = ended.by;
      throw new Error(`Unknown end ${String(never)}.`);
    }
  }
}

function interviewFor(record: PairRecord, mine: Side): PairView["interview"] {
  const interview = record.interview;
  if (interview === null) return null;
  const theirs = flip(mine);
  const scored = interview.result !== null && interview.answers.a !== null && interview.answers.b !== null;
  return {
    route: interview.route,
    questions: interview.questions.map((question) => ({ id: question.id, options: [...question.options] })),
    mine: interview.answers[mine] === null ? null : [...interview.answers[mine]],
    theirs: scored && interview.answers[theirs] !== null ? [...interview.answers[theirs]] : null,
    waiting: interview.answers[mine] !== null && interview.answers[theirs] === null,
    standIn: { mine: interview.standIn[mine], theirs: interview.standIn[theirs] },
    result: interview.result,
  };
}

/**
 * The record as one of its two sides may read it, or null for anyone else
 * (pair:who-may-read-a-record). Never the other side's consents, its interview answers before
 * scoring, its block, or whether a report holds the record.
 * pair:who-may-read-a-record names only the answers and the report; the other side's consents and block are hidden as well.
 */
export function pairView(record: PairRecord, me: string): PairView | null {
  if (me === "" || (record.a !== me && record.b !== me)) return null;
  const mine = side(record, me);
  const theirs = flip(mine);
  const own = (pending: Proposal | null): Proposal | null => (pending === null ? null : { ...pending });
  const seen = (pending: Proposal | null): Proposal | null => (pending === null ? null : mirror(pending));
  return {
    id: record.id,
    side: mine,
    them: record[theirs],
    role: record.role,
    stage: record.stage,
    since: { ...record.since },
    invitedBy: record.invitedBy === mine ? "me" : "them",
    pending: { mine: own(record.pending[mine]), theirs: seen(record.pending[theirs]) },
    consent: { ...record.consent[mine] },
    moments: record.moments.map((moment) => ({ n: moment.n, by: moment.by === mine ? "me" : "them", kind: moment.kind, spot: moment.spot, what: moment.what, tick: moment.tick })),
    joint: record.joint === null ? null : { route: record.joint.route, lead: record.joint.lead === mine ? "me" : "them" },
    interview: interviewFor(record, mine),
    blocked: record.blocked[mine],
    standIn: { mine: record.standIn[mine], theirs: record.standIn[theirs] },
    ended: endedFor(record, mine),
    controls: SAFETY_CONTROLS,
  };
}
