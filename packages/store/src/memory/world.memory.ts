import type { DrawRow, TicketRow, WorldStore, WorldTickRow } from "../types";
import { accept, copy, refuse } from "./copy.memory";

/** R-CLOCK-010, R-CLOCK-013, R-LOTTERY-005 to 015: ticks, draws and tickets in maps. */
export function memoryWorldStore(): WorldStore {
  const ticks = new Map<number, WorldTickRow>();
  const draws = new Map<number, DrawRow>();
  const tickets = new Map<number, TicketRow[]>();

  return {
    tick: (n) => Promise.resolve(copy(ticks.get(n) ?? null)),
    latest: () => {
      let highest: WorldTickRow | null = null;
      for (const row of ticks.values()) if (highest === null || row.tick > highest.tick) highest = row;
      return Promise.resolve(copy(highest));
    },
    insertTick: (row) => {
      if (ticks.has(row.tick)) return Promise.resolve(false);
      ticks.set(row.tick, copy(row));
      return Promise.resolve(true);
    },
    draw: (n) => Promise.resolve(copy(draws.get(n) ?? null)),
    putDraw: (row) => {
      const stored = draws.get(row.draw);
      if (stored === undefined) {
        const made: DrawRow = { draw: row.draw, secret: row.secret, fingerprint: row.fingerprint, beaconRound: row.beaconRound, closedAt: null, result: null };
        draws.set(row.draw, made);
        return Promise.resolve(accept(made));
      }
      if (stored.secret !== row.secret || stored.fingerprint !== row.fingerprint || stored.beaconRound !== row.beaconRound) {
        return Promise.resolve(refuse("conflict", `Draw ${String(row.draw)} is already stored with other commitments.`));
      }
      return Promise.resolve(accept(stored));
    },
    addTickets: (draw, character, count) => {
      const stored = draws.get(draw);
      if (stored === undefined) return Promise.resolve(refuse("missing", `No draw ${String(draw)}.`));
      if (stored.closedAt !== null) return Promise.resolve(refuse("closed", `Draw ${String(draw)} is frozen.`));
      if (!Number.isSafeInteger(count) || count < 1) {
        return Promise.resolve(refuse("bad-write", `A purchase is a whole number of tickets from 1, not ${String(count)}.`));
      }
      const list = tickets.get(draw) ?? [];
      const numbers: number[] = [];
      for (let i = 0; i < count; i++) {
        numbers.push(list.length);
        list.push({ draw, n: list.length, character });
      }
      tickets.set(draw, list);
      return Promise.resolve(accept(numbers));
    },
    tickets: (draw) => Promise.resolve(copy(tickets.get(draw) ?? [])),
    freeze: (draw, at) => {
      const stored = draws.get(draw);
      if (stored === undefined) return Promise.resolve(refuse("missing", `No draw ${String(draw)}.`));
      stored.closedAt ??= at;
      return Promise.resolve(accept(tickets.get(draw) ?? []));
    },
    setResult: (draw, result) => {
      const stored = draws.get(draw);
      if (stored === undefined) return Promise.resolve(refuse("missing", `No draw ${String(draw)}.`));
      if (stored.closedAt === null) return Promise.resolve(refuse("open", `Draw ${String(draw)} is not frozen yet.`));
      if (stored.result !== null) return Promise.resolve(refuse("conflict", `Draw ${String(draw)} already has its result.`));
      stored.result = copy(result);
      return Promise.resolve(accept(stored));
    },
  };
}
