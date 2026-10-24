// Status abroad: docs/rules/status.md. One current status,
// held only abroad, with its clocks: expiry, the job clock, settling.
import { worldVar, worldVarOr } from "../engine/check";
import { COUNTRY, STATUS, VAR } from "../engine/ids";
import { BP_WHOLE, convertMinor, mulDiv } from "../engine/int";
import { cardOf, cardsAllowed, reportLines } from "../chapter/chapter.card";
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
  KeptStatusMonths,
  MoneyParam,
  MonthsAway,
  OverstayState,
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
import { officialRates } from "../wallet/wallet.rates";
import type { GrantWhy, LapseWhy, StatusEvent } from "./status.events";

const MONTHS_PER_YEAR = 12;

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
function foreignCurrencyOf(content: Content, country: Id<"country">): ForeignCurrency {
  const { currency } = countryEntry(content, country);
  if (currency === "NGN") throw new Error(`${country} charges in naira, which is no foreign currency.`);
  return currency;
}

/** status:overstayer-risks-detection: the status a lapse ends in. */
export function isOverstayer(content: Content, id: Id<"status">): boolean {
  return countryEntry(content, statusEntry(content, id).country).overstayer === id;
}

/**
 * A settled, citizen or permanent resident status (place:return-shape-decided-at-once, return:papers-return-keeps-status).
 * The contract has no field for it, so it is a status that never
 * expires and is not its country's overstayer.
 */
export function isKept(content: Content, id: Id<"status">): boolean {
  return statusEntry(content, id).months === null && !isOverstayer(content, id);
}

/**
 * return:papers-return-keeps-status: a status that is permission to be in the country for a time and is tied to no job and no course, which a trip
 * home keeps until its end month. The contract has no field for it: it is a status with an end whose work rule is `any`, since a status tied to a job
 * names one employer and the student's is part-time.
 */
export function keptOnTrip(content: Content, id: Id<"status">): boolean {
  const entry = statusEntry(content, id);
  return entry.months !== null && entry.work === "any" && !isOverstayer(content, id);
}

/**
 * return:papers-return-keeps-status: a status whose length is the lead's (person:dependant-status-ends-with-lead) is kept only while the status it depends
 * on is held: a bond at `partner` or `married` whose facts show the other in the status's country on a status that is not its overstayer.
 */
export function leadStillHolds(read: ReadCtx, id: Id<"status">): boolean {
  const entry = statusEntry(read.content, id);
  if (entry.months !== "lead") return true;
  return Object.values(read.state.people.bonds).some((bond) => {
    const facts = bond.facts;
    if ((bond.stage !== "partner" && bond.stage !== "married") || facts === null) return false;
    return facts.where === "abroad" && facts.country === entry.country && facts.status !== null && read.content.status[facts.status] !== undefined && !isOverstayer(read.content, facts.status);
  });
}

/**
 * place:return-shape-decided-at-once and return:papers-return-keeps-status: the status a return made this month would keep, or null. A settled, citizen or
 * resident status always; one a trip home keeps while it has months left and, for a dependant's, while the lead's holds.
 */
export function keptByReturn(read: ReadCtx): Id<"status"> | null {
  const current = read.state.status.current;
  if (current === null) return null;
  if (isKept(read.content, current.entry)) return current.entry;
  if (!keptOnTrip(read.content, current.entry)) return null;
  const monthsLeft = current.expiresMonth === null || current.expiresMonth > read.state.turn.month;
  return monthsLeft && leadStillHolds(read, current.entry) ? current.entry : null;
}

/**
 * status:absence-breaks-settlement: the most months at home inside any run of `window` months, the spans read as months from `from` up to `to`. The
 * most is found in a window that starts where a span starts or ends where a span ends.
 */
export function mostAwayInWindow(spans: readonly MonthsAway[], window: number): number {
  const starts = spans.flatMap((span) => [span.from, span.to - window]);
  let most = 0;
  for (const start of starts) {
    const end = start + window;
    const away = spans.reduce((sum, span) => sum + Math.max(0, Math.min(span.to, end) - Math.max(span.from, start)), 0);
    most = Math.max(most, away);
  }
  return most;
}

/** status:absence-breaks-settlement: the spans that may still share a window with months to come; older ones can no longer count. */
function stillInWindow(spans: readonly MonthsAway[], month: number, window: number): MonthsAway[] {
  return spans.filter((span) => span.to > month - window);
}

