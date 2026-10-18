// The credit file: docs/rules/credit.md. One file a country, abroad only. It
// starts empty, moves with payments, drifts up after a clean year, and is kept
// for the country when the character goes home.
import { clamp } from "../engine/int";
import type { RegisteredKind } from "../engine/kind";
import { emit } from "../engine/kind";
import type {
  BaseEvent,
  Content,
  Ctx,
  CreditFile,
  CreditSlice,
  Effect,
  Id,
  ObligationEntry,
  PlayerView,
  ReadCtx,
  ReportLine,
  Requirement,
  RequirementResult,
  State,
} from "../engine/types";
import type { CreditEvent } from "./credit.events";

const MARK_MIN = 0;
const MARK_MAX = 100;

const EMPTY: CreditFile = { mark: 0, onTime: 0, missed: 0, lastMissMonth: null, judgmentUntil: null };

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * The country whose file a payment moves: the one the character is in, or
 * after a return the last one left, so a debt that follows you home still
 * reports to the file it was opened under. Null before any time abroad.
 */
function fileCountry(read: ReadCtx): Id<"country"> | null {
  const { place } = read.state;
  if (place.where === "abroad") return place.country;
  return place.returns.at(-1)?.country ?? null;
}

/**
 * credit:file-starts-at-zero-abroad: true from a second arrival in a country until its first month
 * there begins, when the spend phase takes the penalty off the stored file.
 */
function penaltyPending(read: ReadCtx, country: Id<"country">): boolean {
  const { place, turn } = read.state;
  return (
    place.where === "abroad" &&
    place.country === country &&
    turn.month === place.movedMonth &&
    place.returns.some((back) => back.country === country)
  );
}

/** A country's file as it reads now: empty on a first arrival, less the return penalty until it is taken. */
function fileOf(read: ReadCtx, country: Id<"country">): CreditFile {
  const file = read.state.credit.byCountry[country] ?? EMPTY;
  if (!penaltyPending(read, country)) return file;
  return { ...file, mark: Math.max(MARK_MIN, file.mark - read.content.tuning.credit.returnPenalty) };
}

/** The file of the country the character is in, or null anywhere else. */
function currentFile(read: ReadCtx): CreditFile | null {
  const { place } = read.state;
  if (place.where !== "abroad" || place.country === null) return null;
  return fileOf(read, place.country);
}

/** The credit mark where the character is. Zero at home and on the road. */
function creditMark(read: ReadCtx): number {
  return currentFile(read)?.mark ?? 0;
}

/** credit:judgment-blocks-credit: a judgment stands until the month it clears. */
function judgmentStands(read: ReadCtx, file: CreditFile): boolean {
  return file.judgmentUntil !== null && read.state.turn.month < file.judgmentUntil;
}

/**
 * credit:rate-follows-credit-ladder: the monthly rate an entry offers this file. The first rung of
 * `rateByCredit` whose `min` the mark reaches gives it; an entry with no ladder
 * has its own rate; null when the mark reaches no rung, so it is not offered.
 */
export function rateFor(read: ReadCtx, entry: ObligationEntry): number | null {
  if (entry.rateByCredit === undefined) return entry.rateBp;
  const mark = creditMark(read);
  return entry.rateByCredit.find((rung) => mark >= rung.min)?.rateBp ?? null;
}

/** credit:approval-reads-the-mark with credit:judgment-blocks-credit. */
function judgeMin(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "credit/min") throw new Error(`credit/min cannot judge ${requirement.type}.`);
  const file = currentFile(read);
  const have = file?.mark ?? 0;
  const blocked = file !== null && judgmentStands(read, file) && requirement.value > read.content.tuning.credit.judgmentCap;
  return { met: !blocked && have >= requirement.value, have, need: requirement.value };
}

// ---------------------------------------------------------------------------
// Carrying out
// ---------------------------------------------------------------------------

