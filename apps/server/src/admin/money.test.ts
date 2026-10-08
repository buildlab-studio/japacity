import { time } from "@japacity/sim";
import type { State } from "@japacity/sim";
import type { AuditStore, ByReason } from "@japacity/store";
import { describe, expect, test } from "vitest";

import { ledgerReport } from "../../../../packages/sim/src/wallet/report";
import { testDeps } from "../app.test";
import { productionConfig, testConfig } from "../config";
import type { ServerDeps } from "../deps";
import { moneyJob } from "../jobs/money";
import { activeOn } from "./active";
import { ALARM_ROWS, listAlarms, noteDiverged } from "./alarm";
import { dayStart, utcDay } from "./day";
import { createLife, life, playRows, storeWorlds } from "./fixtures";
import { drawAlarms, drawsClosingOn, markAfterCommit, moneyReport, TICKS_PER_DRAW } from "./money";

const ID = "character.tunde";
const SAVE = life("tunde-borrower");
const HALF = 40;
const DAY = utcDay(productionConfig.clock.epoch) + 1;
const TRANSFERS = ["convert", "move", "remit"];

function sum(...rows: ByReason[]): ByReason {
  const total: ByReason = {};
  for (const row of rows) {
    for (const [reason, byCurrency] of Object.entries(row) as [keyof ByReason, ByReason[keyof ByReason]][]) {
      for (const [currency, amount] of Object.entries(byCurrency ?? {}) as [keyof NonNullable<ByReason[keyof ByReason]>, number][]) {
        const into = (total[reason] ??= {});
        into[currency] = (into[currency] ?? 0) + amount;
        if (into[currency] === 0) delete into[currency];
      }
      if (Object.keys(total[reason] ?? {}).length === 0) delete total[reason];
    }
  }
  return total;
}

async function day(deps: ServerDeps, id: string, state: State, entries: typeof SAVE.commands, on: number): Promise<State> {
  const played = await playRows(deps, id, state, entries, {
    at: (index) => dayStart(on) + index * time.MINUTE_MS,
    onCommit: (before, row) => markAfterCommit(deps, id, before, utcDay(row.at)),
  });
  return played.state;
}

async function begin(deps: ServerDeps): Promise<State> {
  await storeWorlds(deps, SAVE);
  return createLife(deps, ID, SAVE);
}

const at = (moment: number) => () => moment;

describe("the money report", () => {
  test("[R-SERVER-011] given a life played over two days with the job after each, when the days are read, then each holds what was made that day and the two add up to the life's totals, transfers left out", async () => {
    const deps = testDeps();
    const start = await begin(deps);
    const first = await day(deps, ID, start, SAVE.commands.slice(0, HALF), DAY);
    const firstReport = await moneyReport(deps, DAY);
    const last = await day(deps, ID, first, SAVE.commands.slice(HALF), DAY + 1);
    const secondReport = await moneyReport(deps, DAY + 1);

    const content = deps.contents.current;
    const one = await deps.stores.ledger.day(DAY);
    const two = await deps.stores.ledger.day(DAY + 1);
    expect(firstReport.closed).toEqual([ID]);
    expect(secondReport.closed).toEqual([ID]);
    expect(one.created).toEqual(ledgerReport(first, content).created);
    expect(sum(one.created, two.created)).toEqual(ledgerReport(last, content).created);
    expect(sum(one.destroyed, two.destroyed)).toEqual(ledgerReport(last, content).destroyed);
    expect(Object.keys(last.wallet.totals.in).some((reason) => TRANSFERS.includes(reason))).toBe(true);
    for (const row of [one, two]) expect(Object.keys({ ...row.created, ...row.destroyed }).filter((reason) => TRANSFERS.includes(reason))).toEqual([]);
    expect(await deps.stores.ledger.mark(ID)).toMatchObject({ day: DAY + 2 });
  });

  test("[R-SERVER-011] given a character's first command of a day before the job for the day before, when the job runs, then the earlier day already holds exactly its own money and the job closes nothing", async () => {
    const deps = testDeps();
    const start = await begin(deps);
    const first = await day(deps, ID, start, SAVE.commands.slice(0, HALF), DAY);
    await day(deps, ID, first, SAVE.commands.slice(HALF, HALF + 1), DAY + 1);

    const report = await moneyReport(deps, DAY);

    expect(report.characters).toEqual([ID]);
    expect(report.closed).toEqual([]);
    expect((await deps.stores.ledger.day(DAY)).created).toEqual(ledgerReport(first, deps.contents.current).created);
    expect(await deps.stores.ledger.mark(ID)).toMatchObject({ day: DAY + 1 });
  });

  test("[R-SERVER-011] given commits on one day, when the hook runs after each, then only the first moves the mark and the rest note the character only", async () => {
    const deps = testDeps();
    const start = await begin(deps);
    await day(deps, ID, start, SAVE.commands.slice(0, 5), DAY);

    expect(await deps.stores.ledger.mark(ID)).toEqual({ character: ID, day: DAY, totals: { in: ledgerReport(start, deps.contents.current).created, out: {} } });
    expect((await deps.stores.ledger.day(DAY)).created).toEqual(ledgerReport(start, deps.contents.current).created);
    expect(activeOn(deps, DAY)).toEqual([ID]);
    expect(activeOn(deps, DAY - 1)).toEqual([]);
  });

  test("[R-SERVER-011] given the job at 00:00 UTC, when it runs, then it reports the day that has just ended and no character idle that day", async () => {
    const deps = testDeps();
    const start = await begin(deps);
    await day(deps, ID, start, SAVE.commands.slice(0, 5), DAY);

    expect((await moneyJob({ ...deps, now: at(dayStart(DAY + 1)) })).day).toBe(DAY);
    expect(await moneyJob({ ...deps, now: at(dayStart(DAY + 3) - 1) })).toMatchObject({ day: DAY + 1, characters: [] });
    expect(await deps.stores.ledger.mark(ID)).toMatchObject({ day: DAY + 1 });
  });
});

