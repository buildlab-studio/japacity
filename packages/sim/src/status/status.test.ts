import { content, text } from "@japacity/content";
import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import { check } from "../engine/check";
import { checkInvariants } from "../engine/invariants";
import type { Registry } from "../engine/kind";
import type { ActivityEntry, BaseEvent, Content, Ctx, Id, ReadCtx, ReportLine, StatusEntry } from "../engine/types";
import { hiddenPaths } from "../engine/view";
import { registry } from "../kinds";
import { flown, playMonths } from "../testing/place.journey";
import { answerFirst, applyEffects } from "../testing/route.journey";
import type { LifeOptions } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { readOf } from "../testing/read";
import { coursePassed, isKept, isOverstayer, nextStepOf, passportHeldByEmployer, workAllows } from "./status.logic";
import { UK_GRADUATE, JUNIOR_DEV, OVERSTAYER, SETTLED, SPONSORED, STUDENT, UK_COUNTRY } from "../testing/ids";

const CITIZEN: Id<"status"> = "status.uk-citizen";
const GULF: Id<"status"> = "status.gulf-worker";

const entryOf = (id: Id<"status">): StatusEntry => content.status[id]!;

function current(game: Game) {
  const held = game.state.status.current;
  if (held === null) throw new Error("No status is held.");
  return held;
}

function statusLines(lines: ReportLine[]): ReportLine[] {
  return lines.filter((line) => line.key.startsWith("line.status."));
}

/** The real registry with quitting a job always starting the status clock (ladders:sponsor-job-ties-status); the activity kind starts it only for a job of the country on a one-employer status. */
function quitStartsClock(): Registry {
  return registry().map((kind) => {
    const quit = kind.commands?.["activity/quit"];
    if (kind.kind !== "activity" || quit === undefined) return kind;
    return {
      ...kind,
      commands: {
        ...kind.commands,
        "activity/quit": (ctx: Ctx, command) => {
          const result = quit(ctx, command);
          if (!Array.isArray(result)) return result;
          const events: BaseEvent[] = [...result, ...ctx.apply([{ type: "status/clock-start" }], { source: "test", param: null, terms: {} })];
          return events;
        },
      },
    };
  });
}

/** The developer, flown on the study route and then given a sponsored worker's status for its old job, which it holds again. */
function sponsored(options: LifeOptions = {}): Game {
  const game = flown(content, { from: "scenario.developer", ...options });
  applyEffects(game, [{ type: "obligation/close", obligationType: "tuition" }, { type: "status/grant", status: SPONSORED, job: JUNIOR_DEV }, { type: "activity/start-job", job: JUNIOR_DEV }]);
  return game;
}

function totalOut(game: Game, reason: "fee-visa" | "fee-surcharge"): number {
  return game.state.wallet.totals.out[reason]?.GBP ?? 0;
}

describe("granting a status", () => {
  test("[status:granting-a-status] given a granted study route, when the character departs, then the student status opens for its months with no clock and nothing held or counted", () => {
    const game = flown(content);
    const month = game.state.turn.month;
    expect(game.state.status.current).toEqual({ entry: STUDENT, grantedMonth: month, expiresMonth: month + 16, clock: null, lawfulMonths: 0, monthsHeld: 0, job: null });
    expect(checkInvariants(game.state, game.content)).toEqual([]);
  });

  test("[status:granting-a-status] given a status that counts from before, when it replaces one, then the lawful months carry over; one that does not starts again at 0", () => {
    const game = sponsored({ vars: () => ({ "var.uk-settle-months": 100 }) });
    playMonths(game, 3);
    expect(current(game).lawfulMonths).toBe(3);
    applyEffects(game, [{ type: "status/grant", status: SETTLED }]);
    expect(current(game)).toMatchObject({ entry: SETTLED, lawfulMonths: 3, expiresMonth: null, monthsHeld: 0 });
    applyEffects(game, [{ type: "status/grant", status: STUDENT }]);
    expect(current(game)).toMatchObject({ entry: STUDENT, lawfulMonths: 0 });
  });

  test("[status:granting-a-status] given a status whose months are a world variable, when it is granted, then it runs for the variable's value that day", () => {
    const game = flown(content, { vars: () => ({ "var.uk-graduate-months": 18 }) });
    applyEffects(game, [{ type: "status/grant", status: UK_GRADUATE }]);
    expect(current(game).expiresMonth).toBe(game.state.turn.month + 18);
  });
});

