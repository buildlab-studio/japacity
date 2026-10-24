// A status tied to no job and no course kept through a trip home, flown back on until it ends, and the time at home
// read against settlement: return:papers-return-keeps-status, place:return-shape-decided-at-once and status:absence-breaks-settlement.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { checkInvariants } from "../engine/invariants";
import type { Currency, Effect, Id, ReportLine, StatusState } from "../engine/types";
import { BOND, facts, joint, setFacts } from "../testing/person.journey";
import { flown, playMonths } from "../testing/place.journey";
import { applyEffects } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { SETTLED, SKILLED, SPONSORED, STANDING, STUDENT, UK_COUNTRY, UK_GRADUATE, UK_ROUTE } from "../testing/ids";

const TALENT: Id<"status"> = "status.uk-talent";
const PARTNER: Id<"status"> = "status.uk-partner";
const DEPENDANT: Id<"status"> = "status.uk-dependant";
const GULF: Id<"status"> = "status.gulf-worker";
const RESIDENT: Id<"status"> = "status.canada-resident";
const CURRENCIES: readonly Currency[] = ["NGN", "GBP", "USD", "CAD", "AED", "EUR"];
const tuning = content.tuning;
/** Naira and pounds enough that no return is broke and no month at home or abroad runs short. */
const PLENTY_NAIRA = 50 * tuning.place.brokeLine;
const PLENTY_POUNDS = 5000000;

/** Empties every pocket, then leaves plenty of naira and pounds in the bank. */
function plenty(game: Game): void {
  const takes: Effect[] = CURRENCIES.flatMap((currency): Effect[] => {
    const pocket = game.state.wallet.pockets[currency];
    const held = pocket.bank + pocket.cash;
    return held === 0 ? [] : [{ type: "money/take", currency, pocket: "any", amount: held, reason: "mishap" }];
  });
  applyEffects(game, [
    ...takes,
    { type: "money/add", currency: "NGN", pocket: "bank", amount: PLENTY_NAIRA, reason: "gift" },
    { type: "money/add", currency: "GBP", pocket: "bank", amount: PLENTY_POUNDS, reason: "gift" },
  ]);
}

/** Abroad on the status given, in its own country, with money enough for anything that follows. */
function holding(status: Id<"status">): Game {
  const game = flown(content);
  const country = content.status[status]!.country;
  if (country !== UK_COUNTRY) applyEffects(game, [{ type: "place/move", to: "abroad", country }]);
  applyEffects(game, [{ type: "status/grant", status }]);
  plenty(game);
  return game;
}

function goHome(game: Game): { lines: ReportLine[] } {
  return game.accept({ type: "return/home" });
}

/** Plays at home until the month given is the month in play. */
function untilMonth(game: Game, month: number): void {
  playMonths(game, month - game.state.turn.month);
}

function held(game: Game): StatusState {
  const current = game.state.status.current;
  if (current === null) throw new Error("No status is held.");
  return current;
}