/**
 * return:papers-return-keeps-status and status:absence-breaks-settlement: what a kept status carries back on a flight in `month`. Its months at home add
 * no lawful months; for a status with an end that counts toward settlement (the Canadian resident's absence is read by its own rule), `absenceMonths` or
 * more at home inside any `absenceWindowMonths` set the lawful months back to 0 and start the record of time away again. A settled status's months
 * toward citizenship count only months in the country, so they carry back as they were.
 */
export function keptForFlight(read: ReadCtx, token: { status: Id<"status">; sinceMonth: number } & KeptStatusMonths, month: number): KeptStatusMonths {
  const { status, sinceMonth, ...months } = token;
  const entry = statusEntry(read.content, status);
  if (!entry.countsToSettlement || entry.months === null) return months;
  const { absenceMonths, absenceWindowMonths } = read.content.tuning.status;
  const spans = [...(months.away ?? []), { from: sinceMonth, to: month }];
  if (mostAwayInWindow(spans, absenceWindowMonths) >= absenceMonths) {
    return { monthsHeld: months.monthsHeld, lawfulMonths: 0, ...(months.expiresMonth === undefined ? {} : { expiresMonth: months.expiresMonth }), ...(months.settleMonths === undefined ? {} : { settleMonths: months.settleMonths }) };
  }
  const kept = stillInWindow(spans, month, absenceWindowMonths);
  return { ...months, ...(kept.length === 0 ? {} : { away: kept }) };
}

/** return:papers-return-keeps-status: what the status held now carries home to be kept, with the months away still inside the window. */
export function keptMonthsOf(read: ReadCtx, held: StatusState): KeptStatusMonths {
  const away = stillInWindow(held.away ?? [], read.state.turn.month, read.content.tuning.status.absenceWindowMonths);
  return {
    monthsHeld: held.monthsHeld,
    lawfulMonths: held.lawfulMonths,
    ...(held.expiresMonth === null ? {} : { expiresMonth: held.expiresMonth }),
    ...(held.settleMonths === undefined ? {} : { settleMonths: held.settleMonths }),
    ...(away.length === 0 ? {} : { away }),
  };
}

/**
 * status:status-sets-work-rule, for the activity kind: whether the current status lets the
 * character hold this job. At home, with no status, it says yes. A
 * `one-employer` status allows the job it names and, by ladders:sponsor-job-ties-status, any job
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
      // status:grace-allows-in-country-applications, ladders:sponsor-job-ties-status: in the grace a sponsor's job may be hunted too.
      return job.cash === true || (job.sponsor === true && inGrace(read));
    case "none":
      return false;
    default: {
      const never: never = work;
      throw new Error(`Unknown work rule ${String(never)}.`);
    }
  }
}

/**
 * status:gulf-status-holds-passport, for the route kind: the employer holds the passport while a
 * status that says so is current. Nothing is applied to the document kind; a
 * route that needs the passport reads this.
 */
export function passportHeldByEmployer(read: ReadCtx): boolean {
  const current = read.state.status.current;
  return current !== null && statusEntry(read.content, current.entry).holdsPassport;
}

/** status:course-passed-or-withdrawn: held long enough, and no tuition obligation has gone into default. */
export function coursePassed(read: ReadCtx): boolean {
  const current = read.state.status.current;
  if (current === null || current.monthsHeld < read.content.tuning.status.courseMonths) return false;
  return !Object.values(read.state.obligation.items).some(
    (item) => item.state === "defaulted" && read.content.obligation[item.entry]?.type === "tuition",
  );
}

/** The ban on the country's routes after a removal, in months: the country's overstayer's figure (place:removal-bans-the-country). */
export function removalBanMonths(content: Content, country: Id<"country">): number {
  const overstayer = countryEntry(content, country).overstayer;
  return overstayer === null ? 0 : statusEntry(content, overstayer).banMonths;
}

/**
 * status:overstayer-risks-detection: the overstay's stages on the current status, or null on any other. A state written before
 * the stages were kept reads its overstay as beginning the month the status was granted.
 */
export function overstayOf(read: ReadCtx): { entry: StatusEntry; overstay: OverstayState } | null {
  const held = read.state.status.current;
  if (held === null || !isOverstayer(read.content, held.entry)) return null;
  const entry = statusEntry(read.content, held.entry);
  return { entry, overstay: held.overstay ?? freshOverstay(entry, held.grantedMonth) };
}