describe("what a status lets you work at", () => {
  const job = (fields: Partial<ActivityEntry>): ActivityEntry => ({ ...content.activity["activity.job-clerk"]!, ...fields });

  test("[status:status-sets-work-rule] given each work rule, when a job is judged, then any allows all, part only part jobs, cash only cash jobs, one-employer the named job or a sponsor's, none nothing", () => {
    const game = flown(content);
    const read = (status: Id<"status">, held: Id<"activity"> | null = null): ReadCtx => ({
      ...readOf(game),
      state: { ...game.state, status: { ...game.state.status, current: { ...current(game), entry: status, job: held } } },
    });
    const plain = job({});
    const part = job({ part: true });
    const cash = job({ cash: true });
    const named = job({ id: JUNIOR_DEV });
    const sponsorJob = job({ sponsor: true });
    expect([plain, part, cash].map((entry) => workAllows(read(UK_GRADUATE), entry))).toEqual([true, true, true]);
    expect([plain, part, cash].map((entry) => workAllows(read(STUDENT), entry))).toEqual([false, true, false]);
    expect([plain, part, cash].map((entry) => workAllows(read(OVERSTAYER), entry))).toEqual([false, false, true]);
    expect([plain, named, sponsorJob].map((entry) => workAllows(read(SPONSORED, JUNIOR_DEV), entry))).toEqual([false, true, true]);
    const none: Content = { ...content, status: { ...content.status, [UK_GRADUATE]: { ...entryOf(UK_GRADUATE), work: "none" } } };
    expect(workAllows({ ...read(UK_GRADUATE), content: none }, part)).toBe(false);
    // At home there is no status and nothing to obey.
    expect(workAllows({ ...readOf(game), state: { ...game.state, status: { ...game.state.status, current: null } } }, plain)).toBe(true);
  });
});

describe("the sponsored worker's clock", () => {
  test("[status:lost-job-starts-clock] given a sponsored worker, when the job goes, then the clock starts at two months, runs one a month, and at zero the status lapses to the overstayer", () => {
    const game = sponsored({ kinds: quitStartsClock() });
    const quit = game.accept({ type: "activity/quit" });
    expect(current(game).clock).toBe(entryOf(SPONSORED).clockMonths);
    expect(statusLines(quit.lines)).toEqual([{ key: "line.status.clock-started", params: { months: 2 }, tone: "bad", attention: true, counts: [] }]);
    expect(check(readOf(game), { type: "status/clock-under", months: 2 }).met).toBe(false);
    expect(check(readOf(game), { type: "status/clock-under", months: 3 })).toEqual({ met: true, have: 2, need: 3 });
    playMonths(game, 1);
    expect(current(game)).toMatchObject({ entry: SPONSORED, clock: 1 });
    expect(check(readOf(game), { type: "status/clock-under", months: 2 }).met).toBe(true);
    const last = game.endTurn();
    expect(current(game)).toMatchObject({ entry: OVERSTAYER, clock: null, expiresMonth: null });
    expect(statusLines(last.lines)).toContainEqual({ key: "line.status.lapsed-clock", params: { status: SPONSORED }, tone: "bad", attention: true, counts: [] });
    expect(check(readOf(game), { type: "status/clock-under", months: 2 }).met).toBe(false);
  });

  test("[status:lost-job-starts-clock] given a running clock, when a job the status allows is held again, then the clock stops at the next month end", () => {
    const game = sponsored({ kinds: quitStartsClock() });
    game.accept({ type: "activity/quit" });
    applyEffects(game, [{ type: "activity/start-job", job: JUNIOR_DEV }]);
    const result = game.endTurn();
    expect(current(game)).toMatchObject({ entry: SPONSORED, clock: null });
    expect(statusLines(result.lines)).toContainEqual({ key: "line.status.clock-cleared", params: {}, tone: "good", attention: false, counts: [] });
  });

  test("[status:lost-job-starts-clock] given a status with no clock, when the job goes, then nothing starts", () => {
    const game = flown(content);
    applyEffects(game, [{ type: "status/clock-start" }]);
    expect(current(game)).toMatchObject({ entry: STUDENT, clock: null });
  });
});

