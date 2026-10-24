// Overstaying in stages: the grace, the overstay and the notice (status:grace-before-overstaying, status:detection-gives-notice,
// status:notice-ends-in-removal, status:overstayer-risks-detection), the fine and the amnesty in the UAE (status:uae-fine-accrues,
// status:uae-amnesty), the landlord's check (abroad-money:right-to-rent-check) and the hospital (status:overstayer-hospital-charged).
// Each life is flown on the UK study route and its status lost, as the tuition's default or a lapse would lose it.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { convertMinor, divFloor } from "../engine/int";
import { check } from "../engine/check";
import type { Accepted, Content, Id, ReportLine, Requirement, StatusEntry } from "../engine/types";
import { illnessTerms, worseTerms } from "../offer/offer.health";
import { flown } from "../testing/place.journey";
import type { Game } from "../testing/play";
import { readOf } from "../testing/read";
import type { LifeOptions } from "../testing/route.journey";
import { answerFirst, applyEffects } from "../testing/route.journey";
import { officialRates } from "../wallet/wallet.rates";
import { workAllows } from "./status.logic";
import { CANADA_COUNTRY, ITALY, OVERSTAYER, STUDENT, UAE, UK_COUNTRY, WELLBEING } from "../testing/ids";

const CANADA_OVERSTAYER: Id<"status"> = "status.canada-overstayer";
const UAE_IRREGULAR: Id<"status"> = "status.uae-irregular";
const EU_IRREGULAR: Id<"status"> = "status.eu-irregular";
const ROOM_UK: Id<"obligation"> = "obligation.rent-room-uk";
const FLAT_UK: Id<"obligation"> = "obligation.rent-flat-uk";
const CASH_ROOM_UK: Id<"obligation"> = "obligation.rent-cash-room-uk";
const FINE_HOME: Id<"obligation"> = "obligation.uae-fine-home";
const KITCHEN: Id<"activity"> = "activity.job-uk-kitchen-cash";

const entryOf = (id: Id<"status">): StatusEntry => content.status[id]!;

/** Content with the UK overstayer's fields changed. */
function ukOverstayer(fields: Partial<StatusEntry>): (used: Content) => Content {
  return (used) => ({ ...used, status: { ...used.status, [OVERSTAYER]: { ...used.status[OVERSTAYER]!, ...fields } } });
}

/** Detection certain, every other draw left as it is. */
const SURE = ukOverstayer({ detectBp: 10000 });
/** Detection never drawn as a hit, so a test can watch the other stages. */
const NEVER = ukOverstayer({ detectBp: 0 });

/** Flown to the UK on the student status, then the status lost: the UK overstayer from this month. */
function lapsed(options: LifeOptions = {}): Game {
  const game = flown(content, options);
  applyEffects(game, [{ type: "status/lose" }]);
  return game;
}

function overstay(game: Game) {
  const held = game.state.status.current;
  if (held?.overstay === undefined) throw new Error("No overstay is held.");
  return held.overstay;
}

function statusDraws(game: Game): number {
  return game.state.draws.status ?? 0;
}

function statusLines(result: Accepted): ReportLine[] {
  return result.lines.filter((line) => line.key.startsWith("line.status."));
}

/** One month played with every slot resting. */
function month(game: Game): Accepted {
  if (game.state.setpiece.open !== null) answerFirst(game);
  if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
  return game.endTurn();
}

/** A life moved from home to a country abroad and given that country's overstayer status there. */
function overstayerIn(country: Id<"country">, status: Id<"status">, options: LifeOptions = {}): Game {
  const game = flown(content, options);
  game.accept({ type: "return/home" });
  applyEffects(game, [{ type: "place/move", to: "abroad", country }, { type: "status/grant", status }]);
  return game;
}