/**
 * status:grace-before-overstaying: the grace is `graceMonths` played months, the lapse's own month the first, so it ends the month before
 * `since` plus them. A lapse in the `clocks` phase comes after `spend` has moved the month on, so `since` is the month about to be played;
 * a grace of none ends before it, and Italy's road arrival is past its grace from the month it lands.
 */
function freshOverstay(entry: StatusEntry, month: number): OverstayState {
  return { since: month, graceUntil: month + (entry.graceMonths ?? 0) - 1, noticeUntil: null, fine: 0 };
}

/** status:grace-before-overstaying: on an overstayer status, through the last month of its grace. */
export function inGrace(read: ReadCtx): boolean {
  const now = overstayOf(read);
  return now !== null && read.state.turn.month <= now.overstay.graceUntil;
}

/** status:grace-before-overstaying: on an overstayer status, past its grace: the overstay itself. */
export function pastGrace(read: ReadCtx): boolean {
  const now = overstayOf(read);
  return now !== null && read.state.turn.month > now.overstay.graceUntil;
}

/** status:uae-amnesty: the amnesty holds for the UAE's irregular status. */
export function amnestyHolds(read: ReadCtx, status: Id<"status">): boolean {
  return status === STATUS.uaeIrregular && worldVarOr(read.world, VAR.uaeAmnesty) === 1;
}

/**
 * status:grace-allows-in-country-applications, person:partner-route-in-country: an application made from inside the country the character is in,
 * still waiting for its answer. Sent in `sentBy` or before, when given.
 */
export function pendingInCountry(read: ReadCtx, sentBy: number | null = null): boolean {
  const { country } = read.state.place;
  return Object.entries(read.state.route).some(([id, held]) => {
    const visa = held.visa;
    if (held.state !== "applying" || visa === null || visa.inCountry !== true) return false;
    if (sentBy !== null && visa.submittedMonth > sentBy) return false;
    return read.content.route[id as Id<"route">]?.country === country;
  });
}

/** An application into the country the character is in was refused this month (status:notice-ends-in-removal, status:grace-before-overstaying). */
function refusedHereThisMonth(read: ReadCtx): boolean {
  const { country } = read.state.place;
  const month = read.state.turn.month;
  return Object.entries(read.state.route).some(([id, held]) => held.lastRefusal?.month === month && read.content.route[id as Id<"route">]?.country === country);
}

/** status:overstayer-hospital-charged: what share of the hospital's figure the character pays, in basis points. */
export function hospitalShareBp(read: ReadCtx): number {
  const now = overstayOf(read);
  if (now === null || now.entry.country !== COUNTRY.uk || !pastGrace(read)) return BP_WHOLE;
  return read.content.tuning.status.hospitalChargeBp;
}

/** The fine owed on the UAE's irregular status, in fils, 0 elsewhere or while the amnesty holds (status:uae-fine-accrues, status:uae-amnesty). */
export function fineOwed(read: ReadCtx): number {
  const now = overstayOf(read);
  if (now === null || amnestyHolds(read, now.entry.id)) return 0;
  return now.overstay.fine;
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
  // person:dependant-status-ends-with-lead: a dependant's status ends when the lead's does, read from the lead's facts.
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

/** status:granting-a-status: the status held, if any, is replaced. */
function grant(
  ctx: Ctx,
  status: Id<"status">,
  job: Id<"activity"> | null,
  why: GrantWhy,
  fee: MoneyParam | null,
  kept: KeptStatusMonths | null = null,
): BaseEvent[] {
  const entry = statusEntry(ctx.content, status);
  const month = ctx.state.turn.month;
  // return:papers-return-keeps-status: a kept status keeps its own end month, which ran on while the character was home.
  const length = kept?.expiresMonth !== undefined ? kept.expiresMonth - month : lengthOf(ctx, entry);
  const before = ctx.state.status.current;
  // person:partner-route-in-country: a status that settles, granted over an overstay past its grace, is on the ten-year route.
  const tenYears = entry.countsToSettlement && pastGrace(ctx);
  const events = record(ctx, [
    {
      type: "status/granted",
      status,
      month,
      expiresMonth: length === null ? null : month + length,
      lawfulMonths: kept !== null ? kept.lawfulMonths : entry.countsFromBefore && before !== null ? before.lawfulMonths : 0,
      monthsHeld: kept?.monthsHeld ?? 0,
      job,
      why,
      fee,
      ...(isOverstayer(ctx.content, status) ? { overstay: freshOverstay(entry, month) } : {}),
      ...(tenYears ? { settleMonths: ctx.content.tuning.status.overstayPartnerSettleMonths } : kept?.settleMonths !== undefined ? { settleMonths: kept.settleMonths } : {}),
      ...(kept?.away === undefined ? {} : { away: kept.away }),
    },
  ]);
  housing(ctx, before?.entry ?? null, status);
  return events;
}

/** status:overstayer-risks-detection: the status goes and the country's overstayer status takes its place. */
function lapse(ctx: Ctx, why: LapseWhy): BaseEvent[] {
  const now = currentOf(ctx);
  if (now === null) return [];
  const events = record(ctx, [{ type: "status/lapsed", status: now.held.entry, why }]);
  const overstayer = countryEntry(ctx.content, now.entry.country).overstayer;
  if (overstayer !== null) events.push(...grant(ctx, overstayer, null, "lapsed", null));
  housing(ctx, now.held.entry, overstayer);
  // route:lapsed-route-known-again: the permission is gone, so a route into the country that was flown is known again.
  ctx.apply([{ type: "route/lapse", country: now.entry.country }], { source: now.held.entry, param: null, terms: {} });
  return events;
}

function grantEffect(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "status/grant") throw new Error(`status/grant cannot carry out ${effect.type}.`);
  return grant(ctx, effect.status, effect.job ?? null, "granted", null, effect.kept ?? null);
}

