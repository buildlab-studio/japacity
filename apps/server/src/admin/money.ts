// The money report (R-SERVER-011) and the alarms the same job finds
// (R-SERVER-012, R-LOTTERY-014). A character's mark holds its totals with the
// transfers left out, as `ledgerReport` gives them; the day's totals are the
// differences between marks.
import type { Content, State, WalletSlice } from "@japacity/sim";
import { int } from "@japacity/sim";
import type { ByReason, LogRow, SegmentRow } from "@japacity/store";

import { prizesOwed } from "../../../../packages/sim/src/lottery/lottery.draw";
import { ledgerReport } from "../../../../packages/sim/src/wallet/report";
import type { ServerDeps } from "../deps";
import { activeOn, noteActive } from "./active";
import type { Alarm } from "./alarm";
import { dayStart } from "./day";
import { contentNamed, stateNow } from "./load";

type MoneyDeps = Pick<ServerDeps, "config" | "contents" | "stores">;
type Totals = WalletSlice["totals"];

/** R-LOTTERY-002: draw `n` sells from tick 14n and closes when tick 14(n + 1) begins. */
export const TICKS_PER_DRAW = 14;

function contentOf(deps: Pick<ServerDeps, "contents">, state: State): Content {
  const { current, previous } = deps.contents;
  return previous !== null && previous.version === state.content && current.version !== state.content ? previous : current;
}

/** The totals a mark holds: the transfers `convert`, `move` and `remit` left out, as `ledgerReport` does. */
function accounted(state: State, content: Content): Totals {
  const report = ledgerReport(state, content);
  return { in: report.created, out: report.destroyed };
}

function less(now: Totals["in"], before: Totals["in"] | undefined): ByReason {
  const out: ByReason = {};
  for (const [reason, byCurrency] of Object.entries(now) as [keyof ByReason, ByReason[keyof ByReason]][]) {
    for (const [currency, amount] of Object.entries(byCurrency ?? {}) as [keyof NonNullable<ByReason[keyof ByReason]>, number | undefined][]) {
      const change = (amount ?? 0) - (before?.[reason]?.[currency] ?? 0);
      if (change !== 0) (out[reason] ??= {})[currency] = change;
    }
  }
  // A reason the mark holds and the state does not can only follow a correction by the rollback tool.
  for (const [reason, byCurrency] of Object.entries(before ?? {}) as [keyof ByReason, ByReason[keyof ByReason]][]) {
    for (const [currency, amount] of Object.entries(byCurrency ?? {}) as [keyof NonNullable<ByReason[keyof ByReason]>, number | undefined][]) {
      if (now[reason]?.[currency] === undefined && (amount ?? 0) !== 0) (out[reason] ??= {})[currency] = -(amount ?? 0);
    }
  }
  return out;
}

/**
 * R-SERVER-011, R-SERVER-002: the core calls this after every commit with the
 * state the transaction loaded, before this commit's commands, and the UTC day
 * of the commit. On a character's first commit of a day it closes the day of
 * its last mark: what the character made since that mark goes to that day,
 * and the mark moves to this one. Any other commit only notes the character
 * as active for the day's job.
 */
export async function markAfterCommit(deps: Pick<ServerDeps, "contents" | "stores">, character: string, state: State, day: number): Promise<void> {
  noteActive(deps, character, day);
  // Most commits are not a day's first: one read settles them, and only a day's first opens a transaction.
  const seen = await deps.stores.ledger.mark(character);
  if (seen !== null && seen.day >= day) return;
  // R-SERVER-011: the day's totals and the mark move in one transaction, read again inside it.
  await deps.stores.ledger.transaction(async (ledger) => {
    const mark = await ledger.mark(character);
    if (mark !== null && mark.day >= day) return;
    const totals = accounted(state, contentOf(deps, state));
    await ledger.addDay(mark?.day ?? day, less(totals.in, mark?.totals.in), less(totals.out, mark?.totals.out));
    await ledger.setMark(character, totals, day);
  });
}

export interface MoneyDay {
  day: number;
  /** The characters that logged a command on the day. */
  characters: string[];
  /** The characters whose day this report closed; the rest were closed by their own first commit of a later day. */
  closed: string[];
  /** The characters the report could not read, and why. */
  skipped: { character: string; why: string }[];
  /** R-SERVER-012: what the report found; the job raises them. */
  alarms: Alarm[];
}

/**
 * R-SERVER-011, R-SERVER-012: for every character that logged a command on the
 * day (the isolate's list unless the caller reads the log), adds what it made since its last mark to the day's totals and moves the
 * mark to the next day, and lists every alarm `ledgerReport` raises on it.
 */