describe("the grace", () => {
  test("[status:grace-before-overstaying] given a UK lapse with detection certain, when the grace month ends, then nothing is drawn on the status stream; the month after the grace, detection is drawn", () => {
    const game = lapsed({ change: SURE });
    const since = game.state.turn.month;
    expect(overstay(game)).toEqual({ since, graceUntil: since + entryOf(OVERSTAYER).graceMonths!, noticeUntil: null, fine: 0 });
    const draws = statusDraws(game);
    month(game);
    expect(game.state.turn.month).toBe(since + 1);
    expect(statusDraws(game)).toBe(draws);
    expect(overstay(game).noticeUntil).toBeNull();
    month(game);
    expect(statusDraws(game)).toBeGreaterThan(draws);
    expect(overstay(game).noticeUntil).not.toBeNull();
  });

  test("[status:grace-before-overstaying] given each country's overstayer status, when it is granted, then its grace runs its months from that month: the UK 1, Canada 3, the UAE 1, Italy none", () => {
    expect([OVERSTAYER, CANADA_OVERSTAYER, UAE_IRREGULAR, EU_IRREGULAR].map((id) => entryOf(id).graceMonths)).toEqual([1, 3, 1, 0]);
    for (const [country, status] of [
      [CANADA_COUNTRY, CANADA_OVERSTAYER],
      [UAE, UAE_IRREGULAR],
      [ITALY, EU_IRREGULAR],
    ] as const) {
      const game = overstayerIn(country, status);
      const since = game.state.turn.month;
      expect(overstay(game)).toEqual({ since, graceUntil: since + entryOf(status).graceMonths!, noticeUntil: null, fine: 0 });
    }
  });

  test("[status:grace-before-overstaying] given Italy's irregular status, which has no grace, when the month after the arrival ends with detection certain, then a notice is given at once", () => {
    const sure = (used: Content): Content => ({ ...used, status: { ...used.status, [EU_IRREGULAR]: { ...used.status[EU_IRREGULAR]!, detectBp: 10000 } } });
    const game = overstayerIn(ITALY, EU_IRREGULAR, { change: sure });
    month(game);
    expect(overstay(game).noticeUntil).toBe(game.state.turn.month + entryOf(EU_IRREGULAR).noticeMonths!);
  });
});

describe("what the grace allows", () => {
  test("[status:grace-allows-in-country-applications] [ladders:sponsor-job-ties-status] given a UK overstayer in the grace, when a sponsor's job is judged, then it may be hunted; past the grace only cash work stays", () => {
    const game = lapsed({ change: NEVER });
    const sponsorJob = Object.values(content.activity).find((entry) => entry.sponsor === true && entry.country === UK_COUNTRY)!;
    const cashJob = content.activity[KITCHEN]!;
    expect(workAllows(readOf(game), sponsorJob)).toBe(true);
    expect(workAllows(readOf(game), cashJob)).toBe(true);
    month(game);
    expect(workAllows(readOf(game), sponsorJob)).toBe(true);
    month(game);
    expect(workAllows(readOf(game), sponsorJob)).toBe(false);
    expect(workAllows(readOf(game), cashJob)).toBe(true);
  });

  test("[status:grace-allows-in-country-applications] given a UK overstayer, when status/is with the grace is judged, then it holds in the grace and not after; no other status meets it", () => {
    const game = lapsed({ change: NEVER });
    const grace: Requirement = { type: "status/is", statuses: [OVERSTAYER], grace: true };
    const judged = (): boolean => check(readOf(game), grace).met;
    expect(judged()).toBe(true);
    month(game);
    expect(judged()).toBe(true);
    month(game);
    expect(judged()).toBe(false);
    const student = flown(content);
    expect(check(readOf(student), { type: "status/is", statuses: [STUDENT], grace: true }).met).toBe(false);
  });
});