/**
 * Abroad a lost status lapses (abroad-money:tuition-paid-in-instalments withdraws a student this way).
 * At home the same effect closes the status with nothing after it,
 * which is how a return closes every status (place:return-home-paid-or-assisted).
 */
function lose(ctx: Ctx): BaseEvent[] {
  const now = currentOf(ctx);
  if (now === null) return [];
  if (ctx.state.place.where !== "abroad") return record(ctx, [{ type: "status/closed", status: now.held.entry }]);
  if (isOverstayer(ctx.content, now.held.entry)) return [];
  return lapse(ctx, "lost");
}

/** status:lost-job-starts-clock; status:gulf-status-holds-passport lapses a status that goes with the job at once. */
function clockStart(ctx: Ctx): BaseEvent[] {
  const now = currentOf(ctx);
  if (now === null) return [];
  if (now.entry.lapsesAtOnce) return lapse(ctx, "job");
  if (now.entry.clockMonths === null || now.held.clock !== null) return [];
  return record(ctx, [{ type: "status/clock-started", months: now.entry.clockMonths }]);
}

/**
 * status:removal-sends-home-banned. The ban on the country's routes is not applied as an
 * effect, since the contract has none; the route kind reads `status.removals`
 * with `removalBanMonths` and `place.returns` (place:removal-bans-the-country).
 */
function remove(ctx: Ctx, cause: Cause): BaseEvent[] {
  const { where, country } = ctx.state.place;
  if (where !== "abroad" || country === null) return [];
  const fine = fineOwed(ctx);
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
  carryFineHome(ctx, country, fine);
  return events;
}

/** The UAE's fine left owing on a removal or an assisted return follows the character home (status:uae-fine-accrues). */
const FINE_HOME: Id<"obligation"> = "obligation.uae-fine-home";

/**
 * status:uae-fine-accrues, return:return-reopens-home-charges: a fine left owing opens at home as a debt in naira at the day's official rate. It is
 * the fine taken over, never money lent, so the debt is opened under its own name and credits nothing.
 */
export function carryFineHome(ctx: Ctx, country: Id<"country">, fine: number): void {
  if (fine <= 0 || ctx.content.obligation[FINE_HOME] === undefined) return;
  const naira = convertMinor(fine, countryEntry(ctx.content, country).currency, "NGN", officialRates(ctx.world));
  ctx.apply([{ type: "obligation/open", obligation: FINE_HOME, principal: naira }], { source: FINE_HOME, param: null, terms: {} });
}

// ---------------------------------------------------------------------------
// The command
// ---------------------------------------------------------------------------

/**
 * person:partner-status-renews: a status tied to a partner renews only while a bond is at
 * `partner` or `married` and its facts show `meetsFloor` for each partner route
 * granting this status that has a floor.
 */