function record(ctx: Ctx, events: CreditEvent[]): BaseEvent[] {
  return emit(ctx, "credit", events);
}

function stored(state: State, country: Id<"country">): CreditFile {
  return state.credit.byCountry[country] ?? EMPTY;
}

/** credit:payments-move-the-mark: the mark moves by the amount asked and never leaves 0 to 100. */
function mark(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "credit/mark") throw new Error(`credit/mark cannot carry out ${effect.type}.`);
  const country = fileCountry(ctx);
  if (country === null || effect.amount === 0) return [];
  const file = stored(ctx.state, country);
  const points = clamp(file.mark + effect.amount, MARK_MIN, MARK_MAX) - file.mark;
  return record(ctx, [{ type: "credit/marked", country, asked: effect.amount, points, month: ctx.state.turn.month }]);
}

/** credit:judgment-blocks-credit: a judgment for the months the tuning gives, from this month. */
function judgment(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "credit/judgment") throw new Error(`credit/judgment cannot carry out ${effect.type}.`);
  const country = fileCountry(ctx);
  if (country === null) return [];
  return record(ctx, [{ type: "credit/judged", country, until: ctx.state.turn.month + ctx.content.tuning.credit.judgmentMonths }]);
}

/** credit:file-starts-at-zero-abroad: the first month of a second stay takes the penalty off the kept file. */
function spend(ctx: Ctx): BaseEvent[] {
  const { place, turn } = ctx.state;
  if (place.where !== "abroad" || place.country === null || turn.month !== place.movedMonth + 1) return [];
  const country = place.country;
  const file = ctx.state.credit.byCountry[country];
  if (file === undefined || !place.returns.some((back) => back.country === country)) return [];
  const points = Math.max(MARK_MIN, file.mark - ctx.content.tuning.credit.returnPenalty) - file.mark;
  return record(ctx, [{ type: "credit/reopened", country, points }]);
}

/**
 * credit:clean-mark-drifts-up. A clean year is counted from the later of the arrival
 * and the last miss, so a new file earns nothing but its payments in its first
 * year, which is the page's pace of 6 a month for rent and phone.
 */
function month(ctx: Ctx): BaseEvent[] {
  const { place, turn } = ctx.state;
  if (place.where !== "abroad" || place.country === null) return [];
  const { drift, driftTo, cleanMonths } = ctx.content.tuning.credit;
  const file = stored(ctx.state, place.country);
  const since = Math.max(place.movedMonth, file.lastMissMonth ?? place.movedMonth);
  if (turn.month - since < cleanMonths || file.mark >= driftTo) return [];
  return record(ctx, [{ type: "credit/drifted", country: place.country, points: Math.min(drift, driftTo - file.mark) }]);
}

// ---------------------------------------------------------------------------
// Evolve, lines, view
// ---------------------------------------------------------------------------

function withFile(slice: CreditSlice, country: Id<"country">, change: (file: CreditFile) => CreditFile): CreditSlice {
  return { ...slice, byCountry: { ...slice.byCountry, [country]: change(slice.byCountry[country] ?? EMPTY) } };
}

function evolve(slice: CreditSlice, event: CreditEvent): CreditSlice {
  switch (event.type) {
    case "credit/marked":
      return withFile(slice, event.country, (file) => ({
        ...file,
        mark: file.mark + event.points,
        onTime: event.asked > 0 ? file.onTime + 1 : file.onTime,
        missed: event.asked < 0 ? file.missed + 1 : file.missed,
        lastMissMonth: event.asked < 0 ? event.month : file.lastMissMonth,
      }));
    case "credit/judged":
      return withFile(slice, event.country, (file) => ({ ...file, judgmentUntil: event.until }));
    case "credit/drifted":
    case "credit/reopened":
      return withFile(slice, event.country, (file) => ({ ...file, mark: file.mark + event.points }));
    default: {
      const never: never = event;
      throw new Error(`Unknown credit event ${JSON.stringify(never)}.`);
    }
  }
}