describe("detection and the notice", () => {
  test("[status:detection-gives-notice] [status:overstayer-risks-detection] given a UK overstayer past the grace with detection certain, when the month ends, then a notice of three months is told with attention and the character stays", () => {
    const game = lapsed({ change: SURE });
    month(game);
    const found = month(game);
    const now = game.state.turn.month;
    expect(entryOf(OVERSTAYER).noticeMonths).toBe(3);
    expect(overstay(game).noticeUntil).toBe(now + 3);
    expect(statusLines(found)).toContainEqual({ key: "line.status.noticed", params: { country: UK_COUNTRY, months: 3 }, tone: "bad", attention: true, counts: [] });
    expect(game.state.place).toMatchObject({ where: "abroad", country: UK_COUNTRY });
    expect(game.state.status.removals).toEqual([]);
  });

  test("[status:detection-gives-notice] given a notice standing, when months pass inside it, then no further detection is drawn", () => {
    const game = lapsed({ change: ukOverstayer({ detectBp: 10000, rentCheckBp: 0 }) });
    month(game);
    month(game);
    const draws = statusDraws(game);
    month(game);
    month(game);
    expect(statusDraws(game)).toBe(draws);
  });

  test("[status:detection-gives-notice] given each overstayer status, when its notice is read, then it gives the UK 3 months and Canada, the UAE and Italy 1", () => {
    expect([OVERSTAYER, CANADA_OVERSTAYER, UAE_IRREGULAR, EU_IRREGULAR].map((id) => entryOf(id).noticeMonths)).toEqual([3, 1, 1, 1]);
  });

  test("[status:notice-ends-in-removal] [status:removal-sends-home-banned] given a notice to month n, when the months pass, then the character is still abroad in month n - 1 and is removed in month n, banned for the country's months", () => {
    const game = lapsed({ change: SURE });
    month(game);
    month(game);
    const until = overstay(game).noticeUntil!;
    while (game.state.turn.month < until - 1) month(game);
    expect(game.state.place.where).toBe("abroad");
    const removed = month(game);
    expect(game.state.turn.month).toBe(until);
    expect(game.state.place).toMatchObject({ where: "home", country: null });
    expect(game.state.status.removals).toEqual([{ country: UK_COUNTRY, month: until }]);
    expect(game.state.place.returns.at(-1)).toMatchObject({ month: until, shape: "removed", country: UK_COUNTRY });
    expect(statusLines(removed)).toContainEqual({ key: "line.status.removed", params: { country: UK_COUNTRY, months: entryOf(OVERSTAYER).banMonths }, tone: "bad", attention: true, counts: [] });
  });

  test("[status:notice-ends-in-removal] given a notice standing, when any status is granted, then the notice is gone with the overstay", () => {
    const game = lapsed({ change: SURE });
    month(game);
    month(game);
    expect(overstay(game).noticeUntil).not.toBeNull();
    applyEffects(game, [{ type: "status/grant", status: STUDENT }]);
    expect(game.state.status.current?.overstay).toBeUndefined();
    const until = game.state.turn.month + 3;
    while (game.state.turn.month < until) month(game);
    expect(game.state.place.where).toBe("abroad");
  });

  test("[status:overstayer-risks-detection] given an overstayer past the grace with no notice, when a month ends, then one draw is made on the status stream for detection", () => {
    const game = lapsed({ change: NEVER });
    month(game);
    const draws = statusDraws(game);
    month(game);
    // The landlord's check is drawn after detection in the same month (abroad-money:right-to-rent-check), so detection's is one of two.
    expect(statusDraws(game) - draws).toBe(2);
    const noRoomCheck = lapsed({ change: ukOverstayer({ detectBp: 0, rentCheckBp: 0 }) });
    month(noRoomCheck);
    const before = statusDraws(noRoomCheck);
    month(noRoomCheck);
    expect(statusDraws(noRoomCheck) - before).toBe(1);
  });

  test("[status:overstayer-risks-detection] [ladders:cash-jobs-paid-in-hand] given detection at nothing and cash work's addition certain, when a month past the grace ends with a cash job, then a notice comes; with no cash work, none does", () => {
    const cashSure = (used: Content): Content => ({
      ...ukOverstayer({ detectBp: 0, rentCheckBp: 0 })(used),
      tuning: { ...used.tuning, ladder: { ...used.tuning.ladder, cashDetectBp: 10000 } },
    });
    const idle = lapsed({ change: cashSure });
    month(idle);
    month(idle);
    expect(overstay(idle).noticeUntil).toBeNull();
    const working = lapsed({ change: cashSure });
    month(working);
    applyEffects(working, [{ type: "activity/start-job", job: KITCHEN }]);
    month(working);
    expect(overstay(working).noticeUntil).toBe(working.state.turn.month + 3);
    expect(content.tuning.ladder.cashDetectBp).toBe(100);
    expect([OVERSTAYER, CANADA_OVERSTAYER, UAE_IRREGULAR, EU_IRREGULAR].map((id) => entryOf(id).detectBp)).toEqual([100, 100, 200, 100]);
  });
});

