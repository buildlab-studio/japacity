// Status abroad: docs/rules/status.md, R-STATUS-001 to 011. One current status,
// held only abroad, with its clocks: expiry, the job clock, settling.
import { worldVar } from "../engine/check";
import { mulDiv } from "../engine/int";
import type { RegisteredKind } from "../engine/kind";
import { emit } from "../engine/kind";
import { reject } from "../engine/reject";
import type {
  ActivityEntry,
  BaseEvent,
  Cause,
  Command,
  Content,
  CountryEntry,
  Ctx,
  Effect,
  ForeignCurrency,
  Id,
  MoneyParam,
  PlayerView,
  ReadCtx,
  Rejection,
  ReportLine,
  Requirement,
  RequirementResult,
  StatusEntry,
  StatusSlice,
  StatusState,
  State,
} from "../engine/types";
import { cashWorkedThisMonth } from "../activity/activity.pay";
import { leadStatusMonths } from "../route/gates/dependant";
import type { GrantWhy, LapseWhy, StatusEvent } from "./status.events";

const MONTHS_PER_YEAR = 12;
/** R-STATUS-011: months held before a course counts as passed. no tuning field holds it. */

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export function statusEntry(content: Content, id: Id<"status">): StatusEntry {
  const entry = content.status[id];
  if (entry === undefined) throw new Error(`The content has no status ${id}.`);
  return entry;
}

export function countryEntry(content: Content, id: Id<"country">): CountryEntry {
  const entry = content.country[id];
  if (entry === undefined) throw new Error(`The content has no country ${id}.`);
  return entry;
}

/** The country's own currency, which every fee abroad is charged in. */
export function foreignCurrencyOf(content: Content, country: Id<"country">): ForeignCurrency {
  const { currency } = countryEntry(content, country);
  if (currency === "NGN") throw new Error(`${country} charges in naira, which is no foreign currency.`);
  return currency;
}

/** R-STATUS-005: the status a lapse ends in. */
export function isOverstayer(content: Content, id: Id<"status">): boolean {
  return countryEntry(content, statusEntry(content, id).country).overstayer === id;
}

/**
 * A settled, citizen or permanent resident status (R-PLACE-005, R-RETURN-004).
 * the contract has no field for it, so it is a status that never
 * expires and is not its country's overstayer.
 */
export function isKept(content: Content, id: Id<"status">): boolean {
  return statusEntry(content, id).months === null && !isOverstayer(content, id);
}

/**
 * R-STATUS-002, for the activity kind: whether the current status lets the
 * character hold this job. At home, with no status, it says yes. a
 * `one-employer` status allows the job it names and, by R-LADDER-005, any job
 * marked `sponsor`, which carries a certificate of its own.
 */
export function workAllows(read: ReadCtx, job: ActivityEntry): boolean {
  const current = read.state.status.current;
  if (current === null) return true;
  const { work } = statusEntry(read.content, current.entry);
  switch (work) {
    case "any":
      return true;
    case "part":
      return job.part === true;
    case "one-employer":
      return job.id === current.job || job.sponsor === true;
    case "cash":
      return job.cash === true;
    case "none":
      return false;
    default: {
      const never: never = work;
      throw new Error(`Unknown work rule ${String(never)}.`);
    }
  }
}

/**
 * R-STATUS-009, for the route kind: the employer holds the passport while a
 * status that says so is current. Nothing is applied to the document kind; a
 * route that needs the passport reads this.
 */
export function passportHeldByEmployer(read: ReadCtx): boolean {
  const current = read.state.status.current;
  return current !== null && statusEntry(read.content, current.entry).holdsPassport;
}

/** R-STATUS-011: held long enough, and no tuition obligation has gone into default. */
export function coursePassed(read: ReadCtx): boolean {
  const current = read.state.status.current;
  if (current === null || current.monthsHeld < read.content.tuning.status.courseMonths) return false;
  return !Object.values(read.state.obligation.items).some(
    (item) => item.state === "defaulted" && read.content.obligation[item.entry]?.type === "tuition",
  );
}