describe("expiry and the next status", () => {
  test("[status:expiry-lapses-or-moves-on] given a student, when 16 months pass, then the status becomes the graduate status for the graduate months, not a month before", () => {
    const game = flown(content);
    const start = game.state.turn.month;
    playMonths(game, 15);
    expect(current(game).entry).toBe(STUDENT);
    playMonths(game, 1);
    // The graduate months are the world's var on the day (a story may have shortened them).
    expect(current(game)).toMatchObject({ entry: UK_GRADUATE, grantedMonth: start + 16, expiresMonth: start + 16 + game.world().vars["var.uk-graduate-months"]! });
  });

  test("[status:expiry-lapses-or-moves-on] given the graduate route closed (its months at 0), when the student status runs out, then it lapses instead", () => {
    const game = flown(content, { vars: () => ({ "var.uk-graduate-months": 0 }) });
    playMonths(game, 16);
    expect(current(game).entry).toBe(OVERSTAYER);
  });

  test("[status:expiry-lapses-or-moves-on] given a graduate with no next status, when the months run out, then the status lapses", () => {
    const game = flown(content, { vars: () => ({ "var.uk-graduate-months": 2 }) });
    applyEffects(game, [{ type: "status/grant", status: UK_GRADUATE }]);
    playMonths(game, 1);
    expect(current(game).entry).toBe(UK_GRADUATE);
    playMonths(game, 1);
    expect(current(game).entry).toBe(OVERSTAYER);
  });
});

describe("the overstayer", () => {
  const sure: (used: Content) => Content = (used) => ({ ...used, status: { ...used.status, [OVERSTAYER]: { ...used.status[OVERSTAYER]!, detectBp: 10000 } } });
  const never: (used: Content) => Content = (used) => ({ ...used, status: { ...used.status, [OVERSTAYER]: { ...used.status[OVERSTAYER]!, detectBp: 0 } } });

  test("[status:overstayer-risks-detection] given a lapse, when it happens, then the country's overstayer status follows: cash work only, no expiry", () => {
    const game = flown(content);
    applyEffects(game, [{ type: "status/lose" }]);
    expect(current(game)).toMatchObject({ entry: OVERSTAYER, expiresMonth: null });
    expect(entryOf(OVERSTAYER).work).toBe("cash");
    expect(isOverstayer(content, OVERSTAYER)).toBe(true);
    // Losing it again changes nothing.
    applyEffects(game, [{ type: "status/lose" }]);
    expect(current(game).entry).toBe(OVERSTAYER);
  });

  test("[status:overstayer-risks-detection] [status:removal-sends-home-banned] given an overstayer certain to be found, when months end, then detection gives a notice and never removes at once; at the notice's end the character is home with the removal on record", () => {
    const game = flown(content, { change: sure });
    applyEffects(game, [{ type: "status/lose" }]);
    // status:grace-before-overstaying: the lapse's month is the UK's one month of grace; its end is the overstay's first draw.
    playMonths(game, 1);
    expect(game.state.status.removals).toEqual([]);
    expect(game.state.place).toMatchObject({ where: "abroad", country: UK_COUNTRY });
    const until = current(game).overstay?.noticeUntil ?? 0;
    expect(until).toBe(game.state.turn.month + (entryOf(OVERSTAYER).noticeMonths ?? 0));
    while (game.state.turn.month < until - 1) playMonths(game, 1);
    if (game.state.setpiece.open !== null) answerFirst(game);
    if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
    const result = game.endTurn();
    const month = game.state.turn.month;
    expect(game.state.status).toEqual({ current: null, removals: [{ country: UK_COUNTRY, month }] });
    expect(game.state.place).toMatchObject({ where: "home", country: null });
    expect(game.state.place.returns.at(-1)).toEqual({ month, shape: "removed", country: UK_COUNTRY });
    expect(statusLines(result.lines)).toContainEqual({ key: "line.status.removed", params: { country: UK_COUNTRY, months: entryOf(OVERSTAYER).banMonths }, tone: "bad", attention: true, counts: [] });
    expect(checkInvariants(game.state, game.content)).toEqual([]);
  });

  test("[status:overstayer-risks-detection] given an overstayer who is never found, when a year passes, then the status is still held", () => {
    const game = flown(content, { change: never });
    applyEffects(game, [{ type: "status/lose" }]);
    playMonths(game, 12);
    expect(current(game).entry).toBe(OVERSTAYER);
  });

  test("[status:overstayer-risks-detection] [status:grace-before-overstaying] given an overstayer at the real chance, when the lapse's month, the UK's one month of grace, ends, then the month after it draws once for detection, then once for the landlord's check", () => {
    const game = flown(content);
    applyEffects(game, [{ type: "status/lose" }]);
    expect(entryOf(OVERSTAYER).graceMonths).toBe(1);
    const before = game.state.draws.status ?? 0;
    game.endTurn();
    expect((game.state.draws.status ?? 0) - before).toBe(2);
  });
});