describe("the landlord's check", () => {
  const CHECKED = ukOverstayer({ detectBp: 0, rentCheckBp: 10000 });

  test("[abroad-money:right-to-rent-check] given a UK overstayer past the grace in the shared room with the check certain, when the month ends, then the room ends, the room that asks no papers opens at £840 and wellbeing falls 6, told with attention", () => {
    const game = lapsed({ change: CHECKED });
    applyEffects(game, [{ type: "quality/add", quality: WELLBEING, amount: 50 - (game.state.quality[WELLBEING] ?? 0) }]);
    month(game);
    const open = (): Id<"obligation">[] => Object.values(game.state.obligation.items).map((item) => item.entry);
    expect(open()).toContain(ROOM_UK);
    const wellbeing = game.state.quality[WELLBEING] ?? 0;
    const checked = month(game);
    expect(open()).not.toContain(ROOM_UK);
    expect(open()).toContain(CASH_ROOM_UK);
    expect(content.obligation[CASH_ROOM_UK]).toMatchObject({ type: "rent", currency: "GBP", amount: 84000, reportsToCredit: false });
    expect(checked.events).toContainEqual(expect.objectContaining({ type: "quality/changed", quality: WELLBEING, amount: -6 }));
    expect(statusLines(checked)).toContainEqual({ key: "line.status.rent-checked", params: {}, tone: "bad", attention: true, counts: [] });
    expect(wellbeing).toBeGreaterThan(0);
    // That room has no check, so the draw is not made again on it.
    const draws = statusDraws(game);
    month(game);
    expect(statusDraws(game) - draws).toBe(1);
  });

  test("[abroad-money:right-to-rent-check] given the check certain, when a month in the grace ends, then nothing is drawn and the room stays", () => {
    const game = lapsed({ change: CHECKED });
    const draws = statusDraws(game);
    month(game);
    expect(statusDraws(game)).toBe(draws);
    expect(Object.values(game.state.obligation.items).map((item) => item.entry)).toContain(ROOM_UK);
  });

  test("[abroad-money:right-to-rent-check] given a flat in the overstayer's own name, when the check ends it, then the deposit is kept as on an eviction", () => {
    const game = lapsed({ change: CHECKED });
    applyEffects(game, [
      { type: "obligation/close", obligationType: "rent" },
      { type: "obligation/open", obligation: FLAT_UK },
    ]);
    month(game);
    const checked = month(game);
    expect(checked.events.filter((event) => event.type === "wallet/credited" && (event as unknown as { reason: string }).reason === "deposit-return")).toEqual([]);
    expect(Object.values(game.state.obligation.items).map((item) => item.entry)).toContain(CASH_ROOM_UK);
  });

  test("[abroad-money:right-to-rent-check] given each overstayer status, when its check is read, then only the UK's checks, at 15% a month", () => {
    expect([OVERSTAYER, CANADA_OVERSTAYER, UAE_IRREGULAR, EU_IRREGULAR].map((id) => entryOf(id).rentCheckBp ?? 0)).toEqual([1500, 0, 0, 0]);
  });
});