/** The ban on the country's routes after a removal, in months: the country's overstayer's figure (R-PLACE-008). */
export function removalBanMonths(content: Content, country: Id<"country">): number {
  const overstayer = countryEntry(content, country).overstayer;
  return overstayer === null ? 0 : statusEntry(content, overstayer).banMonths;
}

// ---------------------------------------------------------------------------
// Carrying out
// ---------------------------------------------------------------------------

function record(ctx: Ctx, events: StatusEvent[]): BaseEvent[] {
  return emit(ctx, "status", events);
}

function currentOf(ctx: Ctx): { held: StatusState; entry: StatusEntry } | null {
  const held = ctx.state.status.current;
  return held === null ? null : { held, entry: statusEntry(ctx.content, held.entry) };
}

function lengthOf(read: ReadCtx, entry: StatusEntry): number | null {
  if (entry.months === null) return null;
  // R-PEOPLE-024: a dependant's status ends when the lead's does, read from the lead's facts.
  if (entry.months === "lead") return leadStatusMonths(read);
  return typeof entry.months === "number" ? entry.months : worldVar(read, entry.months);
}

/**
 * abroad-money.md, `country.uae` money: the employer who holds the passport
 * also houses the worker, so no room is rented while that status is held, and
 * the country's room is rented once it goes.
 */
function housing(ctx: Ctx, before: Id<"status"> | null, after: Id<"status"> | null): void {
  const was = before === null ? null : statusEntry(ctx.content, before);
  const now = after === null ? null : statusEntry(ctx.content, after);
  const wasHoused = was?.holdsPassport === true;
  const isHoused = now?.holdsPassport === true;
  const cause: Cause = { source: after ?? before ?? "status", param: null, terms: {} };
  if (isHoused && !wasHoused) ctx.apply([{ type: "obligation/close", obligationType: "rent" }], cause);
  const room = was === null ? null : countryEntry(ctx.content, was.country).rentRoom;
  if (wasHoused && !isHoused && room !== null && ctx.state.place.where === "abroad") ctx.apply([{ type: "obligation/open", obligation: room }], cause);
}

/** R-STATUS-001: the old status, if any, is replaced. */
function grant(ctx: Ctx, status: Id<"status">, job: Id<"activity"> | null, why: GrantWhy, fee: MoneyParam | null): BaseEvent[] {
  const entry = statusEntry(ctx.content, status);
  const month = ctx.state.turn.month;
  const length = lengthOf(ctx, entry);
  const before = ctx.state.status.current;
  const events = record(ctx, [
    {
      type: "status/granted",
      status,
      month,
      expiresMonth: length === null ? null : month + length,
      lawfulMonths: entry.countsFromBefore && before !== null ? before.lawfulMonths : 0,
      job,
      why,
      fee,
    },
  ]);
  housing(ctx, before?.entry ?? null, status);
  return events;
}

/** R-STATUS-005: the status goes and the country's overstayer status takes its place. */
function lapse(ctx: Ctx, why: LapseWhy): BaseEvent[] {
  const now = currentOf(ctx);
  if (now === null) return [];
  const events = record(ctx, [{ type: "status/lapsed", status: now.held.entry, why }]);
  const overstayer = countryEntry(ctx.content, now.entry.country).overstayer;
  if (overstayer !== null) events.push(...grant(ctx, overstayer, null, "lapsed", null));
  housing(ctx, now.held.entry, overstayer);
  return events;
}

function grantEffect(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "status/grant") throw new Error(`status/grant cannot carry out ${effect.type}.`);
  return grant(ctx, effect.status, effect.job ?? null, "granted", null);
}

/**
 * Abroad a lost status lapses (R-ABROAD-005 withdraws a student this way).
 * at home the same effect closes the status with nothing after it,
 * which is how a return closes every status (R-PLACE-004).
 */