function partnerStillSponsors(read: ReadCtx, status: Id<"status">): boolean {
  const routes = Object.values(read.content.route).filter((route) => route.status === status && route.partner !== undefined && route.partner.floorVar !== null);
  return Object.values(read.state.people.bonds).some(
    (bond) => (bond.stage === "partner" || bond.stage === "married") && routes.every((route) => bond.facts?.meetsFloor[route.id] === true),
  );
}

/**
 * status:one-renewability-test: why asking to renew the held status would be refused, or null when it would be taken (cost aside).
 * The command and the view's terms both read it, so terms show only where the renewal is legal.
 */
function renewRefusal(read: ReadCtx, held: NonNullable<StatusSlice["current"]>, entry: StatusEntry): string | null {
  if (entry.renewMonths <= 0 || held.expiresMonth === null) return `${held.entry} does not renew.`;
  // status:renewing-a-status: a status the employer renews (`renewBp`, no fee var) is never renewed at the player's asking.
  if (entry.renewFeeVar === null) return `${held.entry} renews only by the employer's choice.`;
  const job = read.state.activity.job;
  if (entry.work === "one-employer" && (job === null || (held.job !== null && held.job !== job))) return `${held.entry} renews only while the job is held.`;
  if (entry.tiedTo === "partner" && !partnerStillSponsors(read, entry.id)) return `${held.entry} renews only while the bond holds and the sponsor meets the floor.`;
  return null;
}

/** status:renewing-a-status, status:one-renewability-test. */
function renew(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "status/renew") throw new Error(`status/renew cannot handle ${command.type}.`);
  // person:stand-in-acts-narrowly: a stand-in never spends.
  if (ctx.sender === "stand-in") return reject("not-legal", "A stand-in never spends.");
  const now = currentOf(ctx);
  if (now === null) return reject("not-legal", "No status is held.");
  const { held, entry } = now;
  const refused = renewRefusal(ctx, held, entry);
  if (refused !== null || held.expiresMonth === null || entry.renewFeeVar === null) return reject("not-legal", refused ?? `${held.entry} does not renew.`);
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

/**
 * The overstay's month in the `clocks` phase, in the rules' order: an application made in country holds the grace and the notice
 * (status:grace-before-overstaying, status:notice-ends-in-removal); a notice at its end removes (status:notice-ends-in-removal); past the grace and with no
 * notice, nothing pending and no amnesty, detection is drawn and gives a notice (status:overstayer-risks-detection, status:detection-gives-notice,
 * status:uae-amnesty); then the landlord's check, drawn after detection on the same stream (abroad-money:right-to-rent-check, decision 0028); then the fine (status:uae-fine-accrues).
 */
function overstayMonth(ctx: Ctx): BaseEvent[] {
  const now = overstayOf(ctx);
  if (now === null) return [];
  const month = ctx.state.turn.month;
  const events: BaseEvent[] = [];
  const refused = refusedHereThisMonth(ctx);
  const { graceUntil, noticeUntil } = now.overstay;
  if (graceUntil === month - 1 && (refused || pendingInCountry(ctx, graceUntil))) events.push(...record(ctx, [{ type: "status/grace-held", graceUntil: month }]));
  if (noticeUntil !== null && noticeUntil <= month && (refused || pendingInCountry(ctx))) events.push(...record(ctx, [{ type: "status/notice-held", noticeUntil: month + 1 }]));
  const held = overstayOf(ctx);
  if (held === null) return events;
  if (held.overstay.noticeUntil !== null && held.overstay.noticeUntil <= month) return [...events, ...remove(ctx, { source: held.entry.id, param: null, terms: {} })];
  if (!pastGrace(ctx)) return events;
  events.push(...detect(ctx, held.entry, held.overstay));
  events.push(...rentCheck(ctx, held.entry));
  const perMonth = held.entry.finePerMonth ?? 0;
  if (perMonth > 0) events.push(...record(ctx, [{ type: "status/fined", amount: perMonth }]));
  return events;
}

/** status:overstayer-risks-detection, status:detection-gives-notice and ladders:cash-jobs-paid-in-hand: cash work this month raises the chance, and a hit gives a notice. */
function detect(ctx: Ctx, entry: StatusEntry, overstay: OverstayState): BaseEvent[] {
  if (overstay.noticeUntil !== null || pendingInCountry(ctx) || amnestyHolds(ctx, entry.id)) return [];
  const cash = cashWorkedThisMonth(ctx);
  const chance = entry.detectBp + (cash ? ctx.content.tuning.ladder.cashDetectBp : 0);
  if (!ctx.random.chance("status", chance)) return [];
  const months = entry.noticeMonths ?? 0;
  return record(ctx, [{ type: "status/noticed", country: entry.country, noticeUntil: ctx.state.turn.month + months, months }]);
}