describe("the alarm", () => {
  async function doctored(deps: ServerDeps, salary: number): Promise<void> {
    await storeWorlds(deps, SAVE);
    const start = await createLife(deps, "character.plain", SAVE);
    const rich: State = { ...start, wallet: { ...start.wallet, totals: { ...start.wallet.totals, in: { ...start.wallet.totals.in, salary: { NGN: salary } } } } };
    const made = await deps.stores.player.create({ id: ID, account: "account-rich", refilledAt: 0, content: start.content, start: { scenario: SAVE.scenario, seed: SAVE.seed, worldSeed: SAVE.worldSeed }, state: rich });
    if (!made.ok) throw new Error(made.detail);
    await markAfterCommit(deps, ID, rich, DAY);
  }

  test("[R-SERVER-012] given salary one kobo over its ceiling and at it, when the job runs, then only the first is listed as suspect with its reason, currency, total and ceiling", async () => {
    const probe = testDeps();
    await storeWorlds(probe, SAVE);
    const plain = await createLife(probe, "character.plain", SAVE);
    const doctor = (salary: number): State => ({ ...plain, wallet: { ...plain.wallet, totals: { ...plain.wallet.totals, in: { ...plain.wallet.totals.in, salary: { NGN: salary } } } } });
    const ceiling = ledgerReport(doctor(Number.MAX_SAFE_INTEGER), probe.contents.current).alarms.find((alarm) => alarm.reason === "salary")?.ceiling ?? 0;

    const over = testDeps({ now: at(dayStart(DAY + 1)) });
    await doctored(over, ceiling + 1);
    const atCeiling = testDeps({ now: at(dayStart(DAY + 1)) });
    await doctored(atCeiling, ceiling);

    expect((await moneyJob(over)).alarms).toEqual([{ kind: "suspect", day: DAY, character: ID, reason: "salary", currency: "NGN", total: ceiling + 1, ceiling }]);
    expect((await moneyJob(atCeiling)).alarms).toEqual([]);
    expect(await listAlarms(over)).toHaveLength(1);
  });

  test("[R-SERVER-012] given a suspect, when the alarm is raised, then it takes no action on the character and is still listed after a restart", async () => {
    const deps = testDeps({ now: at(dayStart(DAY + 1)) });
    await doctored(deps, Number.MAX_SAFE_INTEGER);
    const before = await deps.stores.player.load(ID);

    await moneyJob(deps);

    expect(await deps.stores.player.load(ID)).toEqual(before);
    expect(await deps.stores.audit.list(ID)).toEqual([]);
    const audit = deps.stores.audit;
    const restarted: AuditStore = { retire: (entry) => audit.retire(entry), list: (character) => audit.list(character) };
    const listed = await listAlarms({ stores: { ...deps.stores, audit: restarted } });
    expect(listed).toEqual(await listAlarms(deps));
    expect(listed[0]).toMatchObject({ kind: "suspect", character: ID });
  });

  test("[R-SERVER-012] given a stored row whose hash differs, when the job runs or a load reports it, then the character is listed as diverged and its day is not closed", async () => {
    const deps = testDeps({ now: at(dayStart(DAY + 1)) });
    const start = await begin(deps);
    await playRows(deps, ID, start, SAVE.commands.slice(0, 5), {
      at: (index) => dayStart(DAY) + index,
      onCommit: (before, row) => markAfterCommit(deps, ID, before, utcDay(row.at)),
      tamper: (row, index) => (index === 4 ? { ...row, hash: "fault" } : row),
    });

    const report = await moneyJob(deps);
    await noteDiverged(deps, "character.other", 9);

    expect(report.closed).toEqual([]);
    expect(report.alarms).toEqual([{ kind: "diverged", day: DAY, character: ID, v: 5 }]);
    expect((await listAlarms(deps)).map((alarm) => alarm.kind === "diverged" && alarm.character)).toEqual([ID, "character.other"]);
  });

  test("[R-SERVER-012] given an alarm raised, when its audit row is read, then it is filed with why alarm", async () => {
    const deps = testDeps();
    await noteDiverged(deps, "character.other", 9);
    expect((await deps.stores.audit.list(ALARM_ROWS)).map((row) => row.why)).toEqual(["alarm"]);
  });
});