function lose(ctx: Ctx): BaseEvent[] {
  const now = currentOf(ctx);
  if (now === null) return [];
  if (ctx.state.place.where !== "abroad") return record(ctx, [{ type: "status/closed", status: now.held.entry }]);
  if (isOverstayer(ctx.content, now.held.entry)) return [];
  return lapse(ctx, "lost");
}

/** R-STATUS-003; R-STATUS-009 lapses a status that goes with the job at once. */
function clockStart(ctx: Ctx): BaseEvent[] {
  const now = currentOf(ctx);
  if (now === null) return [];
  if (now.entry.lapsesAtOnce) return lapse(ctx, "job");
  if (now.entry.clockMonths === null || now.held.clock !== null) return [];
  return record(ctx, [{ type: "status/clock-started", months: now.entry.clockMonths }]);
}

/**
 * R-STATUS-008. the ban on the country's routes is not applied as an
 * effect, since the contract has none; the route kind reads `status.removals`
 * with `removalBanMonths` and `place.returns` (R-PLACE-008).
 */
function remove(ctx: Ctx, cause: Cause): BaseEvent[] {
  const { where, country } = ctx.state.place;
  if (where !== "abroad" || country === null) return [];
  const events = record(ctx, [
    {
      type: "status/removed",
      status: ctx.state.status.current?.entry ?? null,
      country,
      month: ctx.state.turn.month,
      banMonths: removalBanMonths(ctx.content, country),
    },
  ]);
  ctx.apply([{ type: "place/move", to: "home", country: null }], cause);
  return events;
}

// ---------------------------------------------------------------------------
// The command
// ---------------------------------------------------------------------------

/** R-STATUS-006. */
function renew(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "status/renew") throw new Error(`status/renew cannot handle ${command.type}.`);
  const now = currentOf(ctx);
  if (now === null) return reject("not-legal", "No status is held.");
  const { held, entry } = now;
  if (entry.renewMonths <= 0 || held.expiresMonth === null) return reject("not-legal", `${held.entry} does not renew.`);
  // the Gulf contract renews by the employer's choice, a draw the content gives no chance for, so the player cannot ask.
  if (entry.renewFeeVar === null) return reject("not-legal", `${held.entry} renews only by the employer's choice.`);
  const job = ctx.state.activity.job;
  if (entry.work === "one-employer" && (job === null || (held.job !== null && held.job !== job))) {
    return reject("not-legal", `${held.entry} renews only while the job is held.`);
  }
  const currency = foreignCurrencyOf(ctx.content, entry.country);
  const fee = worldVar(ctx, entry.renewFeeVar);
  const surcharge = entry.surchargeYearVar === null ? 0 : mulDiv(worldVar(ctx, entry.surchargeYearVar), entry.renewMonths, MONTHS_PER_YEAR);
  if (!ctx.check({ type: "money/can-pay", currency, amount: fee + surcharge }).met) {
    return reject("cannot-afford", `The renewal costs ${String(fee + surcharge)} in ${currency} and cannot be paid.`);
  }
  const cause: Cause = { source: command.type, param: held.entry, terms: {} };
  ctx.apply(
    [
      { type: "money/pay-fee", currency, amount: fee, reason: "fee-visa" },
      { type: "money/pay-fee", currency, amount: surcharge, reason: "fee-surcharge" },
    ],
    cause,
  );
  return record(ctx, [{ type: "status/renewed", expiresMonth: held.expiresMonth + entry.renewMonths, months: entry.renewMonths, currency, fee, surcharge }]);
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