/** abroad-money:right-to-rent-check: the room let with no papers asked, which the check never reaches. */
const CASH_ROOM: Id<"obligation"> = "obligation.rent-cash-room-uk";

/**
 * abroad-money:right-to-rent-check: while the room is the country's shared room or a flat in the character's name, the landlord's check is drawn. On it the room
 * closes with nothing owed, under the room's own name so a flat's deposit is kept as on an eviction, and the room with no papers opens.
 */
function rentCheck(ctx: Ctx, entry: StatusEntry): BaseEvent[] {
  const chance = entry.rentCheckBp ?? 0;
  if (chance <= 0) return [];
  const { rentRoom, rentFlat } = countryEntry(ctx.content, entry.country);
  const room = Object.values(ctx.state.obligation.items).find((item) => item.entry === rentRoom || item.entry === rentFlat);
  if (room === undefined) return [];
  if (!ctx.random.chance("status", chance)) return [];
  const events = record(ctx, [{ type: "status/rent-checked" }]);
  ctx.apply([{ type: "obligation/close", obligationType: "rent" }], { source: room.entry, param: null, terms: {} });
  ctx.apply(
    [
      { type: "obligation/open", obligation: CASH_ROOM },
      { type: "quality/add", quality: "quality.wellbeing", amount: ctx.content.tuning.status.rentCheckWellbeing },
    ],
    { source: entry.id, param: null, terms: {} },
  );
  return events;
}

/** status:lost-job-starts-clock: the clock runs a month at a time and lapses the status at zero, unless an allowed job is held again. */
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
 * status:expiry-lapses-or-moves-on and status:course-passed-or-withdrawn. The course rule is read for any status that
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

/** status:lawful-months-reach-settlement, person:partner-route-in-country: the months to settle, the ten-year route's where the status carries it. */
function settleMonthsOf(read: ReadCtx, held: StatusState, settleVar: Id<"var">): number {
  return held.settleMonths ?? worldVar(read, settleVar);
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

/** status:lawful-months-reach-settlement: settling at the country's months, then citizenship after the settled status's months. */
function settle(ctx: Ctx): BaseEvent[] {
  const now = currentOf(ctx);
  if (now === null) return [];
  const { held, entry } = now;
  if (entry.countsToSettlement && entry.settled !== null && entry.settleMonthsVar !== null) {
    if (held.lawfulMonths < settleMonthsOf(ctx, held, entry.settleMonthsVar)) return [];
    return moveUp(ctx, entry, entry.settled, entry.settleFeeVar, "settled");
  }
  if (entry.citizen !== null && entry.citizenAfter !== null && held.monthsHeld >= entry.citizenAfter) {
    return moveUp(ctx, entry, entry.citizen, entry.citizenFeeVar, "citizen");
  }
  return [];
}

/**
 * status:renewing-a-status: in the contract's last month the employer renews a status
 * whose entry has `renewBp`, on the `status` stream, for no fee. A lost draw
 * leaves it to lapse the month after.
 */
function employerRenew(ctx: Ctx): BaseEvent[] {
  const now = currentOf(ctx);
  if (now === null) return [];
  const { held, entry } = now;
  if (entry.renewBp === undefined || entry.renewMonths <= 0 || held.expiresMonth === null) return [];
  if (ctx.state.turn.month !== held.expiresMonth - 1) return [];
  if (!ctx.random.chance("status", entry.renewBp)) return [];
  return record(ctx, [{ type: "status/employer-renewed", status: held.entry, expiresMonth: held.expiresMonth + entry.renewMonths, months: entry.renewMonths }]);
}

/** The overstay first, so a status that lapses this month is not also found out this month. */
function clocks(ctx: Ctx): BaseEvent[] {
  return [...overstayMonth(ctx), ...runClock(ctx), ...employerRenew(ctx), ...expire(ctx), ...settle(ctx)];
}

/** status:lawful-months-reach-settlement: a month held, and a lawful month where the status counts. */
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
  // status:grace-allows-in-country-applications: with `grace`, the status must also be in an overstay's grace.
  return { met: current !== null && requirement.statuses.includes(current.entry) && (requirement.grace !== true || inGrace(read)) };
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

/** An overstay's stages changed; a state that kept none reads it from the month the status was granted. */
function withOverstay(slice: StatusSlice, event: StatusEvent, change: (overstay: OverstayState) => OverstayState): StatusSlice {
  return withCurrent(slice, event, (held) => ({ ...held, overstay: change(held.overstay ?? { since: held.grantedMonth, graceUntil: held.grantedMonth, noticeUntil: null, fine: 0 }) }));
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
          monthsHeld: event.monthsHeld,
          job: event.job,
          ...(event.overstay === undefined ? {} : { overstay: event.overstay }),
          ...(event.settleMonths === undefined ? {} : { settleMonths: event.settleMonths }),
          ...(event.away === undefined ? {} : { away: event.away }),
        },
      };
    case "status/grace-held":
      return withOverstay(slice, event, (overstay) => ({ ...overstay, graceUntil: event.graceUntil }));
    case "status/noticed":
    case "status/notice-held":
      return withOverstay(slice, event, (overstay) => ({ ...overstay, noticeUntil: event.noticeUntil }));
    case "status/fined":
      return withOverstay(slice, event, (overstay) => ({ ...overstay, fine: overstay.fine + event.amount }));
    case "status/rent-checked":
      return slice;
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
    case "status/employer-renewed":
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