describe("renewing", () => {
  test("[status:renewing-a-status] given a sponsored worker in a job that is not care or nursing, when the status is renewed, then it runs 24 months more and the skilled renewal from inside the UK and the surcharge are paid in pounds", () => {
    const game = sponsored();
    const expires = current(game).expiresMonth ?? 0;
    const fee = totalOut(game, "fee-visa");
    const surcharge = totalOut(game, "fee-surcharge");
    // £943 up to three years, and £1,035 a year for the 24 months: £3,013 in all.
    expect(game.view().status?.renew).toEqual({ months: 24, currency: "GBP", fee: 94300, surcharge: 207000 });
    const result = game.accept({ type: "status/renew" });
    expect(current(game).expiresMonth).toBe(expires + 24);
    expect(totalOut(game, "fee-visa") - fee).toBe(94300);
    expect(totalOut(game, "fee-surcharge") - surcharge).toBe(207000);
    expect(statusLines(result.lines)).toEqual([
      { key: "line.status.renewed", params: { months: 24, fee: { currency: "GBP", amount: 94300 }, surcharge: { currency: "GBP", amount: 207000 } }, tone: "good", attention: false, counts: [] },
    ]);
  });

  test.each(["activity.job-uk-care", "activity.job-uk-senior-care", "activity.job-uk-nurse"] as const)(
    "[status:renewing-a-status] [status:one-renewability-test] given a sponsored worker held with %s, when the status is renewed, then it renews at the Health and Care fee with no surcharge, and the view says the same",
    (job) => {
      const game = flown(content, { from: "scenario.developer" });
      applyEffects(game, [{ type: "obligation/close", obligationType: "tuition" }, { type: "status/grant", status: SPONSORED, job }, { type: "activity/start-job", job }]);
      expect(game.state.activity.job).toBe(job);
      const expires = current(game).expiresMonth ?? 0;
      const fee = totalOut(game, "fee-visa");
      const surcharge = totalOut(game, "fee-surcharge");
      expect(game.view().status?.renew).toEqual({ months: 24, currency: "GBP", fee: content.var["var.uk-care-visa-fee"]!.start, surcharge: 0 });
      game.accept({ type: "status/renew" });
      expect(current(game).expiresMonth).toBe(expires + 24);
      expect(totalOut(game, "fee-visa") - fee).toBe(32400);
      expect(totalOut(game, "fee-surcharge") - surcharge).toBe(0);
    },
  );

  test("[status:renewing-a-status] given a status that does not renew, a sponsored worker out of the job, or a renewal that cannot be paid, when renewal is asked for, then it is rejected", () => {
    const student = flown(content);
    student.expectRejected({ type: "status/renew" }, "not-legal");
    const jobless = sponsored();
    jobless.accept({ type: "activity/quit" });
    jobless.expectRejected({ type: "status/renew" }, "not-legal");
    // status:view-shows-status: the view shows no terms where asking would be refused.
    expect(jobless.view().status?.renew).toBeNull();
    const broke = sponsored();
    const pockets = broke.state.wallet.pockets;
    applyEffects(broke, [
      { type: "money/take", currency: "GBP", pocket: "any", amount: pockets.GBP.bank + pockets.GBP.cash, reason: "mishap" },
      { type: "money/take", currency: "NGN", pocket: "any", amount: pockets.NGN.bank + pockets.NGN.cash, reason: "mishap" },
    ]);
    broke.expectRejected({ type: "status/renew" }, "cannot-afford");
    const gulf = flown(content);
    applyEffects(gulf, [{ type: "status/grant", status: GULF }]);
    gulf.expectRejected({ type: "status/renew" }, "not-legal");
    const home = flown(content);
    applyEffects(home, [{ type: "status/remove" }]);
    expect(home.expectRejected({ type: "status/renew" }, "not-legal").ok).toBe(false);
  });
});

