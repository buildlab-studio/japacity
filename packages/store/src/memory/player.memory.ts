import { compareIds, pairIds, pairKey } from "../keys";
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
} from "../types";
import { accept, copy, makeLock, refuse } from "./copy.memory";

/** Everything stored for one character. */
interface Stored {
  row: CharacterRow;
  segments: SegmentRow[];
  snapshots: SnapshotRow[];
  log: LogRow[];
}

const byV = (x: { v: number }, y: { v: number }) => x.v - y.v;

/** R-SERVER-004: the latest snapshot of the segment in force, and the rows after it. */
function held(stored: Stored): Held {
  const snapshot = stored.snapshots
    .filter((each) => each.segment === stored.row.segment)
    .reduce<SnapshotRow | undefined>((best, each) => (best === undefined || each.v > best.v ? each : best), undefined);
  if (snapshot === undefined) throw new Error(`Character ${stored.row.id} has no snapshot in segment ${String(stored.row.segment)}.`);
  return copy({
    character: stored.row,
    segments: [...stored.segments].sort((x, y) => x.segment - y.segment),
    snapshot,
    tail: stored.log.filter((row) => row.v > snapshot.v).sort(byV),
  });
}

/** The versions a segment's log rows fall in: after its `fromV`, up to the next segment's. */
function rangeOf(stored: Stored, segment: number): { after: number; upTo: number } | null {
  const ordered = [...stored.segments].sort((x, y) => x.segment - y.segment);
  const at = ordered.findIndex((each) => each.segment === segment);
  const own = ordered[at];
  if (own === undefined) return null;
  return { after: own.fromV, upTo: ordered[at + 1]?.fromV ?? stored.row.v };
}

/** Applies one character's writes to a copy, or says why they are refused. */
function applyCharacter(stored: Stored, write: CharacterWrite): Refusal | null {
  const id = stored.row.id;
  const bad = (detail: string) => refuse("bad-write", `${id}: ${detail}`);

  if (write.segment !== undefined) {
    const segment = write.segment;
    if (segment.character !== id) return bad(`a segment for ${segment.character}.`);
    if (segment.segment !== stored.row.segment + 1) return bad(`segment ${String(segment.segment)} does not follow ${String(stored.row.segment)}.`);
    if (segment.fromV < stored.row.v) return bad(`segment ${String(segment.segment)} starts at ${String(segment.fromV)}, under version ${String(stored.row.v)}.`);
    const base = write.snapshots?.some((each) => each.segment === segment.segment && each.v === segment.fromV) ?? false;
    if (!base) return bad(`segment ${String(segment.segment)} comes without its base snapshot.`);
    stored.segments.push(copy(segment));
    stored.row.segment = segment.segment;
    stored.row.v = segment.fromV;
  }

  for (const row of write.append ?? []) {
    if (row.character !== id) return bad(`a log row for ${row.character}.`);
    if (row.v <= stored.row.v) return refuse("stale", `${id}: version ${String(row.v)} is at or under the stored ${String(stored.row.v)}.`);
    if (row.v !== stored.row.v + 1) return bad(`version ${String(row.v)} skips from ${String(stored.row.v)}.`);
    stored.log.push(copy(row));
    stored.row.v = row.v;
  }

  const fromV = stored.segments.find((each) => each.segment === stored.row.segment)?.fromV ?? 0;
  for (const snapshot of write.snapshots ?? []) {
    if (snapshot.character !== id) return bad(`a snapshot for ${snapshot.character}.`);
    if (snapshot.segment !== stored.row.segment) return bad(`a snapshot for segment ${String(snapshot.segment)}, not the one in force.`);
    if (snapshot.v < fromV || snapshot.v > stored.row.v) return bad(`a snapshot at ${String(snapshot.v)}, outside ${String(fromV)} to ${String(stored.row.v)}.`);
    if (stored.snapshots.some((each) => each.segment === snapshot.segment && each.v === snapshot.v)) {
      return bad(`a snapshot at ${String(snapshot.v)} is already stored and is never rewritten.`);
    }
    stored.snapshots.push(copy(snapshot));
  }

  if (write.refilledAt !== undefined) stored.row.refilledAt = write.refilledAt;

  for (const segment of write.retire ?? []) {
    if (segment === stored.row.segment) return bad(`segment ${String(segment)} is in force and cannot be retired.`);
    const range = rangeOf(stored, segment);
    if (range === null) return bad(`no segment ${String(segment)} to retire.`);
    stored.log = stored.log.filter((row) => row.v <= range.after || row.v > range.upTo);
    stored.snapshots = stored.snapshots.filter((each) => each.segment !== segment);
    stored.segments = stored.segments.filter((each) => each.segment !== segment);
  }
  return null;
}

/** Applies one pair write to the staged pairs, or says why it is refused. */
function applyPair(pairs: Map<string, PairRow>, heldIds: ReadonlySet<string>, write: PairWrite, seen: Set<string>): Refusal | null {
  const ids = pairIds(write.key);
  if (ids === null) return refuse("bad-write", `${write.key} is not two sorted ids joined by a tilde.`);
  if (seen.has(write.key)) return refuse("bad-write", `${write.key} is written twice in one transaction.`);
  seen.add(write.key);
  if (!heldIds.has(ids.a) || !heldIds.has(ids.b)) return refuse("not-held", `${write.key} is written without holding both characters.`);
  const storedV = pairs.get(write.key)?.v ?? 0;
  if (write.expectedV !== storedV) {
    return refuse("stale", `${write.key} is at version ${String(storedV)}, and the write expected ${String(write.expectedV)}.`);
  }
  pairs.set(write.key, { key: write.key, a: ids.a, b: ids.b, v: storedV + 1, record: copy(write.record) });
  return null;
}

