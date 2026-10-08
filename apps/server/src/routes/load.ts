// The load test's own routes (docs/rules/load.md R-LOAD-002, R-LOAD-003,
// R-LOAD-010, R-LOAD-011): make a test account, play a character forward
// before the run, read its legal commands without writing, hand over its
// rows for the verifier, and count what the stores wrote. Each answers 404
// unless `testing.testLogin` is on, and only the load test's Worker mounts them.
import { hashState, viewFor } from "@japacity/sim";
import type { PlayerStore, Work, Writes } from "@japacity/store";
import { Hono } from "hono";

import { legalCommands } from "../../../../packages/sim/src/testing/legal";
import type { Loose } from "../../../../packages/sim/src/testing/play";
import { refusal } from "../authority/answer";
import { characterOf } from "../authority/command";
import { apply, load } from "../authority/load";
import { transact } from "../authority/transaction";
import { earnTurns } from "../clock/turns";
import { tickAt, turnClock } from "../clock/view";
import type { ServerDeps } from "../deps";
import { storedWorlds, tickRow } from "../world/ticks";

/** R-LOAD-010, R-LOAD-011: what the stores accepted since the Worker started. Bytes are JSON characters. */
export interface WriteCounts {
  characters: number;
  rows: number;
  snapshots: number;
  rowBytes: number;
  snapshotBytes: number;
}

export function emptyCounts(): WriteCounts {
  return { characters: 0, rows: 0, snapshots: 0, rowBytes: 0, snapshotBytes: 0 };
}

const sizeOf = (value: unknown) => JSON.stringify(value).length;

/** Adds one accepted transaction's writes to the counts. */
export function countWrites(counts: WriteCounts, writes: Writes): void {
  for (const write of writes.characters ?? []) {
    for (const row of write.append ?? []) {
      counts.rows += 1;
      counts.rowBytes += sizeOf(row);
    }
    for (const snapshot of write.snapshots ?? []) {
      counts.snapshots += 1;
      counts.snapshotBytes += sizeOf(snapshot);
    }
  }
}

/** R-LOAD-010, R-LOAD-011: the store with every accepted write counted, the snapshot of version 0 at creation included. */
export function countingPlayerStore(inner: PlayerStore, counts: WriteCounts): PlayerStore {
  return {
    ...inner,
    create: async (character) => {
      const made = await inner.create(character);
      if (made.ok) {
        counts.characters += 1;
        counts.snapshots += 1;
        counts.snapshotBytes += sizeOf(made.value.snapshot);
      }
      return made;
    },
    transact: async <T>(ids: readonly string[], work: Work<T>) => {
      const seen: { writes: Writes | null } = { writes: null };
      const done = await inner.transact(ids, async (rows) => {
        const out = await work(rows);
        seen.writes = out.writes;
        return out;
      });
      if (done.ok && seen.writes !== null) countWrites(counts, seen.writes);
      return done;
    },
  };
}

/** R-LOAD-003: what a virtual user builds its command from. `basedOn` is the stored version the command route compares. */
export interface LoadView {
  ok: true;
  character: string;
  account: string;
  basedOn: number;
  ended: boolean;
  legal: Loose[];
}

/** R-LOAD-010: a character's rows as the verifier replays them. `snapshot` is the latest one, with the hash of its state. */
export interface LoadRows {
  ok: true;
  character: { id: string; account: string; v: number; segment: number };
  segments: unknown[];
  log: unknown[];
  snapshot: { v: number; segment: number; hash: string };
}

/** The answers that hold the turn: while one waits, `turn/end` is not legal. */
const ANSWERS = ["prologue/choose", "setpiece/answer", "interview/answer"] as const;

/** R-LOAD-002: a warming step, an answer the turn waits on first, then a month; `pick` chooses among the options. Null when neither is legal. */
export function warmCommand(legal: readonly Loose[], pick: number): Loose | null {
  for (const type of [...ANSWERS, "turn/end"]) {
    const found = legal.filter((command) => command.type === type);
    if (found.length > 0) return found[pick % found.length] ?? null;
  }
  return null;
}

/** Steps past the months asked for, for the answers a month can raise. */
const EXTRA_STEPS = 40;

/**
 * R-LOAD-002: plays up to `months` months for one character. in one
 * transaction, so 100,000 accounts seed in minutes rather than hours; it
 * writes the rows a player's commands would (each command's row and hash, a
 * snapshot at every multiple of `snapshotEvery`), and the fast clock's
 * refill as the authority's grant whenever the bank is empty.
 */
async function warm(deps: ServerDeps, character: string, months: number, seed: number): Promise<{ played: number; v: number } | null> {
  const outcome = await transact(deps, [character], (lives, turn) => {
    const live = lives[0];
    if (live === undefined) throw new Error("No character was held.");
    const cap = live.content.tuning.turn.cap;
    let played = 0;
    for (let steps = 0; played < months && steps < months + EXTRA_STEPS; steps += 1) {
      if (live.state.turn.banked < 1 && !live.state.turn.ended) {
        const granted = turn.send(live, { type: "turns/grant", count: cap - live.state.turn.banked, basedOn: live.state.v }, "authority");
        if (!granted.ok) break;
      }
      const command = warmCommand(legalCommands(viewFor({ state: live.state, world: turn.world, content: live.content })), seed + steps);
      if (command === null) break;
      const result = turn.send(live, { ...command, basedOn: live.state.v }, "player");
      if (!result.ok) break;
      if (command.type === "turn/end") played += 1;
    }
    return { ok: true, value: { played, v: live.state.v } };
  });
  return outcome.kind === "done" ? outcome.value : null;
}