describe("a status a trip home keeps", () => {
  test("[return:papers-return-keeps-status] [place:return-shape-decided-at-once] given the Graduate visa with months left, when the character goes home at their own fare, then the return is with papers, standing moves by that shape, and the visa is kept with its own end month", () => {
    const game = holding(UK_GRADUATE);
    const before = held(game);
    expect(before.expiresMonth).not.toBeNull();
    const standing = game.state.quality[STANDING] ?? 0;
    goHome(game);
    expect(game.state.place.returns.at(-1)?.shape).toBe("with-papers");
    expect(game.state.status.current).toBeNull();
    expect(game.state.place.heldAbroad).toMatchObject({ status: UK_GRADUATE, sinceMonth: game.state.turn.month, monthsHeld: before.monthsHeld, lawfulMonths: before.lawfulMonths, expiresMonth: before.expiresMonth });
    expect((game.state.quality[STANDING] ?? 0) - standing).toBeGreaterThanOrEqual(tuning.return.standing["with-papers"]);
    expect(game.view().place.heldAbroad).toBe(UK_GRADUATE);
    expect(checkInvariants(game.state, game.content)).toEqual([]);
  });

  test("[return:papers-return-keeps-status] given the Global Talent and the partner statuses with months left, when the character goes home, then each is kept as the Graduate visa is", () => {
    for (const status of [TALENT, PARTNER]) {
      const game = holding(status);
      const expires = held(game).expiresMonth;
      goHome(game);
      expect({ status, shape: game.state.place.returns.at(-1)?.shape, kept: game.state.place.heldAbroad?.status, expires: game.state.place.heldAbroad?.expiresMonth }).toEqual({ status, shape: "with-papers", kept: status, expires });
    }
  });

  test("[return:papers-return-keeps-status] given the sponsored worker's, the student's and the Gulf worker's statuses, when the character goes home, then each ends with the return: by choice, nothing kept", () => {
    for (const status of [SPONSORED, STUDENT, GULF]) {
      const game = holding(status);
      if (status === GULF) applyEffects(game, [{ type: "money/add", currency: "AED", pocket: "bank", amount: 1000000, reason: "gift" }]);
      goHome(game);
      expect({ status, shape: game.state.place.returns.at(-1)?.shape, kept: game.state.place.heldAbroad }).toEqual({ status, shape: "by-choice", kept: null });
    }
  });

  test("[return:papers-return-keeps-status] given the kept Graduate visa, when route/depart names the UK route flown before in the visa's last month, then the flight alone is paid and the character is in the UK on the same visa with its end month and months held", () => {
    const game = holding(UK_GRADUATE);
    const before = held(game);
    goHome(game);
    expect(game.state.route[UK_ROUTE]?.state).toBe("departed");
    const ends = before.expiresMonth!;
    untilMonth(game, ends - 1);
    expect(game.state.place.heldAbroad?.status).toBe(UK_GRADUATE);
    const naira = game.state.wallet.pockets.NGN.bank + game.state.wallet.pockets.NGN.cash;
    const result = game.accept({ type: "route/depart", route: UK_ROUTE });
    expect(result.events.filter((event) => event.type === "wallet/debited").map((event) => (event as unknown as { reason: string }).reason)).toEqual(["flight"]);
    expect(naira - (game.state.wallet.pockets.NGN.bank + game.state.wallet.pockets.NGN.cash)).toBe(tuning.route.flight.amount);
    expect(game.state.place).toMatchObject({ where: "abroad", country: UK_COUNTRY, heldAbroad: null });
    expect(held(game)).toMatchObject({ entry: UK_GRADUATE, expiresMonth: ends, monthsHeld: before.monthsHeld, lawfulMonths: before.lawfulMonths });
    expect(checkInvariants(game.state, game.content)).toEqual([]);
  });

  test("[return:papers-return-keeps-status] given the kept Graduate visa, when its end month comes with the character still at home, then it ends with nothing after it: no status, no overstay, no ban, the route flown known again, and route/depart refused", () => {
    const game = holding(UK_GRADUATE);
    const ends = held(game).expiresMonth!;
    goHome(game);
    untilMonth(game, ends - 1);
    if (game.state.turn.banked < 1) game.grant(1);
    const result = game.endTurn();
    expect(game.state.turn.month).toBe(ends);
    expect(game.state.place.heldAbroad).toBeNull();
    expect(game.state.status.current).toBeNull();
    expect(game.state.place.overstays ?? []).toEqual([]);
    expect(game.state.status.removals).toEqual([]);
    expect(result.lines.filter((line) => line.key === "line.place.token-ended")).toEqual([{ key: "line.place.token-ended", params: { status: UK_GRADUATE }, tone: "bad", attention: true, counts: [] }]);
    expect(game.state.route[UK_ROUTE]?.state).toBe("known");
    game.expectRejected({ type: "route/depart", route: UK_ROUTE }, "not-legal");
    expect(checkInvariants(game.state, game.content)).toEqual([]);
  });

  test("[return:papers-return-keeps-status] [place:return-shape-decided-at-once] given the Graduate visa in its end month, when the character goes home, then nothing is kept: no months are left, so the return is by choice", () => {
    const game = holding(UK_GRADUATE);
    const current = held(game);
    game.state = { ...game.state, status: { ...game.state.status, current: { ...current, expiresMonth: game.state.turn.month } } };
    goHome(game);
    expect(game.state.place.returns.at(-1)?.shape).toBe("by-choice");
    expect(game.state.place.heldAbroad).toBeNull();
  });

  test("[return:papers-return-keeps-status] given the kept Graduate visa and the skilled worker route granted at home, when that route is flown, then the arrival is on the route's own status and the kept visa is used up", () => {
    const game = holding(UK_GRADUATE);
    goHome(game);
    game.state = { ...game.state, route: { ...game.state.route, [SKILLED]: { ...game.state.route[SKILLED]!, state: "granted" } } };
    game.accept({ type: "route/depart", route: SKILLED });
    expect(game.state.place.heldAbroad).toBeNull();
    expect(held(game).entry).toBe(SPONSORED);
    expect(game.state.route[SKILLED]?.state).toBe("departed");
  });
});