describe("the hospital", () => {
  test("[status:overstayer-hospital-charged] given a UK overstayer past the grace, when an illness's prices are read, then the hospital costs 150% of its figure and the chemist what it costs; in the grace and on any other status, the figure", () => {
    const { hospital, hospitalWorse, chemist } = content.tuning.health;
    expect(content.tuning.status.hospitalChargeBp).toBe(15000);
    const game = lapsed({ change: NEVER });
    expect(illnessTerms(readOf(game))).toEqual({ hospital, chemist });
    month(game);
    month(game);
    expect(illnessTerms(readOf(game))).toEqual({ hospital: hospital + divFloor(hospital, 2), chemist });
    expect(worseTerms(readOf(game))).toEqual({ hospital: hospitalWorse + divFloor(hospitalWorse, 2) });
    expect(illnessTerms(readOf(flown(content)))).toEqual({ hospital, chemist });
    const uae = overstayerIn(UAE, UAE_IRREGULAR);
    month(uae);
    month(uae);
    expect(illnessTerms(readOf(uae))).toEqual({ hospital, chemist });
  });
});

describe("the UAE's fine and the amnesty", () => {
  const NEVER_UAE = (used: Content): Content => ({ ...used, status: { ...used.status, [UAE_IRREGULAR]: { ...used.status[UAE_IRREGULAR]!, detectBp: 0 } } });
  const perMonth = entryOf(UAE_IRREGULAR).finePerMonth!;

  test("[status:uae-fine-accrues] given the UAE's irregular status, when months pass, then no fine grows in the grace and AED 1,500 grows each month after it", () => {
    expect(perMonth).toBe(150000);
    const game = overstayerIn(UAE, UAE_IRREGULAR, { change: NEVER_UAE });
    month(game);
    expect(overstay(game).fine).toBe(0);
    month(game);
    expect(overstay(game).fine).toBe(perMonth);
    month(game);
    expect(overstay(game).fine).toBe(2 * perMonth);
    expect(game.view().status?.overstay?.fine).toEqual({ currency: "AED", amount: 2 * perMonth });
  });

  test("[status:uae-fine-accrues] [place:return-home-paid-or-assisted] given a fine owed and the fare in dirhams, when the character goes home at their own fare, then the fare and the fine are both paid, the fine as `fine`", () => {
    const game = overstayerIn(UAE, UAE_IRREGULAR, { change: NEVER_UAE });
    month(game);
    month(game);
    const fare = content.country[UAE]!.fare;
    applyEffects(game, [{ type: "money/add", currency: "AED", pocket: "bank", amount: fare + perMonth, reason: "gift" }]);
    const outFare = game.state.wallet.totals.out.fare?.AED ?? 0;
    game.accept({ type: "return/home" });
    expect(game.state.wallet.totals.out.fine).toEqual({ AED: perMonth });
    expect((game.state.wallet.totals.out.fare?.AED ?? 0) - outFare).toBe(fare);
    expect(Object.values(game.state.obligation.items).map((item) => item.entry)).not.toContain(FINE_HOME);
  });

  test("[status:uae-fine-accrues] [return:return-reopens-home-charges] given a fine owed and nothing to pay the fare, when the assisted return takes the character home, then the fine follows as a debt in naira at the day's official rate", () => {
    const game = overstayerIn(UAE, UAE_IRREGULAR, { change: NEVER_UAE });
    month(game);
    month(game);
    for (const currency of ["NGN", "GBP", "AED"] as const) {
      const pocket = game.state.wallet.pockets[currency];
      if (pocket.bank + pocket.cash > 0) applyEffects(game, [{ type: "money/take", currency, pocket: "any", amount: pocket.bank + pocket.cash, reason: "mishap" }]);
    }
    const naira = convertMinor(perMonth, "AED", "NGN", officialRates(game.world()));
    game.accept({ type: "return/home" });
    expect(game.state.place.returns.at(-1)?.shape).toBe("assisted");
    const debt = Object.values(game.state.obligation.items).find((item) => item.entry === FINE_HOME);
    expect(debt).toMatchObject({ principal: naira, outstanding: naira });
    expect(content.obligation[FINE_HOME]).toMatchObject({ type: "loan", currency: "NGN", term: 12, rateBp: 0, sink: "loan-repay" });
  });

  test("[status:uae-amnesty] given the amnesty in force and detection certain, when months pass and the character goes home, then no detection is drawn, no fine is asked and it is cleared, and no ban is recorded", () => {
    const sure = (used: Content): Content => ({ ...used, status: { ...used.status, [UAE_IRREGULAR]: { ...used.status[UAE_IRREGULAR]!, detectBp: 10000 } } });
    const game = overstayerIn(UAE, UAE_IRREGULAR, { change: sure, vars: () => ({ "var.uae-amnesty": 1 }) });
    month(game);
    const draws = statusDraws(game);
    month(game);
    month(game);
    expect(statusDraws(game)).toBe(draws);
    expect(overstay(game).noticeUntil).toBeNull();
    const fare = content.country[UAE]!.fare;
    applyEffects(game, [{ type: "money/add", currency: "AED", pocket: "bank", amount: fare, reason: "gift" }]);
    const way = game.view().place.wayHome;
    expect(way?.fine).toBeNull();
    expect(way?.banMonths).toBe(0);
    game.accept({ type: "return/home" });
    expect(game.state.wallet.totals.out.fine).toBeUndefined();
    expect(game.state.place.overstays?.every((left) => left.banMonths === 0)).toBe(true);
    expect(content.var["var.uae-amnesty"]?.start).toBe(0);
  });
});