describe("settling", () => {
  test("[status:lawful-months-reach-settlement] given a status that does not count, when months pass, then the lawful months stay at 0 while the months held go up", () => {
    const game = flown(content);
    playMonths(game, 3);
    expect(current(game)).toMatchObject({ entry: STUDENT, lawfulMonths: 0, monthsHeld: 3 });
  });

  test("[status:lawful-months-reach-settlement] given a sponsored worker and settling at 3 lawful months, when the third lawful month has passed, then the next month's clocks grant settled status for the fee, and a year later citizenship for its fee", () => {
    const game = sponsored({ vars: () => ({ "var.uk-settle-months": 3 }) });
    const fee = totalOut(game, "fee-visa");
    playMonths(game, 3);
    expect(current(game)).toMatchObject({ entry: SPONSORED, lawfulMonths: 3 });
    const settled = game.endTurn();
    expect(current(game)).toMatchObject({ entry: SETTLED, expiresMonth: null, lawfulMonths: 3 });
    expect(totalOut(game, "fee-visa") - fee).toBe(322600);
    expect(statusLines(settled.lines)).toContainEqual({ key: "line.status.settled", params: { status: SETTLED, fee: { currency: "GBP", amount: 322600 } }, tone: "good", attention: true, counts: [] });
    playMonths(game, 11);
    expect(current(game)).toMatchObject({ entry: SETTLED, monthsHeld: 12 });
    playMonths(game, 1);
    expect(current(game).entry).toBe(CITIZEN);
    expect(totalOut(game, "fee-visa") - fee).toBe(322600 + 170900);
    playMonths(game, 24);
    expect(current(game).entry).toBe(CITIZEN);
  });

  test("[share:cards-due-at-set-moments] given settled status or citizenship granted, when the view is read through the month after it, then the card is the secured card, gone the month after", () => {
    const game = sponsored({ vars: () => ({ "var.uk-settle-months": 3 }) });
    playMonths(game, 3);
    expect(game.view().card?.kind).not.toBe("secured");
    playMonths(game, 1);
    expect(current(game).entry).toBe(SETTLED);
    expect(game.view().card).toMatchObject({ kind: "secured", months: game.state.turn.month, name: null });
    playMonths(game, 1);
    expect(game.view().card?.kind).not.toBe("secured");
    playMonths(game, 11);
    expect(current(game).entry).toBe(CITIZEN);
    expect(game.view().card).toMatchObject({ kind: "secured", months: game.state.turn.month });
  });

  test("[status:lawful-months-reach-settlement] given the settling months reached and no money for the fee, when months pass, then nothing is granted until it can be paid", () => {
    const game = sponsored({ vars: () => ({ "var.uk-settle-months": 1 }) });
    const pockets = game.state.wallet.pockets;
    applyEffects(game, [
      { type: "money/take", currency: "GBP", pocket: "any", amount: pockets.GBP.bank + pockets.GBP.cash, reason: "mishap" },
      { type: "money/take", currency: "NGN", pocket: "any", amount: pockets.NGN.bank + pockets.NGN.cash, reason: "mishap" },
    ]);
    playMonths(game, 3);
    expect(current(game)).toMatchObject({ entry: SPONSORED, lawfulMonths: 3 });
    // The fee, and the month's rent and upkeep, which are charged before the clocks run.
    applyEffects(game, [{ type: "money/add", currency: "GBP", pocket: "bank", amount: 322600 + 200000, reason: "gift" }]);
    playMonths(game, 1);
    expect(current(game).entry).toBe(SETTLED);
  });

  test("[status:lawful-months-reach-settlement] given the real settling months, when they are read, then the sponsored worker's bar is 60 lawful months and the view shows it", () => {
    const game = sponsored();
    expect(game.view().status).toMatchObject({ entry: SPONSORED, lawfulMonths: 0, settleMonths: 60, work: "one-employer", nextStep: "status.next.settle" });
  });
});