describe("two years in a row at home", () => {
  test("[place:return-home-paid-or-assisted] given the Graduate visa, when the character goes home, then every status closes but the one a trip home keeps, which waits as the token", () => {
    const game = holding(UK_GRADUATE);
    goHome(game);
    expect(game.state.status.current).toBeNull();
    expect(game.state.place).toMatchObject({ where: "home", heldAbroad: { status: UK_GRADUATE } });
  });

  for (const status of [SETTLED, TALENT]) {
    test(`[return:papers-return-keeps-status] given ${status} kept at home, when 23 and then 24 months pass at home in a row, then it is kept and then lapses, and the route flown is known again`, () => {
      const game = holding(status);
      goHome(game);
      playMonths(game, tuning.return.ukKeptLapseMonths - 1);
      expect(game.state.place.heldAbroad?.status).toBe(status);
      if (game.state.turn.banked < 1) game.grant(1);
      const result = game.endTurn();
      expect(game.state.place.heldAbroad).toBeNull();
      expect(result.lines.filter((line) => line.key.startsWith("line.place."))).toEqual([
        { key: "line.place.token-lapsed", params: { status, months: tuning.return.ukKeptLapseMonths }, tone: "bad", attention: true, counts: [] },
      ]);
      expect(game.state.route[UK_ROUTE]?.state).toBe("known");
    });
  }

  test("[return:papers-return-keeps-status] given UK citizenship kept at home, when 30 months pass at home, then it is still kept: a citizenship never lapses", () => {
    const game = holding("status.uk-citizen");
    goHome(game);
    playMonths(game, 30);
    expect(game.state.place.heldAbroad?.status).toBe("status.uk-citizen");
  });
});

describe("the dependant's kept status", () => {
  /** Abroad on the dependant status, the partner's facts showing them in the UK on the sponsored status, or as the change says. */
  function dependant(lead: Partial<ReturnType<typeof facts>>): Game {
    const game = flown(content);
    joint(game, SKILLED, "them");
    setFacts(game, () => facts({ where: "abroad", country: UK_COUNTRY, status: SPONSORED, statusMonthsLeft: 20, ...lead }));
    applyEffects(game, [{ type: "status/grant", status: DEPENDANT }]);
    plenty(game);
    return game;
  }

  test("[return:papers-return-keeps-status] given the dependant status while the partner holds the sponsored status in the UK, when the character goes home, then it is kept; when the partner holds none, it ends with the return", () => {
    const kept = dependant({});
    goHome(kept);
    expect({ shape: kept.state.place.returns.at(-1)?.shape, kept: kept.state.place.heldAbroad?.status }).toEqual({ shape: "with-papers", kept: DEPENDANT });
    const lost = dependant({ where: "home", country: null, status: null });
    goHome(lost);
    expect({ shape: lost.state.place.returns.at(-1)?.shape, kept: lost.state.place.heldAbroad }).toEqual({ shape: "by-choice", kept: null });
  });

  test("[return:papers-return-keeps-status] given the dependant status kept at home, when the partner's facts stop showing the status it depends on, then the kept status ends at the next month", () => {
    const game = dependant({});
    goHome(game);
    playMonths(game, 1);
    expect(game.state.place.heldAbroad?.status).toBe(DEPENDANT);
    setFacts(game, (now) => ({ ...now, where: "home", country: null, status: null, statusMonthsLeft: null }));
    expect(game.state.people.bonds[BOND]?.facts?.status).toBeNull();
    if (game.state.turn.banked < 1) game.grant(1);
    const result = game.endTurn();
    expect(game.state.place.heldAbroad).toBeNull();
    expect(result.lines.map((line) => line.key)).toContain("line.place.token-ended");
  });
});