describe("the view", () => {
  test("[status:view-shows-status] given a UK overstayer, when the view is read through the grace and a notice, then the grace left counts the month in play, 1 in the grace's last month and 0 past it, with the notice left, no fine and nothing pending, and never the detection chance", () => {
    const game = lapsed({ change: SURE });
    const grace = entryOf(OVERSTAYER).graceMonths!;
    expect(game.view().status?.overstay).toEqual({ graceLeft: grace + 1, noticeLeft: null, fine: null, pending: false });
    month(game);
    expect(game.state.turn.month).toBe(overstay(game).graceUntil);
    expect(game.view().status?.overstay).toEqual({ graceLeft: 1, noticeLeft: null, fine: null, pending: false });
    month(game);
    expect(game.state.turn.month).toBe(overstay(game).graceUntil + 1);
    expect(game.view().status?.overstay).toEqual({ graceLeft: 0, noticeLeft: 3, fine: null, pending: false });
    month(game);
    expect(game.view().status?.overstay?.noticeLeft).toBe(2);
    expect(JSON.stringify(game.view().status)).not.toContain("detect");
    expect(flown(content).view().status?.overstay).toBeNull();
  });

  test("[status:view-shows-status] given each country's overstayer status, when months pass, then the grace left is the months to the grace's end counting the month in play, 1 in its last month and 0 from the month after", () => {
    const NO_DETECTION = (used: Content): Content => ({
      ...used,
      status: Object.fromEntries(Object.entries(used.status).map(([id, entry]) => [id, { ...entry, detectBp: 0 }])),
    });
    for (const [country, status] of [
      [UK_COUNTRY, OVERSTAYER],
      [CANADA_COUNTRY, CANADA_OVERSTAYER],
      [UAE, UAE_IRREGULAR],
      [ITALY, EU_IRREGULAR],
    ] as const) {
      const game = overstayerIn(country, status, { change: NO_DETECTION });
      const { since, graceUntil } = overstay(game);
      for (let at = since; at <= graceUntil + 1; at += 1) {
        expect(game.state.turn.month).toBe(at);
        expect(game.view().status?.overstay?.graceLeft).toBe(at <= graceUntil ? graceUntil - at + 1 : 0);
        month(game);
      }
    }
  });
});

describe("the status kind's overstay words", () => {
  test("[engine:content-checked-before-play] given the lines of the overstay, when the words are looked up, then each has words naming only figures its line carries", () => {
    const params: Record<string, string[]> = {
      "line.status.noticed": ["country", "months"],
      "line.status.rent-checked": [],
    };
    for (const [key, allowed] of Object.entries(params)) {
      expect((text[key] ?? "").trim()).not.toBe("");
      for (const match of (text[key] ?? "").matchAll(/\{([^}]+)\}/g)) expect(allowed).toContain(match[1]);
    }
  });
});