function line(key: string, params: ReportLine["params"], tone: ReportLine["tone"], attention: boolean): ReportLine {
  return { key: `line.credit.${key}`, params, tone, attention, counts: [] };
}

function lines(event: CreditEvent, state: State): ReportLine[] {
  switch (event.type) {
    case "credit/marked": {
      const file = stored(state, event.country);
      if (event.asked < 0) return [line("missed", { country: event.country, mark: file.mark }, "bad", false)];
      // The first payment on time is the first mark on an empty file; the rest are said by the payment itself.
      return file.onTime === 1 ? [line("first", { country: event.country, mark: file.mark }, "good", false)] : [];
    }
    case "credit/judged":
      return [line("judgment", { country: event.country, until: event.until }, "bad", true)];
    case "credit/reopened":
      return [line("reopened", { country: event.country, mark: stored(state, event.country).mark }, "plain", false)];
    case "credit/drifted":
      return [];
    default: {
      const never: never = event;
      throw new Error(`Unknown credit event ${JSON.stringify(never)}.`);
    }
  }
}

/** The obligation entries that belong to one country: its upkeep, rents and phone. */
function countryOwned(content: Content): Map<Id<"obligation">, Id<"country">> {
  const owned = new Map<Id<"obligation">, Id<"country">>();
  for (const country of Object.values(content.country)) {
    for (const id of [country.upkeep, country.rentRoom, country.rentFlat, country.phone]) {
      if (id !== null) owned.set(id, country.id);
    }
  }
  return owned;
}

/** credit:view-shows-credit-file: what each abroad entry that needs credit asks for, where the character is. */
function creditNeeds(read: ReadCtx): { id: Id<"obligation">; creditMin: number }[] {
  const owned = countryOwned(read.content);
  const here = read.state.place.country;
  return Object.values(read.content.obligation)
    .flatMap((entry) => {
      if (entry.where !== "abroad" || entry.creditMin === undefined) return [];
      const country = owned.get(entry.id);
      if (country !== undefined && country !== here) return [];
      return [{ id: entry.id, creditMin: entry.creditMin }];
    })
    .sort((a, b) => a.creditMin - b.creditMin || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function view(read: ReadCtx): Pick<PlayerView, "credit"> {
  const file = currentFile(read);
  if (file === null) return { credit: null };
  return {
    credit: {
      mark: file.mark,
      onTime: file.onTime,
      missed: file.missed,
      judgmentUntil: judgmentStands(read, file) ? file.judgmentUntil : null,
      needs: creditNeeds(read),
    },
  };
}

function invariants(state: State, content: Content): string[] {
  const problems: string[] = [];
  for (const [country, file] of Object.entries(state.credit.byCountry)) {
    if (content.country[country as Id<"country">] === undefined) problems.push(`The credit file names ${country}, which is not a country in content.`);
    if (!Number.isSafeInteger(file.mark) || file.mark < MARK_MIN || file.mark > MARK_MAX) problems.push(`The ${country} file has the mark ${String(file.mark)}.`);
    for (const [name, value] of Object.entries({ onTime: file.onTime, missed: file.missed })) {
      if (!Number.isSafeInteger(value) || value < 0) problems.push(`The ${country} file has ${name} ${String(value)}.`);
    }
    if (file.lastMissMonth !== null && file.lastMissMonth > state.turn.month) problems.push(`The ${country} file has a miss after this month.`);
  }
  return problems;
}

export const creditKind: RegisteredKind<CreditSlice, CreditEvent> = {
  kind: "credit",
  initial: () => ({ byCountry: {} }),
  effects: { "credit/mark": mark, "credit/judgment": judgment },
  phases: { spend, month },
  evolve,
  lines,
  requirements: { "credit/min": judgeMin },
  invariants,
  view,
};