/** share:cards-due-at-set-moments: the secured card through the month after settlement or citizenship is granted (status:lawful-months-reach-settlement). */
export function securedCard(read: ReadCtx): PlayerView["card"] {
  if (!cardsAllowed(read)) return null;
  const secured = [...reportLines(read, "line.status.settled"), ...reportLines(read, "line.status.citizen")];
  return secured.length === 0 ? null : cardOf(read, "secured");
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
    case "status/employer-renewed":
      return [line("employer-renewed", { status: event.status, months: event.months }, "good", true)];
    case "status/aged":
      // A month on the counter shows in the view; a line each month would only repeat it.
      return [];
    case "status/removed":
      return [line("removed", { country: event.country, months: event.banMonths }, "bad", true)];
    case "status/closed":
      return [line("closed", { status: event.status }, "plain", false)];
    case "status/noticed":
      return [line("noticed", { country: event.country, months: event.months }, "bad", true)];
    case "status/rent-checked":
      return [line("rent-checked", {}, "bad", true)];
    // The grace and the notice held, and the fine, show in the view (status:view-shows-status); a line each month would only repeat it.
    case "status/grace-held":
    case "status/notice-held":
    case "status/fined":
      return [];
    default: {
      const never: never = event;
      throw new Error(`Unknown status event ${JSON.stringify(never)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

/** status:view-shows-status: the text key for the way up from a status. Null when there is none. */
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
      settleMonths: entry.settleMonthsVar === null ? null : settleMonthsOf(read, current, entry.settleMonthsVar),
      work: entry.work,
      nextStep: nextStepOf(read.content, entry),
      renew: renewTerms(read, current, entry),
      overstay: overstayView(read),
    },
  };
}

/** status:view-shows-status: the overstay's stages as the screens say them; never the detection chance. */
function overstayView(read: ReadCtx): NonNullable<PlayerView["status"]>["overstay"] {
  const now = overstayOf(read);
  if (now === null) return null;
  const month = read.state.turn.month;
  const { graceUntil, noticeUntil } = now.overstay;
  const currency = countryEntry(read.content, now.entry.country).currency;
  return {
    // The month in play is still grace through `graceUntil` (inGrace), so it counts: 1 in the grace's last month.
    graceLeft: Math.max(0, graceUntil - month + 1),
    noticeLeft: noticeUntil === null ? null : Math.max(0, noticeUntil - month),
    fine: (now.entry.finePerMonth ?? 0) > 0 ? { currency, amount: fineOwed(read) } : null,
    pending: pendingInCountry(read),
  };
}

/** status:view-shows-status, status:one-renewability-test: what `status/renew` would cost today, or null wherever `renew` would refuse it. */
function renewTerms(read: ReadCtx, held: NonNullable<StatusSlice["current"]>, entry: StatusEntry): NonNullable<PlayerView["status"]>["renew"] {
  if (renewRefusal(read, held, entry) !== null || entry.renewFeeVar === null) return null;
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
