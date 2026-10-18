import { compareIds, pairIds, pairKey, refuse } from "@japacity/store";
import type {
  CharacterRow,
  CharacterWrite,
  Held,
  LogRow,
  PairRow,
  PairStore,
  PairWrite,
  PlayerStore,
  Refusal,
  SegmentRow,
  SnapshotRow,
  StoreResult,
  TxStores,
  Work,
} from "@japacity/store";
import { and, asc, desc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";

import type { Handle, Queries } from "../handle";
import { oneConnection } from "../handle";
import { characters, commandLog, pairs, segments, snapshots } from "../schema";
import { pgAuditStore } from "./audit";
import { pgWorldStore } from "./world";

type SegmentSelect = typeof segments.$inferSelect;
type SnapshotSelect = typeof snapshots.$inferSelect;
type LogSelect = typeof commandLog.$inferSelect;

/** A null overlay column is an absent key, as the memory store keeps it. */
function overlayOf(overlay: string | null): { overlay?: string } {
  return overlay === null ? {} : { overlay };
}

function toSegment(row: SegmentSelect): SegmentRow {
  return { character: row.character, segment: row.segment, fromV: row.fromV, content: row.content, ...overlayOf(row.overlay), start: row.start };
}

function toSnapshot(row: SnapshotSelect): SnapshotRow {
  return { character: row.character, v: row.v, segment: row.segment, content: row.content, ...overlayOf(row.overlay), state: row.state };
}

function toLog(row: LogSelect): LogRow {
  return { character: row.character, v: row.v, tick: row.tick, sender: row.sender, command: row.command, hash: row.hash, at: row.at };
}

function toPair(row: typeof pairs.$inferSelect): PairRow {
  return { key: row.key, a: row.a, b: row.b, v: row.v, record: row.record };
}

const characterColumns = {
  id: characters.id,
  account: characters.account,
  v: characters.v,
  refilledAt: characters.refilledAt,
  segment: characters.segment,
  fullAt: characters.fullAt,
  fullNotifiedAt: characters.fullNotifiedAt,
};

/** R-SERVER-007: one row, locked for the rest of the transaction; null for an unknown id. */
async function lockRow(tx: Queries, id: string, strength: "update" | "share"): Promise<CharacterRow | null> {
  const [row] = await tx.select(characterColumns).from(characters).where(eq(characters.id, id)).for(strength);
  return row ?? null;
}

/** R-SERVER-004: the latest snapshot of the segment in force, and the rows after it. */
async function readHeld(tx: Queries, row: CharacterRow): Promise<Held> {
  const stored = await tx.select().from(segments).where(eq(segments.character, row.id)).orderBy(asc(segments.segment));
  const [latest] = await tx
    .select()
    .from(snapshots)
    .where(and(eq(snapshots.character, row.id), eq(snapshots.segment, row.segment)))
    .orderBy(desc(snapshots.v))
    .limit(1);
  if (latest === undefined) throw new Error(`Character ${row.id} has no snapshot in segment ${String(row.segment)}.`);
  const tail = await tx
    .select()
    .from(commandLog)
    .where(and(eq(commandLog.character, row.id), gt(commandLog.v, latest.v)))
    .orderBy(asc(commandLog.v));
  return { character: row, segments: stored.map(toSegment), snapshot: toSnapshot(latest), tail: tail.map(toLog) };
}

/** What one character's accepted write does to the tables. */
interface Plan {
  row: CharacterRow;
  segment: SegmentRow | null;
  append: LogRow[];
  snapshots: SnapshotRow[];
  retire: { segment: number; after: number; upTo: number }[];
}

const snapshotKey = (segment: number, v: number) => `${String(segment)}:${String(v)}`;

/**
 * Checks one character's writes against its stored row and segments, in the
 * order and with the codes of the memory store, and returns what to write.
 * `stored` holds the (segment, v) of every snapshot already stored at a
 * version the write names.
 */
function planCharacter(held: Held, stored: Set<string>, write: CharacterWrite): Plan | Refusal {
  const id = held.character.id;
  const bad = (detail: string) => refuse("bad-write", `${id}: ${detail}`);
  const row = { ...held.character };
  let ordered = held.segments.map((each) => ({ segment: each.segment, fromV: each.fromV }));
  const plan: Plan = { row, segment: null, append: [], snapshots: [], retire: [] };

  if (write.segment !== undefined) {
    const segment = write.segment;
    if (segment.character !== id) return bad(`a segment for ${segment.character}.`);
    if (segment.segment !== row.segment + 1) return bad(`segment ${String(segment.segment)} does not follow ${String(row.segment)}.`);
    if (segment.fromV < row.v) return bad(`segment ${String(segment.segment)} starts at ${String(segment.fromV)}, under version ${String(row.v)}.`);
    const base = write.snapshots?.some((each) => each.segment === segment.segment && each.v === segment.fromV) ?? false;
    if (!base) return bad(`segment ${String(segment.segment)} comes without its base snapshot.`);
    plan.segment = segment;
    ordered.push({ segment: segment.segment, fromV: segment.fromV });
    row.segment = segment.segment;
    row.v = segment.fromV;
  }

  for (const log of write.append ?? []) {
    if (log.character !== id) return bad(`a log row for ${log.character}.`);
    if (log.v <= row.v) return refuse("stale", `${id}: version ${String(log.v)} is at or under the stored ${String(row.v)}.`);
    if (log.v !== row.v + 1) return bad(`version ${String(log.v)} skips from ${String(row.v)}.`);
    plan.append.push(log);
    row.v = log.v;
  }

  const fromV = ordered.find((each) => each.segment === row.segment)?.fromV ?? 0;
  for (const snapshot of write.snapshots ?? []) {
    if (snapshot.character !== id) return bad(`a snapshot for ${snapshot.character}.`);
    if (snapshot.segment !== row.segment) return bad(`a snapshot for segment ${String(snapshot.segment)}, not the one in force.`);
    if (snapshot.v < fromV || snapshot.v > row.v) return bad(`a snapshot at ${String(snapshot.v)}, outside ${String(fromV)} to ${String(row.v)}.`);
    const key = snapshotKey(snapshot.segment, snapshot.v);
    if (stored.has(key)) return bad(`a snapshot at ${String(snapshot.v)} is already stored and is never rewritten.`);
    stored.add(key);
    plan.snapshots.push(snapshot);
  }

  if (write.refilledAt !== undefined) row.refilledAt = write.refilledAt;

  for (const segment of write.retire ?? []) {
    if (segment === row.segment) return bad(`segment ${String(segment)} is in force and cannot be retired.`);
    ordered = [...ordered].sort((left, right) => left.segment - right.segment);
    const at = ordered.findIndex((each) => each.segment === segment);
    const own = ordered[at];
    if (own === undefined) return bad(`no segment ${String(segment)} to retire.`);
    plan.retire.push({ segment, after: own.fromV, upTo: ordered[at + 1]?.fromV ?? row.v });
    ordered = ordered.filter((each) => each.segment !== segment);
  }
  return plan;
}

/** Checks one pair write against the records read under the locks. */
function planPair(between: ReadonlyMap<string, PairRow>, heldIds: ReadonlySet<string>, write: PairWrite, seen: Set<string>): PairRow | Refusal {
  const ids = pairIds(write.key);
  if (ids === null) return refuse("bad-write", `${write.key} is not two sorted ids joined by a tilde.`);
  if (seen.has(write.key)) return refuse("bad-write", `${write.key} is written twice in one transaction.`);
  seen.add(write.key);
  if (!heldIds.has(ids.a) || !heldIds.has(ids.b)) return refuse("not-held", `${write.key} is written without holding both characters.`);
  const storedV = between.get(write.key)?.v ?? 0;
  if (write.expectedV !== storedV) {
    return refuse("stale", `${write.key} is at version ${String(storedV)}, and the write expected ${String(write.expectedV)}.`);
  }
  return { key: write.key, a: ids.a, b: ids.b, v: storedV + 1, record: write.record };
}

const isRefusal = (value: object): value is Refusal => "ok" in value && value.ok === false;

/** The (segment, v) of every stored snapshot of `id` at one of the versions `write` names. */
async function storedSnapshots(tx: Queries, id: string, write: CharacterWrite): Promise<Set<string>> {
  const versions = [...new Set((write.snapshots ?? []).map((each) => each.v))];
  if (versions.length === 0) return new Set();
  const found = await tx
    .select({ segment: snapshots.segment, v: snapshots.v })
    .from(snapshots)
    .where(and(eq(snapshots.character, id), inArray(snapshots.v, versions)));
  return new Set(found.map((each) => snapshotKey(each.segment, each.v)));
}

async function applyPlan(tx: Queries, plan: Plan): Promise<void> {
  const id = plan.row.id;
  if (plan.segment !== null) {
    const { character, segment, fromV, content, overlay, start } = plan.segment;
    await tx.insert(segments).values({ character, segment, fromV, content, overlay: overlay ?? null, start });
  }
  if (plan.append.length > 0) await tx.insert(commandLog).values(plan.append);
  if (plan.snapshots.length > 0) {
    await tx.insert(snapshots).values(plan.snapshots.map(({ character, segment, v, content, overlay, state }) => ({ character, segment, v, content, overlay: overlay ?? null, state })));
  }
  for (const retired of plan.retire) {
    await tx
      .delete(commandLog)
      .where(and(eq(commandLog.character, id), gt(commandLog.v, retired.after), lte(commandLog.v, retired.upTo)));
    await tx.delete(snapshots).where(and(eq(snapshots.character, id), eq(snapshots.segment, retired.segment)));
    await tx.delete(segments).where(and(eq(segments.character, id), eq(segments.segment, retired.segment)));
  }
  await tx
    .update(characters)
    .set({ v: plan.row.v, segment: plan.row.segment, refilledAt: plan.row.refilledAt })
    .where(eq(characters.id, id));
}

/**
 * R-SERVER-002: the stores a transaction's work is given, on
 * the transaction's own client. Their lock is a new one for this transaction
 * alone: the handle's lock is held for the whole transaction and is never
 * taken again inside it. A store's own transaction becomes a savepoint.
 */
function storesOn(tx: Queries): TxStores {
  const bound = oneConnection(tx);
  return { world: pgWorldStore(bound), audit: pgAuditStore(bound) };
}

/**
 * R-SERVER-002, R-SERVER-007, R-PAIR-004: characters and pair records in
 * Postgres. `transact` locks the rows with `SELECT ... FOR UPDATE` one at a
 * time in ascending code-unit order, checks every write before it writes any,
 * and so commits all of them or none. A refused write rolls back what the
 * work wrote through its stores too.
 */
export function pgPlayerStores(handle: Handle): { player: PlayerStore; pair: PairStore } {
  async function transact<T>(ids: readonly string[], work: Work<T>): Promise<StoreResult<T>> {
    const order = [...new Set(ids)].sort(compareIds);
    // A refusal after the work ran is thrown, so the work's own writes roll back with the rest.
    const thrown: { refusal: Refusal | null } = { refusal: null };
    const rollBack = (refusal: Refusal): never => {
      thrown.refusal = refusal;
      throw new Error(`Rolled back: ${refusal.code}.`);
    };
    try {
      return await handle.transaction(async (tx): Promise<StoreResult<T>> => {
        const rows: CharacterRow[] = [];
        const missing: string[] = [];
        for (const id of order) {
          const row = await lockRow(tx, id, "update");
          if (row === null) missing.push(id);
          else rows.push(row);
        }
        if (missing.length > 0) return refuse("missing", `No character ${missing.join(", ")}.`);

        const held: Held[] = [];
        for (const row of rows) held.push(await readHeld(tx, row));
        const keys: string[] = [];
        for (const [at, lower] of order.entries()) for (const higher of order.slice(at + 1)) keys.push(pairKey(lower, higher));
        const found = keys.length === 0 ? [] : await tx.select().from(pairs).where(inArray(pairs.key, keys));
        const between = found.map(toPair).sort((left, right) => compareIds(left.key, right.key));

        const { writes, result } = await work({ characters: structuredClone(held), pairs: structuredClone(between) }, storesOn(tx));

        const heldIds = new Set(order);
        const written = new Set<string>();
        const plans: Plan[] = [];
        for (const write of writes.characters ?? []) {
          if (!heldIds.has(write.id)) return rollBack(refuse("not-held", `${write.id} is written without being held.`));
          if (written.has(write.id)) return rollBack(refuse("bad-write", `${write.id} is written twice in one transaction.`));
          written.add(write.id);
          const own = held.find((each) => each.character.id === write.id);
          if (own === undefined) throw new Error(`Character ${write.id} vanished under its lock.`);
          const plan = planCharacter(own, await storedSnapshots(tx, write.id, write), write);
          if (isRefusal(plan)) return rollBack(plan);
          plans.push(plan);
        }
        const betweenByKey = new Map(between.map((row) => [row.key, row]));
        const seen = new Set<string>();
        const pairRows: PairRow[] = [];
        for (const write of writes.pairs ?? []) {
          const row = planPair(betweenByKey, heldIds, write, seen);
          if (isRefusal(row)) return rollBack(row);
          pairRows.push(row);
        }

        for (const plan of plans) await applyPlan(tx, plan);
        for (const row of pairRows) {
          await tx
            .insert(pairs)
            .values(row)
            .onConflictDoUpdate({ target: pairs.key, set: { v: row.v, record: row.record } });
        }
        // The result is the caller's own value, handed back as it is.
        return { ok: true, value: result };
      });
    } catch (error) {
      if (thrown.refusal !== null) return thrown.refusal;
      throw error;
    }
  }

  const player: PlayerStore = {
    create: (input) =>
      handle.transaction(async (tx): Promise<StoreResult<Held>> => {
        const row: CharacterRow = { id: input.id, account: input.account, v: 0, refilledAt: input.refilledAt, segment: 0, fullAt: null, fullNotifiedAt: null };
        const made = await tx.insert(characters).values(row).onConflictDoNothing().returning({ id: characters.id });
        if (made.length === 0) return refuse("exists", `Character ${input.id} already exists.`);
        const overlay = input.overlay ?? null;
        await tx.insert(segments).values({ character: input.id, segment: 0, fromV: 0, content: input.content, overlay, start: input.start });
        await tx.insert(snapshots).values({ character: input.id, segment: 0, v: 0, content: input.content, overlay, state: input.state });
        return { ok: true, value: await readHeld(tx, row) };
      }),

    // FOR SHARE waits out a transaction holding the row, so the snapshot and tail are read from one version.
    load: (id) =>
      handle.transaction(async (tx) => {
        const row = await lockRow(tx, id, "share");
        return row === null ? null : readHeld(tx, row);
      }),

    log: (id, after) =>
      handle.read(async (db) => {
        const rows = await db
          .select()
          .from(commandLog)
          .where(and(eq(commandLog.character, id), gt(commandLog.v, after)))
          .orderBy(asc(commandLog.v));
        return rows.map(toLog);
      }),

    transact,

    remove: (id) =>
      handle.transaction(async (tx) => {
        await lockRow(tx, id, "update");
        // R-MODERATION-008: a record a report holds stays until the hold ends.
        await tx.delete(pairs).where(and(or(eq(pairs.a, id), eq(pairs.b, id)), sql`coalesce(${pairs.record} ->> 'held', 'false') <> 'true'`));
        await tx.delete(commandLog).where(eq(commandLog.character, id));
        await tx.delete(snapshots).where(eq(snapshots.character, id));
        await tx.delete(segments).where(eq(segments.character, id));
        await tx.delete(characters).where(eq(characters.id, id));
      }),

    setFullAt: (id, v, fullAt) =>
      handle.read(async (db) => {
        // A changed value clears the claim; the same value keeps it.
        const updated = await db
          .update(characters)
          .set({ fullAt, fullNotifiedAt: sql`case when ${characters.fullAt} is not distinct from ${fullAt} then ${characters.fullNotifiedAt} else null end` })
          .where(and(eq(characters.id, id), eq(characters.v, v)))
          .returning({ id: characters.id });
        return updated.length > 0;
      }),

    filled: (now) =>
      handle.read(async (db) => {
        const rows = await db
          .select(characterColumns)
          .from(characters)
          .where(and(lte(characters.fullAt, now), isNull(characters.fullNotifiedAt)));
        return rows.sort((left, right) => compareIds(left.id, right.id));
      }),

    claimFull: (id, fullAt, at) =>
      handle.read(async (db) => {
        const claimed = await db
          .update(characters)
          .set({ fullNotifiedAt: at })
          .where(and(eq(characters.id, id), eq(characters.fullAt, fullAt), isNull(characters.fullNotifiedAt)))
          .returning({ id: characters.id });
        return claimed.length > 0;
      }),

    page: (after, limit) =>
      handle.read(async (db) => {
        // Compared and ordered by byte ("C"), the same order the memory store's code units give for the ids the server makes.
        const rows = await db
          .select(characterColumns)
          .from(characters)
          .where(after === null ? undefined : sql`${characters.id} collate "C" > ${after}`)
          .orderBy(asc(sql`${characters.id} collate "C"`))
          .limit(Math.max(0, limit));
        return rows;
      }),
  };

  const pair: PairStore = {
    get: (key) =>
      handle.read(async (db) => {
        const [row] = await db.select().from(pairs).where(eq(pairs.key, key));
        return row === undefined ? null : toPair(row);
      }),
  };

  return { player, pair };
}