/** R-STATUS-005 and R-LADDER-003: cash work this month raises the detection chance. */
function detect(ctx: Ctx): BaseEvent[] {
  const now = currentOf(ctx);
  if (now === null || !isOverstayer(ctx.content, now.held.entry)) return [];
  const cash = cashWorkedThisMonth(ctx);
  const chance = now.entry.detectBp + (cash ? ctx.content.tuning.ladder.cashDetectBp : 0);
  if (!ctx.random.chance("status", chance)) return [];
  return remove(ctx, { source: now.held.entry, param: null, terms: {} });
}

/** R-STATUS-003: the clock runs a month at a time and lapses the status at zero, unless an allowed job is held again. */
function runClock(ctx: Ctx): BaseEvent[] {
  const now = currentOf(ctx);
  if (now === null || now.held.clock === null) return [];
  const job = ctx.state.activity.job;
  const jobEntry = job === null ? undefined : ctx.content.activity[job];
  if (jobEntry !== undefined && workAllows(ctx, jobEntry)) return record(ctx, [{ type: "status/clock-cleared" }]);
  const left = now.held.clock - 1;
  if (left <= 0) return lapse(ctx, "clock");
  return record(ctx, [{ type: "status/clock-ran", left }]);
}

/**
 * R-STATUS-004 and 011. the course rule is read for any status that
 * moves on to a `next` by its clock, which in content is only the student's.
 */
function expire(ctx: Ctx): BaseEvent[] {
  const now = currentOf(ctx);
  if (now === null || now.held.expiresMonth === null || ctx.state.turn.month < now.held.expiresMonth) return [];
  const { next, nextIf } = now.entry;
  if (next !== null && coursePassed(ctx) && nextIf.every((requirement) => ctx.check(requirement).met)) {
    return grant(ctx, next, now.held.job, "next", null);
  }
  return lapse(ctx, "expired");
}

/** Pays a settling or citizenship fee as a foreign fee and grants the status, or does nothing while it cannot be paid. */
function moveUp(ctx: Ctx, entry: StatusEntry, to: Id<"status">, feeVar: Id<"var"> | null, why: GrantWhy): BaseEvent[] {
  const currency = foreignCurrencyOf(ctx.content, entry.country);
  const amount = feeVar === null ? 0 : worldVar(ctx, feeVar);
  if (!ctx.check({ type: "money/can-pay", currency, amount }).met) return [];
  ctx.apply([{ type: "money/pay-fee", currency, amount, reason: "fee-visa" }], {
    source: entry.id,
    param: to,
    terms: {},
  });
  return grant(ctx, to, null, why, { currency, amount });
}

/** R-STATUS-007: settling at the country's months, then citizenship after the settled status's months. */
function settle(ctx: Ctx): BaseEvent[] {
  const now = currentOf(ctx);
  if (now === null) return [];
  const { held, entry } = now;
  if (entry.countsToSettlement && entry.settled !== null && entry.settleMonthsVar !== null) {
    if (held.lawfulMonths < worldVar(ctx, entry.settleMonthsVar)) return [];
    return moveUp(ctx, entry, entry.settled, entry.settleFeeVar, "settled");
  }
  if (entry.citizen !== null && entry.citizenAfter !== null && held.monthsHeld >= entry.citizenAfter) {
    return moveUp(ctx, entry, entry.citizen, entry.citizenFeeVar, "citizen");
  }
  return [];
}

/** Detection first, so a status that lapses this month is not also found out this month. */
function clocks(ctx: Ctx): BaseEvent[] {
  return [...detect(ctx), ...runClock(ctx), ...expire(ctx), ...settle(ctx)];
}

/** R-STATUS-007: a month held, and a lawful month where the status counts. */
function month(ctx: Ctx): BaseEvent[] {
  const now = currentOf(ctx);
  if (now === null) return [];
  return record(ctx, [{ type: "status/aged", lawful: now.entry.countsToSettlement }]);
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

function judgeIs(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "status/is") throw new Error(`status/is cannot judge ${requirement.type}.`);
  const current = read.state.status.current;
  return { met: current !== null && requirement.statuses.includes(current.entry) };
}