describe("time at home against settlement", () => {
  /** The Global Talent held this many months in the UK, then a return home with it kept. */
  function talentHome(monthsAbroad: number): { game: Game; lawful: number } {
    const game = holding(TALENT);
    playMonths(game, monthsAbroad);
    const lawful = held(game).lawfulMonths;
    expect(lawful).toBe(monthsAbroad);
    goHome(game);
    return { game, lawful };
  }

  function flyBack(game: Game): void {
    game.accept({ type: "route/depart", route: UK_ROUTE });
  }

  test("[status:absence-breaks-settlement] given the Global Talent kept at home, when 5 months pass at home and the character flies back, then the months at home added no lawful months and took none away", () => {
    const { game, lawful } = talentHome(5);
    const back = game.state.turn.month;
    playMonths(game, tuning.status.absenceMonths - 1);
    expect(game.state.turn.month - back).toBe(tuning.status.absenceMonths - 1);
    expect(game.state.place.heldAbroad?.lawfulMonths).toBe(lawful);
    flyBack(game);
    expect(held(game)).toMatchObject({ entry: TALENT, lawfulMonths: lawful });
  });

  test("[status:absence-breaks-settlement] given the Global Talent kept at home, when 6 months pass at home and the character flies back, then the lawful months toward settlement are back to 0", () => {
    const { game } = talentHome(5);
    playMonths(game, tuning.status.absenceMonths);
    flyBack(game);
    expect(held(game)).toMatchObject({ entry: TALENT, lawfulMonths: 0 });
    playMonths(game, 1);
    expect(held(game).lawfulMonths).toBe(1);
  });

  test("[status:absence-breaks-settlement] given two trips home on the Global Talent, 4 months and then 2 with 2 in the UK between, when the character flies back the second time, then the 6 months home inside 12 set the lawful months back to 0", () => {
    const { game } = talentHome(5);
    playMonths(game, 4);
    flyBack(game);
    playMonths(game, 2);
    const lawful = held(game).lawfulMonths;
    expect(lawful).toBe(7);
    goHome(game);
    playMonths(game, 2);
    flyBack(game);
    expect(held(game).lawfulMonths).toBe(0);
  });

  test("[status:absence-breaks-settlement] given two trips home on the Global Talent, 4 months and then 3 with 9 in the UK between, when the character flies back the second time, then no 12 months hold more than 6 at home and the lawful months stand", () => {
    const { game } = talentHome(5);
    playMonths(game, 4);
    flyBack(game);
    playMonths(game, 9);
    const lawful = held(game).lawfulMonths;
    goHome(game);
    playMonths(game, 3);
    flyBack(game);
    expect(held(game).lawfulMonths).toBe(lawful);
  });

  test("[status:absence-breaks-settlement] given the partner status kept at home, when 6 months pass at home and the character flies back, then its lawful months toward settlement are back to 0 by the same line", () => {
    const game = holding(PARTNER);
    playMonths(game, 3);
    expect(held(game).lawfulMonths).toBe(3);
    goHome(game);
    playMonths(game, tuning.status.absenceMonths);
    flyBack(game);
    expect(held(game)).toMatchObject({ entry: PARTNER, lawfulMonths: 0 });
  });

  test("[status:absence-breaks-settlement] given the UK settled status held 5 months and kept, when 8 months pass at home and the character flies back, then its months toward citizenship stand at 5: months at home count nothing and take nothing", () => {
    const game = holding(SETTLED);
    playMonths(game, 5);
    expect(held(game).monthsHeld).toBe(5);
    goHome(game);
    playMonths(game, 8);
    flyBack(game);
    expect(held(game)).toMatchObject({ entry: SETTLED, monthsHeld: 5 });
  });

  test("[status:absence-breaks-settlement] [return:papers-return-keeps-status] given a Canadian resident home for 10 months, when they fly back on the kept status, then the lawful months stand: the resident's absence is read by its own 24-month rule", () => {
    const game = holding(RESIDENT);
    applyEffects(game, [{ type: "money/add", currency: "CAD", pocket: "bank", amount: 5000000, reason: "gift" }]);
    playMonths(game, 3);
    const lawful = held(game).lawfulMonths;
    goHome(game);
    playMonths(game, 10);
    game.accept({ type: "route/depart", route: "route.canada-points" });
    expect(held(game)).toMatchObject({ entry: RESIDENT, lawfulMonths: lawful });
  });
});

describe("the kept status in the view and the words", () => {
  test("[place:view-shows-place-and-returns] [status:absence-breaks-settlement] given the Global Talent kept at home, when the view is read through the months at home, then it carries the month the status ends, and from the 6th month home that a flight back starts the road to settling again", () => {
    const game = holding(TALENT);
    playMonths(game, 2);
    const ends = held(game).expiresMonth;
    goHome(game);
    expect(game.view().place.kept).toEqual({ until: ends, restarts: false });
    playMonths(game, tuning.status.absenceMonths - 1);
    expect(game.view().place.kept).toEqual({ until: ends, restarts: false });
    playMonths(game, 1);
    expect(game.view().place.kept).toEqual({ until: ends, restarts: true });
    game.accept({ type: "route/depart", route: UK_ROUTE });
    expect(game.view().place.kept).toBeUndefined();
  });

  test("[place:view-shows-place-and-returns] given a settled status kept, when the view is read, then it never ends and no flight restarts anything", () => {
    const game = holding("status.uk-settled");
    goHome(game);
    expect(game.view().place.kept).toEqual({ until: null, restarts: false });
  });

  test("[engine:content-checked-before-play] given the line a kept status's end gives, when its words are looked up, then they name only the status", () => {
    const words = text["line.place.token-ended"] ?? "";
    expect(words.trim()).not.toBe("");
    expect([...words.matchAll(/\{([^}]+)\}/g)].map((match) => match[1])).toEqual(["status"]);
  });
});