describe("removal and the Gulf contract", () => {
  test("[status:removal-sends-home-banned] given a status removed, when it is carried out, then the removal is recorded and the character comes home with the shape removed", () => {
    const game = flown(content);
    applyEffects(game, [{ type: "status/remove" }]);
    expect(game.state.status.removals).toEqual([{ country: UK_COUNTRY, month: game.state.turn.month }]);
    expect(game.state.place.returns.map((back) => back.shape)).toEqual(["removed"]);
    // At home there is nothing to remove.
    applyEffects(game, [{ type: "status/remove" }]);
    expect(game.state.status.removals).toHaveLength(1);
  });

  test("[status:gulf-status-holds-passport] given a Gulf worker, when the passport is asked about and the job goes, then the employer holds it, and the status lapses at once to the irregular one", () => {
    const game = flown(content);
    expect(passportHeldByEmployer(readOf(game))).toBe(false);
    applyEffects(game, [
      { type: "place/move", to: "abroad", country: "country.uae" },
      { type: "status/grant", status: GULF },
    ]);
    expect(passportHeldByEmployer(readOf(game))).toBe(true);
    applyEffects(game, [{ type: "status/clock-start" }]);
    expect(current(game)).toMatchObject({ entry: "status.uae-irregular", clock: null });
    expect(passportHeldByEmployer(readOf(game))).toBe(false);
  });

  test("[status:gulf-status-holds-passport] given a Gulf worker holding a passport in force, when a route asks for the passport, then it is not held while the employer keeps it, and is held again once the contract has ended", () => {
    const game = flown(content);
    const passport = { type: "document/held", document: "document.passport" } as const;
    expect(check(readOf(game), passport).met).toBe(true);
    applyEffects(game, [
      { type: "place/move", to: "abroad", country: "country.uae" },
      { type: "status/grant", status: GULF },
    ]);
    expect(check(readOf(game), passport).met).toBe(false);
    applyEffects(game, [{ type: "status/clock-start" }]);
    expect(check(readOf(game), passport).met).toBe(true);
  });

  test("[abroad-money:arrival-opens-upkeep-and-room] [status:gulf-status-holds-passport] given a Gulf worker housed by the employer, when the contract runs, then no room rent is owed; when it lapses to the irregular status, the room is rented", () => {
    const game = flown(content);
    const rentOpen = () => Object.values(game.state.obligation.items).filter((item) => content.obligation[item.entry]?.type === "rent").map((item) => item.entry);
    applyEffects(game, [
      { type: "place/move", to: "abroad", country: "country.uae" },
      { type: "status/grant", status: GULF },
    ]);
    expect(rentOpen().filter((entry) => entry === "obligation.rent-room-uae")).toEqual([]);
    applyEffects(game, [{ type: "status/clock-start" }]);
    expect(current(game)?.entry).toBe("status.uae-irregular");
    expect(rentOpen()).toContain("obligation.rent-room-uae");
  });
});

describe("the view", () => {
  test("[status:view-shows-status] given a student, a settled and a citizen, when the view is read, then it shows the entry, months left, clock, lawful months, the bar, the work rule and the way up, and never the detection chance", () => {
    const game = flown(content);
    expect(game.view().status).toEqual({ entry: STUDENT, monthsLeft: 16, clock: null, lawfulMonths: 0, settleMonths: null, work: "part", nextStep: "status.next.course", renew: null, overstay: null });
    playMonths(game, 1);
    expect(game.view().status?.monthsLeft).toBe(15);
    expect(JSON.stringify(game.view().status)).not.toContain("detect");
    expect(hiddenPaths(game.view())).toEqual([]);
    expect(nextStepOf(content, entryOf(SETTLED))).toBe("status.next.citizen");
    expect(nextStepOf(content, entryOf(CITIZEN))).toBeNull();
    expect(nextStepOf(content, entryOf(OVERSTAYER))).toBe("status.next.home");
    expect(nextStepOf(content, entryOf(UK_GRADUATE))).toBe("status.next.stay");
    expect(isKept(content, SETTLED) && isKept(content, CITIZEN) && isKept(content, "status.canada-resident")).toBe(true);
    expect(isKept(content, OVERSTAYER) || isKept(content, STUDENT)).toBe(false);
    applyEffects(game, [{ type: "status/remove" }]);
    expect(game.view().status).toBeNull();
  });
});