export async function moneyReport(deps: MoneyDeps, day: number, active: readonly string[] = activeOn(deps, day)): Promise<MoneyDay> {
  const result: MoneyDay = { day, characters: [...active], closed: [], skipped: [], alarms: [] };
  for (const character of result.characters) {
    const held = await deps.stores.player.load(character);
    if (held === null) {
      result.skipped.push({ character, why: "missing" });
      continue;
    }
    const now = await stateNow(deps, held);
    if (!now.ok) {
      result.skipped.push({ character, why: `${now.code}: ${now.detail}` });
      continue;
    }
    if (now.value.firstDiff !== null) {
      result.skipped.push({ character, why: "diverged" });
      result.alarms.push({ kind: "diverged", day, character, v: now.value.firstDiff.v });
      continue;
    }
    const report = ledgerReport(now.value.state, now.value.content);
    for (const alarm of report.alarms) result.alarms.push({ kind: "suspect", day, character, ...alarm });

    // R-SERVER-011: the day's totals and the mark move in one transaction, so a failure between the
    // two writes keeps neither and a rerun of the job adds the day once.
    const totals: Totals = { in: report.created, out: report.destroyed };
    const closed = await deps.stores.ledger.transaction(async (ledger) => {
      const mark = await ledger.mark(character);
      if (mark !== null && mark.day > day) return false;
      await ledger.addDay(day, less(totals.in, mark?.totals.in), less(totals.out, mark?.totals.out));
      await ledger.setMark(character, totals, day + 1);
      return true;
    });
    if (closed) result.closed.push(character);
  }
  return result;
}

/** The draws that close within the UTC day (R-LOTTERY-002). */
export function drawsClosingOn(deps: Pick<ServerDeps, "config">, day: number): number[] {
  const { epoch, worldTickMs } = deps.config.clock;
  const drawMs = TICKS_PER_DRAW * worldTickMs;
  const from = dayStart(day);
  const until = dayStart(day + 1);
  const draws: number[] = [];
  for (let draw = Math.max(0, int.divCeil(from - epoch, drawMs) - 1); epoch + (draw + 1) * drawMs < until; draw += 1) {
    if (epoch + (draw + 1) * drawMs >= from) draws.push(draw);
  }
  return draws;
}

function contentAt(deps: Pick<ServerDeps, "contents">, segments: readonly SegmentRow[], v: number): Content {
  const segment = segments.findLast((each) => each.fromV < v);
  return (segment === undefined ? null : contentNamed(deps, segment.content, segment.overlay)) ?? deps.contents.current;
}

/** A house part a payout logged before decision 0010 may still carry; nothing logs one now. */
function housePart(prize: object): number {
  const { topUp } = prize as { topUp?: unknown };
  return typeof topUp === "number" ? topUp : 0;
}

/**
 * R-LOTTERY-014: checks every draw that closed on the day and has a result.
 * A `win` belongs to the draw its `lottery/pay` command names; a `ticket` to
 * the draw on sale at the tick its `lottery/buy` was stepped at. All are read
 * from the logs of the characters on the draw's ticket list. The `win` paid
 * must be what R-LOTTERY-011 gives the result, `pot-top-up` must be 0
 * (decision 0010), and the tickets taken must be the sales: the tickets sold
 * at the current price.
 */
export async function drawAlarms(deps: MoneyDeps, day: number): Promise<Alarm[]> {
  const alarms: Alarm[] = [];
  for (const draw of drawsClosingOn(deps, day)) {
    const row = await deps.stores.world.draw(draw);
    const result = row?.result ?? null;
    if (result === null) continue;
    const holders = [...new Set((await deps.stores.world.tickets(draw)).map((ticket) => ticket.character))];
    let won = 0;
    let house = 0;
    let sold = 0;
    for (const character of holders) {
      const held = await deps.stores.player.load(character);
      if (held === null) continue;
      const log: LogRow[] = await deps.stores.player.log(character, held.segments[0]?.fromV ?? 0);
      for (const entry of log) {
        const { command } = entry;
        if (command.type === "lottery/pay" && command.draw === draw) {
          won += command.prizes.reduce((sum, prize) => sum + prize.amount, 0);
          house += command.prizes.reduce((sum, prize) => sum + housePart(prize), 0);
        }
        if (command.type === "lottery/buy" && entry.tick >= draw * TICKS_PER_DRAW && entry.tick < (draw + 1) * TICKS_PER_DRAW) {
          sold += command.tickets * contentAt(deps, held.segments, entry.v).tuning.lottery.ticket;
        }
      }
    }
    const owed = prizesOwed(result.winners);
    if (won !== owed) alarms.push({ kind: "draw", day, draw, check: "win", total: won, limit: owed });
    if (house !== 0) alarms.push({ kind: "draw", day, draw, check: "top-up", total: house, limit: 0 });
    const sales = result.count * deps.contents.current.tuning.lottery.ticket;
    if (sold !== sales) alarms.push({ kind: "draw", day, draw, check: "ticket", total: sold, limit: sales });
  }
  return alarms;
}