/**
 * R-SERVER-002, R-SERVER-007, R-PAIR-004: characters and pair records in maps
 * behind one async lock. A transaction stages its writes on copies and swaps
 * them in only when every write is accepted. `stores` are the ones the work is
 * given (R-SERVER-002): the memory stores beside this one, which
 * take no lock this store holds and roll nothing back, unlike Postgres.
 */
export function memoryPlayerStores(stores: TxStores): { player: PlayerStore; pair: PairStore } {
  let characters = new Map<string, Stored>();
  let pairs = new Map<string, PairRow>();
  const locked = makeLock();

  function stored(id: string): Stored {
    const found = characters.get(id);
    if (found === undefined) throw new Error(`Character ${id} vanished under its lock.`);
    return found;
  }

  async function transact<T>(ids: readonly string[], work: Work<T>): Promise<StoreResult<T>> {
    const order = [...new Set(ids)].sort(compareIds);
    const missing = order.filter((id) => !characters.has(id));
    if (missing.length > 0) return refuse("missing", `No character ${missing.join(", ")}.`);

    const between: PairRow[] = [];
    for (const [i, x] of order.entries()) {
      for (const y of order.slice(i + 1)) {
        const row = pairs.get(pairKey(x, y));
        if (row !== undefined) between.push(copy(row));
      }
    }
    between.sort((p, q) => compareIds(p.key, q.key));
    const { writes, result } = await work({ characters: order.map((id) => held(stored(id))), pairs: between }, stores);

    const heldIds = new Set(order);
    const staged = new Map(characters);
    for (const write of writes.characters ?? []) {
      if (!heldIds.has(write.id)) return refuse("not-held", `${write.id} is written without being held.`);
      if (staged.get(write.id) !== characters.get(write.id)) return refuse("bad-write", `${write.id} is written twice in one transaction.`);
      const next = copy(stored(write.id));
      const refused = applyCharacter(next, write);
      if (refused !== null) return refused;
      staged.set(write.id, next);
    }
    const stagedPairs = new Map(pairs);
    const seen = new Set<string>();
    for (const write of writes.pairs ?? []) {
      const refused = applyPair(stagedPairs, heldIds, write, seen);
      if (refused !== null) return refused;
    }

    characters = staged;
    pairs = stagedPairs;
    // The result is the caller's own value, handed back as it is.
    return { ok: true, value: result };
  }

  const player: PlayerStore = {
    create: (input) =>
      locked((): Promise<StoreResult<Held>> => {
        if (characters.has(input.id)) return Promise.resolve(refuse("exists", `Character ${input.id} already exists.`));
        const overlay = input.overlay === undefined ? {} : { overlay: input.overlay };
        const stored: Stored = copy({
          row: { id: input.id, account: input.account, v: 0, refilledAt: input.refilledAt, segment: 0, fullAt: null, fullNotifiedAt: null },
          segments: [{ character: input.id, segment: 0, fromV: 0, content: input.content, ...overlay, start: input.start }],
          snapshots: [{ character: input.id, v: 0, segment: 0, content: input.content, ...overlay, state: input.state }],
          log: [],
        });
        characters = new Map(characters).set(input.id, stored);
        return Promise.resolve(accept(held(stored)));
      }),

    load: (id) => {
      const stored = characters.get(id);
      return Promise.resolve(stored === undefined ? null : held(stored));
    },

    log: (id, after) => Promise.resolve(copy((characters.get(id)?.log ?? []).filter((row) => row.v > after).sort(byV))),

    transact: (ids, work) => locked(() => transact(ids, work)),

    remove: (id) =>
      locked(() => {
        const left = new Map(characters);
        left.delete(id);
        characters = left;
        pairs = new Map([...pairs].filter(([, row]) => (row.a !== id && row.b !== id) || (row.record as { held?: unknown }).held === true));
        return Promise.resolve();
      }),

    setFullAt: (id, v, fullAt) =>
      locked(() => {
        const found = characters.get(id);
        if (found === undefined || found.row.v !== v) return Promise.resolve(false);
        if (found.row.fullAt !== fullAt) characters = new Map(characters).set(id, { ...found, row: { ...found.row, fullAt, fullNotifiedAt: null } });
        return Promise.resolve(true);
      }),

    filled: (now) =>
      Promise.resolve(
        copy(
          [...characters.values()]
            .map((each) => each.row)
            .filter((row) => row.fullAt !== null && row.fullAt <= now && row.fullNotifiedAt === null)
            .sort((x, y) => compareIds(x.id, y.id)),
        ),
      ),

    claimFull: (id, fullAt, at) =>
      locked(() => {
        const found = characters.get(id);
        if (found === undefined || found.row.fullAt !== fullAt || found.row.fullNotifiedAt !== null) return Promise.resolve(false);
        characters = new Map(characters).set(id, { ...found, row: { ...found.row, fullNotifiedAt: at } });
        return Promise.resolve(true);
      }),

    page: (after, limit) =>
      Promise.resolve(
        copy(
          [...characters.values()]
            .map((each) => each.row)
            .filter((row) => after === null || compareIds(row.id, after) > 0)
            .sort((x, y) => compareIds(x.id, y.id))
            .slice(0, Math.max(0, limit)),
        ),
      ),
  };

  const pair: PairStore = {
    get: (key) => Promise.resolve(copy(pairs.get(key) ?? null)),
  };

  return { player, pair };
}