const notFound = () => refusal(404, "unknown-id", "Not found.");

/**
 * R-LOAD-003: the legal commands of the character's current view, read
 * without a lock and written nowhere. The earned grant is stepped in memory,
 * as the command's own transaction will step it first.
 */
async function loadView(deps: ServerDeps, character: string): Promise<LoadView | null> {
  const held = await deps.stores.player.load(character);
  if (held === null) return null;
  const worlds = await storedWorlds(deps, held.tail.map((row) => row.tick));
  const loaded = load(held, deps.contents, worlds);
  if (!loaded.ok) return null;
  const live = loaded.live;
  const at = deps.now();
  const world = (await tickRow(deps, tickAt(deps.config.clock, at))).world;
  const earned = earnTurns(live.state, live.refilledAt, at, turnClock(deps.config, live.content.tuning.turn.cap));
  if (earned.grant > 0) apply(live, { type: "turns/grant", count: earned.grant, basedOn: live.state.v }, "authority", world, at, deps.config.server.snapshotEvery);
  const view = viewFor({ state: live.state, world, content: live.content });
  return { ok: true, character: live.id, account: live.account, basedOn: live.storedV, ended: view.ended, legal: legalCommands(view) };
}

/** The load test's routes, over the counts its Worker keeps. */
export function loadRoutes(deps: ServerDeps, counts: WriteCounts): Hono {
  const route = new Hono();
  route.use("/api/load/*", async (c, next) => {
    if (!deps.config.testing.testLogin) {
      const { status, body } = notFound();
      return c.json(body, status);
    }
    await next();
  });

  // R-LOAD-002: the account row the sign-in makes, for the test session's account.
  route.post("/api/load/account", async (c) => {
    const session = await deps.session(c.req.raw);
    if (session === null) {
      const { status, body } = refusal(401, "signed-out", "Send the test account header.");
      return c.json(body, status);
    }
    const known = await deps.stores.account.get(session.account);
    if (known === null) {
      const made = await deps.stores.account.create({
        id: session.account,
        country: "NG",
        age: { passed: true, at: deps.now(), method: "declared" },
        createdAt: deps.now(),
        character: null,
        notifyBankFull: false,
        sendUsageCounts: true,
      });
      if (!made.ok) throw new Error(made.detail);
    }
    return c.json({ ok: true, account: session.account, character: await characterOf(deps, session.account) });
  });

  route.post("/api/load/warm/:character", async (c) => {
    const body = (await c.req.json().catch(() => null)) as { months?: unknown; seed?: unknown } | null;
    const months = typeof body?.months === "number" && Number.isSafeInteger(body.months) && body.months >= 0 ? body.months : null;
    const seed = typeof body?.seed === "number" && Number.isSafeInteger(body.seed) && body.seed >= 0 ? body.seed : 0;
    const played = months === null ? null : await warm(deps, c.req.param("character"), months, seed);
    if (played === null) {
      const { status, body: refused } = months === null ? refusal(400, "bad-amount", "Name the months to play.") : notFound();
      return c.json(refused, status);
    }
    return c.json({ ok: true, ...played });
  });

  route.get("/api/load/view/:character", async (c) => {
    const found = await loadView(deps, c.req.param("character"));
    if (found === null) {
      const { status, body } = notFound();
      return c.json(body, status);
    }
    return c.json(found);
  });

  route.get("/api/load/rows/:character", async (c) => {
    const id = c.req.param("character");
    const held = await deps.stores.player.load(id);
    if (held === null) {
      const { status, body } = notFound();
      return c.json(body, status);
    }
    const { snapshot } = held;
    const rows: LoadRows = {
      ok: true,
      character: { id, account: held.character.account, v: held.character.v, segment: held.character.segment },
      segments: held.segments,
      log: await deps.stores.player.log(id, 0),
      snapshot: { v: snapshot.v, segment: snapshot.segment, hash: hashState(snapshot.state) },
    };
    return c.json(rows);
  });

  route.get("/api/load/world/:tick", async (c) => {
    const tick = Number(c.req.param("tick"));
    const row = Number.isSafeInteger(tick) && tick >= 0 ? await deps.stores.world.tick(tick) : null;
    if (row === null) {
      const { status, body } = notFound();
      return c.json(body, status);
    }
    return c.json({ ok: true, tick: row.tick, world: row.world, content: row.content, hash: row.hash });
  });

  route.get("/api/load/stats", (c) =>
    c.json({ ok: true, counts, snapshotEvery: deps.config.server.snapshotEvery, content: deps.contents.current.version, now: deps.now() }),
  );

  return route;
}
