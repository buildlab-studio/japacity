import type { DrawRow, TicketRow, WorldStore, WorldTickRow } from "@japacity/store";
import { sameDraw } from "@japacity/store";
import { asc, count, desc, eq } from "drizzle-orm";

import type { Handle, Queries } from "../handle";
import { drawTickets, draws, worldTicks } from "../schema";
import { accept, refuse } from "./result";

function toDraw(row: typeof draws.$inferSelect): DrawRow {
  return {
    draw: row.draw,
    secret: row.secret,
    fingerprint: row.fingerprint,
    beaconRound: row.beaconRound,
    topUpTickets: row.topUpTickets,
    odds: row.odds,
    jackpot: row.jackpot,
    closedAt: row.closedAt,
    list: row.list,
    listHash: row.listHash,
    result: row.result,
  };
}

function toTick(row: typeof worldTicks.$inferSelect): WorldTickRow {
  return { tick: row.tick, world: row.world, book: row.book, content: row.content, hash: row.hash };
}

const ticketColumns = { draw: drawTickets.draw, n: drawTickets.n, character: drawTickets.character };

async function ticketsOf(db: Queries, draw: number): Promise<TicketRow[]> {
  return db.select(ticketColumns).from(drawTickets).where(eq(drawTickets.draw, draw)).orderBy(asc(drawTickets.n));
}

/** The draw's row, locked until the transaction ends; null for an unknown draw. */
async function lockDraw(tx: Queries, draw: number): Promise<DrawRow | null> {
  const [row] = await tx.select().from(draws).where(eq(draws.draw, draw)).for("update");
  return row === undefined ? null : toDraw(row);
}

/**
 * R-CLOCK-010, R-CLOCK-013, R-LOTTERY-005 to 015: ticks are inserted once and
 * never updated; tickets are numbered and the draw closed under the draw's row lock.
 */
export function pgWorldStore(handle: Handle): WorldStore {
  return {
    tick: (tick) =>
      handle.read(async (db) => {
        const [row] = await db.select().from(worldTicks).where(eq(worldTicks.tick, tick));
        return row === undefined ? null : toTick(row);
      }),

    latest: () =>
      handle.read(async (db) => {
        const [row] = await db.select().from(worldTicks).orderBy(desc(worldTicks.tick)).limit(1);
        return row === undefined ? null : toTick(row);
      }),

    insertTick: (row) =>
      handle.read(async (db) => {
        const stored = await db.insert(worldTicks).values(row).onConflictDoNothing().returning({ tick: worldTicks.tick });
        return stored.length > 0;
      }),

    draw: (draw) =>
      handle.read(async (db) => {
        const [row] = await db.select().from(draws).where(eq(draws.draw, draw));
        return row === undefined ? null : toDraw(row);
      }),

    putDraw: (row) =>
      handle.transaction(async (tx) => {
        const { draw, secret, fingerprint, beaconRound, topUpTickets, odds, jackpot } = row;
        await tx.insert(draws).values({ draw, secret, fingerprint, beaconRound, topUpTickets, odds, jackpot }).onConflictDoNothing();
        const stored = await lockDraw(tx, draw);
        if (stored === null) throw new Error(`Draw ${String(draw)} was not stored.`);
        if (!sameDraw(stored, row)) {
          return refuse("conflict", `Draw ${String(draw)} is already stored with other commitments.`);
        }
        return accept(stored);
      }),

    addTickets: (draw, character, wanted) =>
      handle.transaction(async (tx) => {
        const stored = await lockDraw(tx, draw);
        if (stored === null) return refuse("missing", `No draw ${String(draw)}.`);
        if (stored.closedAt !== null) return refuse("closed", `Draw ${String(draw)} is frozen.`);
        if (!Number.isSafeInteger(wanted) || wanted < 1) {
          return refuse("bad-write", `A purchase is a whole number of tickets from 1, not ${String(wanted)}.`);
        }
        const [held] = await tx.select({ total: count() }).from(drawTickets).where(eq(drawTickets.draw, draw));
        const first = held?.total ?? 0;
        const numbers: number[] = [];
        for (let next = first; next < first + wanted; next++) numbers.push(next);
        await tx.insert(drawTickets).values(numbers.map((number) => ({ draw, n: number, character })));
        return accept(numbers);
      }),

    tickets: (draw) => handle.read((db) => ticketsOf(db, draw)),

    freeze: (draw, at) =>
      handle.transaction(async (tx) => {
        const stored = await lockDraw(tx, draw);
        if (stored === null) return refuse("missing", `No draw ${String(draw)}.`);
        if (stored.closedAt === null) await tx.update(draws).set({ closedAt: at }).where(eq(draws.draw, draw));
        return accept(await ticketsOf(tx, draw));
      }),

    setList: (draw, list, listHash) =>
      handle.transaction(async (tx) => {
        const stored = await lockDraw(tx, draw);
        if (stored === null) return refuse("missing", `No draw ${String(draw)}.`);
        if (stored.closedAt === null) return refuse("open", `Draw ${String(draw)} is not frozen yet.`);
        if (stored.list !== null) {
          const same = stored.listHash === listHash && stored.list.length === list.length && stored.list.every((token, index) => token === list[index]);
          return same ? accept(stored) : refuse("conflict", `Draw ${String(draw)} already has its list.`);
        }
        const [updated] = await tx.update(draws).set({ list: [...list], listHash }).where(eq(draws.draw, draw)).returning();
        if (updated === undefined) throw new Error(`Draw ${String(draw)} vanished under its lock.`);
        return accept(toDraw(updated));
      }),

    setResult: (draw, result) =>
      handle.transaction(async (tx) => {
        const stored = await lockDraw(tx, draw);
        if (stored === null) return refuse("missing", `No draw ${String(draw)}.`);
        if (stored.closedAt === null) return refuse("open", `Draw ${String(draw)} is not frozen yet.`);
        if (stored.result !== null) return refuse("conflict", `Draw ${String(draw)} already has its result.`);
        const [updated] = await tx.update(draws).set({ result }).where(eq(draws.draw, draw)).returning();
        if (updated === undefined) throw new Error(`Draw ${String(draw)} vanished under its lock.`);
        return accept(toDraw(updated));
      }),
  };
}