function judgeClockUnder(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "status/clock-under") throw new Error(`status/clock-under cannot judge ${requirement.type}.`);
  const clock = read.state.status.current?.clock ?? null;
  return clock === null ? { met: false, need: requirement.months } : { met: clock < requirement.months, have: clock, need: requirement.months };
}

// ---------------------------------------------------------------------------
// Evolve
// ---------------------------------------------------------------------------

function withCurrent(slice: StatusSlice, event: StatusEvent, change: (held: StatusState) => StatusState): StatusSlice {
  if (slice.current === null) throw new Error(`${event.type} needs a status, and none is held.`);
  return { ...slice, current: change(slice.current) };
}

function evolve(slice: StatusSlice, event: StatusEvent): StatusSlice {
  switch (event.type) {
    case "status/granted":
      return {
        ...slice,
        current: {
          entry: event.status,
          grantedMonth: event.month,
          expiresMonth: event.expiresMonth,
          clock: null,
          lawfulMonths: event.lawfulMonths,
          monthsHeld: 0,
          job: event.job,
        },
      };
    case "status/lapsed":
    case "status/closed":
      return { ...slice, current: null };
    case "status/clock-started":
      return withCurrent(slice, event, (held) => ({ ...held, clock: event.months }));
    case "status/clock-ran":
      return withCurrent(slice, event, (held) => ({ ...held, clock: event.left }));
    case "status/clock-cleared":
      return withCurrent(slice, event, (held) => ({ ...held, clock: null }));
    case "status/renewed":
      return withCurrent(slice, event, (held) => ({ ...held, expiresMonth: event.expiresMonth }));
    case "status/aged":
      return withCurrent(slice, event, (held) => ({
        ...held,
        monthsHeld: held.monthsHeld + 1,
        lawfulMonths: held.lawfulMonths + (event.lawful ? 1 : 0),
      }));
    case "status/removed":
      return { current: null, removals: [...slice.removals, { country: event.country, month: event.month }] };
    default: {
      const never: never = event;
      throw new Error(`Unknown status event ${JSON.stringify(never)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------

function line(key: string, params: ReportLine["params"], tone: ReportLine["tone"], attention: boolean): ReportLine {
  return { key: `line.status.${key}`, params, tone, attention, counts: [] };
}

function grantedLines(event: Extract<StatusEvent, { type: "status/granted" }>): ReportLine[] {
  switch (event.why) {
    case "granted":
      return [line("granted", { status: event.status }, "good", false)];
    case "next":
      return [line("moved-on", { status: event.status }, "good", true)];
    case "settled":
    case "citizen":
      return [line(event.why, event.fee === null ? { status: event.status } : { status: event.status, fee: event.fee }, "good", true)];
    case "lapsed":
      // The lapse line already says where it leaves the character.
      return [];
    default: {
      const never: never = event.why;
      throw new Error(`Unknown grant ${String(never)}.`);
    }
  }
}

function lines(event: StatusEvent): ReportLine[] {
  switch (event.type) {
    case "status/granted":
      return grantedLines(event);
    case "status/lapsed":
      return [line(`lapsed-${event.why}`, { status: event.status }, "bad", true)];
    case "status/clock-started":
      return [line("clock-started", { months: event.months }, "bad", true)];
    case "status/clock-ran":
      return [line("clock-ran", { months: event.left }, "bad", false)];
    case "status/clock-cleared":
      return [line("clock-cleared", {}, "good", false)];
    case "status/renewed":
      return [
        line(
          "renewed",
          { months: event.months, fee: { currency: event.currency, amount: event.fee }, surcharge: { currency: event.currency, amount: event.surcharge } },
          "good",
          false,
        ),
      ];
    case "status/aged":
      // A month on the counter shows in the view; a line each month would only repeat it.
      return [];
    case "status/removed":
      return [line("removed", { country: event.country, months: event.banMonths }, "bad", true)];
    case "status/closed":
      return [line("closed", { status: event.status }, "plain", false)];
    default: {
      const never: never = event;
      throw new Error(`Unknown status event ${JSON.stringify(never)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

/** R-STATUS-010: the text key for the way up from a status. Null when there is none. */
export function nextStepOf(content: Content, entry: StatusEntry): string | null {
  if (entry.citizen !== null) return "status.next.citizen";
  if (entry.countsToSettlement && entry.settled !== null) return "status.next.settle";
  if (entry.next !== null) return "status.next.course";
  if (isOverstayer(content, entry.id)) return "status.next.home";
  if (entry.months !== null) return "status.next.stay";
  return null;
}

function view(read: ReadCtx): Pick<PlayerView, "status"> {
  const current = read.state.status.current;
  if (current === null) return { status: null };
  const entry = statusEntry(read.content, current.entry);
  return {
    status: {
      entry: current.entry,
      monthsLeft: current.expiresMonth === null ? null : Math.max(0, current.expiresMonth - read.state.turn.month),
      clock: current.clock,
      lawfulMonths: current.lawfulMonths,
      settleMonths: entry.settleMonthsVar === null ? null : worldVar(read, entry.settleMonthsVar),
      work: entry.work,
      nextStep: nextStepOf(read.content, entry),
      renew: renewTerms(read, current, entry),
    },
  };
}

/** R-STATUS-010: what `status/renew` would cost today, or null when asking is not how this status renews. */
function renewTerms(read: ReadCtx, held: NonNullable<StatusSlice["current"]>, entry: StatusEntry): NonNullable<PlayerView["status"]>["renew"] {
  if (entry.renewMonths <= 0 || held.expiresMonth === null || entry.renewFeeVar === null) return null;
  // R-STATUS-010: null whenever asking would be refused, so a one-employer status out of its job shows no terms (the same test as `renew`).
  const job = read.state.activity.job;
  if (entry.work === "one-employer" && (job === null || (held.job !== null && held.job !== job))) return null;
  const currency = foreignCurrencyOf(read.content, entry.country);
  const fee = worldVar(read, entry.renewFeeVar);
  const surcharge = entry.surchargeYearVar === null ? 0 : mulDiv(worldVar(read, entry.surchargeYearVar), entry.renewMonths, MONTHS_PER_YEAR);
  return { months: entry.renewMonths, currency, fee, surcharge };
}

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

function invariants(state: State, content: Content): string[] {
  const problems: string[] = [];
  const current = state.status.current;
  if (current !== null) {
    if (content.status[current.entry] === undefined) problems.push(`The status ${current.entry} is not in content.`);
    if (state.place.where !== "abroad") problems.push(`The status ${current.entry} is held while the character is ${state.place.where}.`);
    for (const [name, value] of Object.entries({ lawfulMonths: current.lawfulMonths, monthsHeld: current.monthsHeld, clock: current.clock ?? 0 })) {
      if (!Number.isSafeInteger(value) || value < 0) problems.push(`The status has ${name} ${String(value)}.`);
    }
    if (current.expiresMonth !== null && current.expiresMonth < current.grantedMonth) problems.push(`The status expires before it was granted.`);
  }
  for (const removal of state.status.removals) {
    if (content.country[removal.country] === undefined) problems.push(`A removal names ${removal.country}, which is not a country in content.`);
  }
  return problems;
}

export const statusKind: RegisteredKind<StatusSlice, StatusEvent> = {
  kind: "status",
  initial: () => ({ current: null, removals: [] }),
  commands: { "status/renew": renew },
  effects: {
    "status/grant": grantEffect,
    "status/lose": lose,
    "status/remove": (ctx, _effect, cause) => remove(ctx, cause),
    "status/clock-start": clockStart,
  },
  phases: { clocks, month },
  evolve,
  lines,
  requirements: { "status/is": judgeIs, "status/clock-under": judgeClockUnder },
  invariants,
  view,
};