describe("the draw's alarm", () => {
  const close = productionConfig.clock.epoch + TICKS_PER_DRAW * productionConfig.clock.worldTickMs;

  test("[R-LOTTERY-014] given the epoch, when the draws closing each day are listed, then draw 0 closes on the Friday a week on, and a close at midnight belongs to the day it opens", () => {
    const deps = testDeps();
    expect(drawsClosingOn(deps, utcDay(close))).toEqual([0]);
    expect(drawsClosingOn(deps, utcDay(close) - 1)).toEqual([]);
    expect(drawsClosingOn(deps, utcDay(close) + 7)).toEqual([1]);
    const midnight = testDeps({ config: testConfig({ clock: { epoch: Date.UTC(2026, 9, 9) } }) });
    expect(drawsClosingOn(midnight, utcDay(Date.UTC(2026, 9, 16)))).toEqual([0]);
    expect(drawsClosingOn(midnight, utcDay(Date.UTC(2026, 9, 16)) - 1)).toEqual([]);
  });

  /** `result.pot` is the tickets sold; the stored pot is their price plus `result.topUp` kobo. `paid` is the jackpot paid and its top-up part. */
  async function drawn(
    deps: ServerDeps,
    buys: { character: string; tick: number; tickets: number }[],
    paid: number | { amount: number; topUp: number },
    result: { pot: number; fund: number; topUp?: number },
  ): Promise<void> {
    await storeWorlds(deps, SAVE);
    const price = deps.contents.current.tuning.lottery.ticket;
    const prize = typeof paid === "number" ? { amount: paid, topUp: 0 } : paid;
    const topUp = result.topUp ?? 0;
    await deps.stores.world.putDraw({ draw: 0, secret: "s", fingerprint: "f", beaconRound: 1, topUpTickets: 0 });
    for (const character of new Set(buys.map((buy) => buy.character))) {
      await createLife(deps, character, SAVE);
      const own = buys.filter((buy) => buy.character === character);
      const rows = own.map((buy, index) => ({ character, v: index + 1, tick: buy.tick, sender: "player" as const, command: { type: "lottery/buy" as const, tickets: buy.tickets, basedOn: index }, hash: "h", at: close }));
      const pay = character === buys[0]?.character ? [{ character, v: rows.length + 1, tick: TICKS_PER_DRAW, sender: "authority" as const, command: { type: "lottery/pay" as const, draw: 0, prizes: [{ tier: "jackpot" as const, ...prize }], basedOn: rows.length }, hash: "h", at: close }] : [];
      await deps.stores.player.transact([character], () => ({ writes: { characters: [{ id: character, append: [...rows, ...pay] }] }, result: null }));
      for (const buy of own) if (buy.tick < TICKS_PER_DRAW) await deps.stores.world.addTickets(0, character, buy.tickets);
    }
    await deps.stores.world.freeze(0, close);
    await deps.stores.world.setResult(0, { draw: 0, revealed: "s", beaconRound: 1, beaconRandomness: "r", listHash: "l", count: 3, pot: result.pot * price + topUp, topUp, fund: result.fund, winners: [] });
  }

  const BUYS = [
    { character: "character.a", tick: 0, tickets: 2 },
    { character: "character.b", tick: TICKS_PER_DRAW - 1, tickets: 1 },
    { character: "character.b", tick: TICKS_PER_DRAW, tickets: 4 },
  ];

  test("[R-LOTTERY-014] given a draw whose wins are its fund and whose tickets are its pot, when it is checked, then no alarm is raised; a buy at the next draw's first tick is not counted", async () => {
    const deps = testDeps();
    await drawn(deps, BUYS, 500, { pot: 3, fund: 500 });
    expect(await drawAlarms(deps, utcDay(close))).toEqual([]);
  });

  test("[R-LOTTERY-014] given wins one kobo over the fund, or tickets one off the pot either way, when the draw is checked, then the world alarm is raised", async () => {
    const over = testDeps();
    await drawn(over, BUYS, 501, { pot: 3, fund: 500 });
    expect(await drawAlarms(over, utcDay(close))).toEqual([{ kind: "draw", day: utcDay(close), draw: 0, check: "win", total: 501, limit: 500 }]);

    const price = testDeps().contents.current.tuning.lottery.ticket;
    for (const pot of [2, 4]) {
      const off = testDeps();
      await drawn(off, BUYS, 500, { pot, fund: 500 });
      expect(await drawAlarms(off, utcDay(close))).toEqual([{ kind: "draw", day: utcDay(close), draw: 0, check: "ticket", total: 3 * price, limit: pot * price }]);
    }
  });

  test("[R-LOTTERY-014] given a draw with a top-up whose prizes split between win and pot-top-up within the fund and the top-up, when it is checked, then no alarm is raised and the tickets are held to the sales alone", async () => {
    const deps = testDeps();
    await drawn(deps, BUYS, { amount: 500, topUp: 300 }, { pot: 3, fund: 500, topUp: 300 });
    expect(await drawAlarms(deps, utcDay(close))).toEqual([]);
  });

  test("[R-LOTTERY-014] given pot-top-up one kobo over the top-up, or win and pot-top-up together one over the fund, when the draw is checked, then the world alarm is raised", async () => {
    const over = testDeps();
    await drawn(over, BUYS, { amount: 500, topUp: 301 }, { pot: 3, fund: 500, topUp: 300 });
    expect(await drawAlarms(over, utcDay(close))).toEqual([{ kind: "draw", day: utcDay(close), draw: 0, check: "top-up", total: 301, limit: 300 }]);

    const both = testDeps();
    await drawn(both, BUYS, { amount: 501, topUp: 300 }, { pot: 3, fund: 500, topUp: 300 });
    expect(await drawAlarms(both, utcDay(close))).toEqual([{ kind: "draw", day: utcDay(close), draw: 0, check: "win", total: 501, limit: 500 }]);
  });

  test("[R-LOTTERY-014] given a draw with a top-up, when the tickets taken are checked, then they are held to the pot less the top-up and one off it raises the alarm", async () => {
    const price = testDeps().contents.current.tuning.lottery.ticket;
    const off = testDeps();
    await drawn(off, BUYS, { amount: 500, topUp: 0 }, { pot: 4, fund: 500, topUp: 300 });
    expect(await drawAlarms(off, utcDay(close))).toEqual([{ kind: "draw", day: utcDay(close), draw: 0, check: "ticket", total: 3 * price, limit: 4 * price }]);
  });
});