describe("the course", () => {
  test("[status:course-passed-or-withdrawn] given a student, when the months held are 11 and then 12, then the course counts as passed only from 12", () => {
    const game = flown(content);
    playMonths(game, content.tuning.status.courseMonths - 1);
    expect(coursePassed(readOf(game))).toBe(false);
    playMonths(game, 1);
    expect(coursePassed(readOf(game))).toBe(true);
  });

  test("[status:course-passed-or-withdrawn] given a tuition obligation in default, when the student status runs out, then the course is not passed and the status lapses", () => {
    const game = flown(content);
    playMonths(game, 15);
    // The tuition default is written in, too large for the bank to clear.
    const tuition = { id: "obligation-tuition", entry: "obligation.tuition" as const, state: "defaulted" as const, openedMonth: 1, amount: 0, principal: 1000000000, outstanding: 1000000000, monthsLeft: 1, missed: 2, bond: null, charged: 0 };
    game.state = { ...game.state, obligation: { items: { ...game.state.obligation.items, [tuition.id]: tuition } } };
    expect(coursePassed(readOf(game))).toBe(false);
    if (game.state.turn.banked < 1) game.grant(1);
    const result = game.endTurn();
    expect(current(game).entry).toBe(OVERSTAYER);
    expect(statusLines(result.lines)).toContainEqual({ key: "line.status.lapsed-expired", params: { status: STUDENT }, tone: "bad", attention: true, counts: [] });
  });
});

describe("requirements", () => {
  test("[status:view-shows-status] given a status held or none, when status/is is judged, then it holds only for a listed status", () => {
    const game = flown(content);
    expect(check(readOf(game), { type: "status/is", statuses: [STUDENT, UK_GRADUATE] }).met).toBe(true);
    expect(check(readOf(game), { type: "status/is", statuses: [UK_GRADUATE] }).met).toBe(false);
    expect(check(readOf(game), { type: "status/clock-under", months: 5 }).met).toBe(false);
    applyEffects(game, [{ type: "status/remove" }]);
    expect(check(readOf(game), { type: "status/is", statuses: [STUDENT] }).met).toBe(false);
  });

  test.prop([fc.integer({ min: 0, max: 40 }), fc.integer({ min: 0, max: 40 })])(
    "[status:lost-job-starts-clock] given any clock and any bar, when status/clock-under is judged, then it holds exactly when the clock is under the bar",
    (clock, months) => {
      const game = flown(content);
      const read: ReadCtx = { ...readOf(game), state: { ...game.state, status: { ...game.state.status, current: { ...current(game), clock } } } };
      expect(check(read, { type: "status/clock-under", months }).met).toBe(clock < months);
    },
  );
});

describe("the status kind's words", () => {
  test("[engine:content-checked-before-play] given every line the status kind gives and every way up, when the words are looked up, then each has words naming only figures its line carries", () => {
    const keys = [
      "granted",
      "moved-on",
      "settled",
      "citizen",
      "lapsed-expired",
      "lapsed-clock",
      "lapsed-lost",
      "lapsed-job",
      "clock-started",
      "clock-ran",
      "clock-cleared",
      "renewed",
      "removed",
      "closed",
    ].map((key) => `line.status.${key}`);
    const steps = ["course", "settle", "citizen", "stay", "home"].map((step) => `status.next.${step}`);
    expect([...keys, ...steps].filter((key) => (text[key] ?? "").trim() === "")).toEqual([]);
    const params: Record<string, string[]> = {
      "line.status.settled": ["status", "fee"],
      "line.status.citizen": ["status", "fee"],
      "line.status.clock-started": ["months"],
      "line.status.clock-ran": ["months"],
      "line.status.clock-cleared": [],
      "line.status.renewed": ["months", "fee", "surcharge"],
      "line.status.removed": ["country", "months"],
    };
    for (const key of keys) {
      const allowed = params[key] ?? ["status"];
      for (const match of (text[key] ?? "").matchAll(/\{([^}]+)\}/g)) expect(allowed).toContain(match[1]);
    }
  });
});
