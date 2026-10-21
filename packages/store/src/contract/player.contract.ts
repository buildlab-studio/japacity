import { describe, expect, test } from "vitest";

import type { CharacterWrite, Held, KeptPerson, PlayerStore, StoreResult, Writes } from "../types";
import { DRAW_ODDS, logRow, logRows, must, newCharacter, snapshot, stateAt, world } from "./contract.testing";

/** `server.snapshotEvery` in server.md's Numbers. The store keeps what it is given; the server decides when. */
const SNAPSHOT_EVERY = 20;

async function write(store: PlayerStore, ids: readonly string[], writes: Writes): Promise<StoreResult<null>> {
  return store.transact(ids, () => ({ writes, result: null }));
}

async function appendTo(store: PlayerStore, id: string, from: number, to: number, extra: Partial<CharacterWrite> = {}) {
  must(await write(store, [id], { characters: [{ id, append: logRows(id, from, to), ...extra }] }));
}

/** Plays a character up to version `to`, writing a snapshot at each multiple of SNAPSHOT_EVERY as server:snapshots-bound-replay asks of the server. */
async function playTo(store: PlayerStore, id: string, to: number) {
  for (let v = 1; v <= to; v++) {
    const snapshots = v % SNAPSHOT_EVERY === 0 ? [snapshot(id, v)] : [];
    must(await write(store, [id], { characters: [{ id, append: [logRow(id, v)], snapshots }] }));
  }
}

/** Lets other promises run for a while, so a second transaction is waiting while the first holds its lock. */
async function yieldTurns(turns: number): Promise<void> {
  for (let i = 0; i < turns; i++) await Promise.resolve();
}

/** The contract every PlayerStore keeps. `make` returns an empty store each time it is called. */
export function suiteForPlayerStore(make: () => Promise<PlayerStore>): void {
  describe("PlayerStore contract", () => {
    test("[server:snapshots-bound-replay] given a new character, when it is created and loaded, then it is at version 0 in segment 0 with its snapshot at 0 and no tail", async () => {
      const store = await make();
      const made = must(await store.create(newCharacter("char-a")));
      const loaded = await store.load("char-a");

      expect(loaded).toEqual(made);
      expect(loaded?.character).toEqual({ id: "char-a", account: "account-of-char-a", v: 0, refilledAt: 1_000, segment: 0, fullAt: null, fullNotifiedAt: null });
      expect(loaded?.segments).toEqual([
        {
          character: "char-a",
          segment: 0,
          fromV: 0,
          content: "content-1",
          start: { scenario: "scenario.graduate", seed: "seed-char-a", worldSeed: "world-seed" },
        },
      ]);
      expect(loaded?.snapshot).toEqual({ character: "char-a", v: 0, segment: 0, content: "content-1", state: stateAt("char-a", 0) });
      expect(loaded?.tail).toEqual([]);
      expect(await store.load("char-unknown")).toBeNull();
    });

    test("[server:snapshots-bound-replay] given a character made under an overlay, when it is loaded, then its segment and snapshot name the overlay", async () => {
      const store = await make();
      must(await store.create({ ...newCharacter("char-a"), overlay: "overlay-3" }));
      const loaded = await store.load("char-a");

      expect(loaded?.segments[0]?.overlay).toBe("overlay-3");
      expect(loaded?.snapshot.overlay).toBe("overlay-3");
    });

    test("[server:one-command-one-transaction] given a stored id, when it is created again, then it is refused with exists and the first is kept", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));
      await appendTo(store, "char-a", 1, 2);

      const again = await store.create(newCharacter("char-a", "someone-else"));

      expect(again).toMatchObject({ ok: false, code: "exists" });
      const loaded = await store.load("char-a");
      expect(loaded?.character.account).toBe("account-of-char-a");
      expect(loaded?.character.v).toBe(2);
    });

    test("[server:one-command-one-transaction] given a character at version 3, when a transaction appends version 4, then the version rises by one and the row reads back exactly", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));
      await appendTo(store, "char-a", 1, 3);

      await appendTo(store, "char-a", 4, 4);

      const loaded = await store.load("char-a");
      expect(loaded?.character.v).toBe(4);
      expect(loaded?.tail).toEqual(logRows("char-a", 1, 4));
      expect(loaded?.tail.at(-1)).toEqual({
        character: "char-a",
        v: 4,
        tick: 14,
        sender: "authority",
        command: { basedOn: 3, type: "turns/grant", count: 1 },
        hash: "hash-char-a-4",
        at: 5_004,
      });
    });

    test("[server:one-command-one-transaction] given a character at version 3, when a transaction appends at version 3, then it is refused as stale and nothing is written", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));
      await appendTo(store, "char-a", 1, 3);
      const before = await store.load("char-a");

      const stale = await write(store, ["char-a"], {
        characters: [{ id: "char-a", append: [{ ...logRow("char-a", 3), hash: "other" }, logRow("char-a", 4)], refilledAt: 9_999 }],
      });

      expect(stale).toMatchObject({ ok: false, code: "stale" });
      expect(await store.load("char-a")).toEqual(before);
    });

    test("[server:one-command-one-transaction] given two characters in one transaction, when one write is stale, then neither character is written", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));
      must(await store.create(newCharacter("char-b")));
      await appendTo(store, "char-b", 1, 2);
      const beforeA = await store.load("char-a");
      const beforeB = await store.load("char-b");

      const result = await write(store, ["char-a", "char-b"], {
        characters: [
          { id: "char-a", append: [logRow("char-a", 1)] },
          { id: "char-b", append: [logRow("char-b", 2)] },
        ],
      });

      expect(result).toMatchObject({ ok: false, code: "stale" });
      expect(await store.load("char-a")).toEqual(beforeA);
      expect(await store.load("char-b")).toEqual(beforeB);
    });

    test("[server:one-command-one-transaction] given a character at version 1, when a write skips to version 3, then it is refused and nothing is written", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));
      await appendTo(store, "char-a", 1, 1);

      const gap = await write(store, ["char-a"], { characters: [{ id: "char-a", append: [logRow("char-a", 3)] }] });
      const wrongName = await write(store, ["char-a"], { characters: [{ id: "char-a", append: [logRow("char-b", 2)] }] });

      expect(gap).toMatchObject({ ok: false, code: "bad-write" });
      expect(wrongName).toMatchObject({ ok: false, code: "bad-write" });
      expect((await store.load("char-a"))?.character.v).toBe(1);
    });

    test("[server:log-rows-hash-state] given logged rows, when more are appended and an old version is offered again, then the earlier rows are never rewritten", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));
      await appendTo(store, "char-a", 1, 3);

      const rewrite = await write(store, ["char-a"], {
        characters: [{ id: "char-a", append: [{ ...logRow("char-a", 2), hash: "rewritten" }] }],
      });
      await appendTo(store, "char-a", 4, 5);

      expect(rewrite).toMatchObject({ ok: false, code: "stale" });
      expect(await store.log("char-a", 0)).toEqual(logRows("char-a", 1, 5));
      expect(await store.log("char-a", 3)).toEqual(logRows("char-a", 4, 5));
      expect(await store.log("char-a", 5)).toEqual([]);
      expect(await store.log("char-unknown", 0)).toEqual([]);
    });

    test("[server:snapshots-bound-replay] given a snapshot at each multiple of 20, when the character is loaded at every version up to 45, then the tail is the rows after the latest snapshot and never 20 long", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));

      for (let v = 1; v <= 45; v++) {
        const snapshots = v % SNAPSHOT_EVERY === 0 ? [snapshot("char-a", v)] : [];
        must(await write(store, ["char-a"], { characters: [{ id: "char-a", append: [logRow("char-a", v)], snapshots }] }));

        const loaded = await store.load("char-a");
        const base = v - (v % SNAPSHOT_EVERY);
        expect(loaded?.snapshot.v).toBe(base);
        expect(loaded?.tail.map((row) => row.v)).toEqual(logRows("char-a", base + 1, v).map((row) => row.v));
        expect(loaded?.tail.length).toBeLessThan(SNAPSHOT_EVERY);
      }

      const loaded = await store.load("char-a");
      expect(loaded?.snapshot).toEqual(snapshot("char-a", 40));
      expect(loaded?.tail).toEqual(logRows("char-a", 41, 45));
    });

    test("[server:snapshots-bound-replay] given a snapshot at a version already stored, when it is written again, then it is refused and the first is kept", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));
      await playTo(store, "char-a", 20);

      const again = await write(store, ["char-a"], {
        characters: [{ id: "char-a", snapshots: [{ ...snapshot("char-a", 20), state: stateAt("char-a", 20, "other") }] }],
      });
      const ahead = await write(store, ["char-a"], { characters: [{ id: "char-a", snapshots: [snapshot("char-a", 21)] }] });

      expect(again).toMatchObject({ ok: false, code: "bad-write" });
      expect(ahead).toMatchObject({ ok: false, code: "bad-write" });
      expect((await store.load("char-a"))?.snapshot).toEqual(snapshot("char-a", 20));
    });

    test("[server:paired-rows-locked-in-order] given two characters, when one transaction asks for them in either order, then the work sees them in ascending id order and the result is the same", async () => {
      const results: (Held | null)[][] = [];
      for (const ids of [["char-a", "char-b"], ["char-b", "char-a"]]) {
        const store = await make();
        must(await store.create(newCharacter("char-a")));
        must(await store.create(newCharacter("char-b")));
        await appendTo(store, "char-b", 1, 2);

        let runs = 0;
        const seen = must(
          await store.transact(ids, (rows) => {
            runs++;
            return {
              writes: {
                characters: rows.characters.map((held) => ({
                  id: held.character.id,
                  append: [logRow(held.character.id, held.character.v + 1)],
                })),
              },
              result: rows.characters.map((held) => held.character.id),
            };
          }),
        );

        expect(runs).toBe(1);
        expect(seen).toEqual(["char-a", "char-b"]);
        results.push([await store.load("char-a"), await store.load("char-b")]);
      }
      expect(results[0]).toEqual(results[1]);
      expect(results[0]?.map((held) => held?.character.v)).toEqual([1, 3]);
    });

    test("[server:paired-rows-locked-in-order] given ids that differ in case, when they are locked, then ascending order is by code unit and not by a locale's collation", async () => {
      const store = await make();
      for (const id of ["char-a", "char-Z", "char-10", "char-9"]) must(await store.create(newCharacter(id)));

      const seen = must(
        await store.transact(["char-a", "char-9", "char-Z", "char-10", "char-a"], (rows) => ({
          writes: {},
          result: rows.characters.map((held) => held.character.id),
        })),
      );

      expect(seen).toEqual(["char-10", "char-9", "char-Z", "char-a"]);
    });

    test("[server:paired-rows-locked-in-order] given two transactions on one character at once, when both append at the version they read, then they run one after the other and both are kept", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));

      const appendAfter = (wait: number) =>
        store.transact(["char-a"], async (rows) => {
          const v = rows.characters[0]?.character.v ?? -1;
          await yieldTurns(wait);
          return { writes: { characters: [{ id: "char-a", append: [logRow("char-a", v + 1)] }] }, result: v };
        });
      const results = await Promise.all([appendAfter(20), appendAfter(0)]);

      expect(results.map(must).sort()).toEqual([0, 1]);
      const loaded = await store.load("char-a");
      expect(loaded?.character.v).toBe(2);
      expect(loaded?.tail).toEqual(logRows("char-a", 1, 2));
    });

    test("[server:paired-rows-locked-in-order] given an id that is not stored, when a transaction names it, then it is refused with missing and the work never runs", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));

      let runs = 0;
      const result = await store.transact(["char-a", "char-unknown"], () => {
        runs++;
        return { writes: {}, result: null };
      });

      expect(result).toMatchObject({ ok: false, code: "missing" });
      expect(runs).toBe(0);
    });

    test("[server:paired-rows-locked-in-order] given a transaction holding one character, when it writes another, then it is refused with not-held and nothing is written", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));
      must(await store.create(newCharacter("char-b")));

      const result = await write(store, ["char-a"], {
        characters: [
          { id: "char-a", append: [logRow("char-a", 1)] },
          { id: "char-b", append: [logRow("char-b", 1)] },
        ],
      });

      expect(result).toMatchObject({ ok: false, code: "not-held" });
      expect((await store.load("char-a"))?.character.v).toBe(0);
      expect((await store.load("char-b"))?.character.v).toBe(0);
    });

    test("[server:one-command-one-transaction] given work that throws, when the transaction runs, then the error reaches the caller, nothing is written and the next transaction still runs", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));

      await expect(
        store.transact(["char-a"], () => {
          throw new Error("work failed");
        }),
      ).rejects.toThrow("work failed");
      await appendTo(store, "char-a", 1, 1);

      expect((await store.load("char-a"))?.character.v).toBe(1);
    });

    test("[server:one-command-one-transaction] given a character with a logged command, when the work reads and writes through the stores it is given, then every call settles inside the transaction and the work's own write is kept", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));
      await appendTo(store, "char-a", 1, 1);
      const tick = { tick: 3, world: world(3), book: { era: "era.calm", passes: {}, mark: 0 }, content: "content-1", hash: "hash-3" };
      const draw = { draw: 2, secret: "11".repeat(32), fingerprint: "22".repeat(32), beaconRound: 900, odds: DRAW_ODDS, jackpot: 20_000_000 };

      const seen = must(
        await store.transact(["char-a"], async (rows, stores) => {
          const v = rows.characters[0]?.character.v ?? -1;
          await stores.world.insertTick(tick);
          must(await stores.world.putDraw(draw));
          const numbers = must(await stores.world.addTickets(draw.draw, "char-a", 2));
          const retired = await stores.audit.retire({ character: "char-a", why: "rollback", at: 5, note: "inside", segments: [], log: [], snapshots: [] });
          const read = { tick: await stores.world.tick(3), numbers, tickets: await stores.world.tickets(draw.draw), audit: (await stores.audit.list("char-a")).map((row) => row.n), n: retired.n };
          return { writes: { characters: [{ id: "char-a", append: [logRow("char-a", v + 1)] }] }, result: read };
        }),
      );

      expect(seen).toEqual({
        tick,
        numbers: [0, 1],
        tickets: [
          { draw: 2, n: 0, character: "char-a" },
          { draw: 2, n: 1, character: "char-a" },
        ],
        audit: [seen.n],
        n: seen.n,
      });
      expect((await store.load("char-a"))?.character.v).toBe(2);
    });

    test("[clock:turns-earned-from-refill-time] given a character, when a transaction moves refilledAt with no command, then it reads back and the version stays", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));

      must(await write(store, ["char-a"], { characters: [{ id: "char-a", refilledAt: 7_201_000 }] }));

      const loaded = await store.load("char-a");
      expect(loaded?.character.refilledAt).toBe(7_201_000);
      expect(loaded?.character.v).toBe(0);
    });

    test("[clock:full-bank-push-notification] given a character at version 2, when fullAt is set at version 2 and then at version 1, then the first is kept and the older one is refused", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));
      await appendTo(store, "char-a", 1, 2);

      expect(await store.setFullAt("char-a", 2, 50_000)).toBe(true);
      expect(await store.setFullAt("char-a", 1, 9_000)).toBe(false);
      expect(await store.setFullAt("char-unknown", 0, 9_000)).toBe(false);

      expect((await store.load("char-a"))?.character).toMatchObject({ v: 2, fullAt: 50_000, fullNotifiedAt: null });
    });

    test("[clock:full-bank-push-notification] given fills at 50000 and 60000, when filled is read at 49999, 50000 and 60000, then each row shows from its own fullAt, in id order", async () => {
      const store = await make();
      for (const id of ["char-b", "char-a", "char-c"]) must(await store.create(newCharacter(id)));
      await store.setFullAt("char-b", 0, 50_000);
      await store.setFullAt("char-a", 0, 60_000);
      await store.setFullAt("char-c", 0, null);

      expect(await store.filled(49_999)).toEqual([]);
      expect((await store.filled(50_000)).map((row) => row.id)).toEqual(["char-b"]);
      expect((await store.filled(60_000)).map((row) => row.id)).toEqual(["char-a", "char-b"]);
    });

    test("[clock:full-bank-push-notification] given a fill, when its notice is claimed twice, then only the first claim holds and the row leaves filled", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));
      await store.setFullAt("char-a", 0, 50_000);

      const claims = await Promise.all([store.claimFull("char-a", 50_000, 70_000), store.claimFull("char-a", 50_000, 70_001)]);

      expect(claims.filter(Boolean)).toHaveLength(1);
      expect((await store.load("char-a"))?.character).toMatchObject({ fullAt: 50_000, fullNotifiedAt: 70_000 });
      expect(await store.filled(80_000)).toEqual([]);
    });

    test("[clock:full-bank-push-notification] given a claimed fill, when fullAt moves and the bank fills again, then the claim is cleared and the new fill can be claimed once", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));
      await store.setFullAt("char-a", 0, 50_000);
      expect(await store.claimFull("char-a", 50_000, 70_000)).toBe(true);

      expect(await store.setFullAt("char-a", 0, 50_000)).toBe(true);
      expect((await store.load("char-a"))?.character.fullNotifiedAt).toBe(70_000);

      await appendTo(store, "char-a", 1, 1);
      expect(await store.setFullAt("char-a", 1, 90_000)).toBe(true);
      expect((await store.load("char-a"))?.character.fullNotifiedAt).toBeNull();
      expect(await store.claimFull("char-a", 50_000, 95_000)).toBe(false);
      expect(await store.claimFull("char-a", 90_000, 95_000)).toBe(true);
    });

    test("[account:two-lights-and-wink-lines] given five characters made out of order, when they are read a page of two at a time, then every row comes once, in ascending id order, and the page after the last is empty", async () => {
      const store = await make();
      for (const id of ["char-d", "char-b", "char-E", "char-a", "char-c"]) must(await store.create(newCharacter(id)));
      await appendTo(store, "char-b", 1, 2);

      const first = await store.page(null, 2);
      const second = await store.page(first.at(-1)?.id ?? null, 2);
      const third = await store.page(second.at(-1)?.id ?? null, 2);

      expect([first, second, third].map((rows) => rows.map((row) => row.id))).toEqual([["char-E", "char-a"], ["char-b", "char-c"], ["char-d"]]);
      expect(second[0]).toEqual({ id: "char-b", account: "account-of-char-b", v: 2, refilledAt: 1_000, segment: 0, fullAt: null, fullNotifiedAt: null });
      expect(await store.page("char-d", 2)).toEqual([]);
      expect(await store.page(null, 0)).toEqual([]);
    });

    test("[account:two-lights-and-wink-lines] given a removed character, when the characters are paged, then it is not among them", async () => {
      const store = await make();
      for (const id of ["char-a", "char-b"]) must(await store.create(newCharacter(id)));
      await store.remove("char-a");

      expect((await store.page(null, 10)).map((row) => row.id)).toEqual(["char-b"]);
    });

    test("[server:newer-content-upgrades-state] given a character at version 3, when a transaction opens segment 1 with its base snapshot and then appends, then the load starts from the new base", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));
      await appendTo(store, "char-a", 1, 3);
      const base = stateAt("char-a", 3, "upgraded");

      must(
        await write(store, ["char-a"], {
          characters: [
            {
              id: "char-a",
              segment: { character: "char-a", segment: 1, fromV: 3, content: "content-2", start: { base } },
              snapshots: [{ character: "char-a", v: 3, segment: 1, content: "content-2", state: base }],
              append: [logRow("char-a", 4)],
            },
          ],
        }),
      );

      const loaded = await store.load("char-a");
      expect(loaded?.character.segment).toBe(1);
      expect(loaded?.segments.map((row) => [row.segment, row.fromV, row.content])).toEqual([
        [0, 0, "content-1"],
        [1, 3, "content-2"],
      ]);
      expect(loaded?.snapshot).toEqual({ character: "char-a", v: 3, segment: 1, content: "content-2", state: base });
      expect(loaded?.tail).toEqual([logRow("char-a", 4)]);
    });

    test("[server:newer-content-upgrades-state] given a new segment, when it comes without its base snapshot or out of turn, then it is refused and nothing is written", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));
      await appendTo(store, "char-a", 1, 3);
      const before = await store.load("char-a");
      const base = stateAt("char-a", 3, "upgraded");
      const segment = { character: "char-a", segment: 1, fromV: 3, content: "content-2", start: { base } };
      const baseSnapshot = { character: "char-a", v: 3, segment: 1, content: "content-2", state: base };

      const noBase = await write(store, ["char-a"], { characters: [{ id: "char-a", segment }] });
      const skipped = await write(store, ["char-a"], {
        characters: [{ id: "char-a", segment: { ...segment, segment: 2 }, snapshots: [{ ...baseSnapshot, segment: 2 }] }],
      });
      const behind = await write(store, ["char-a"], {
        characters: [{ id: "char-a", segment: { ...segment, fromV: 2 }, snapshots: [{ ...baseSnapshot, v: 2 }] }],
      });

      for (const result of [noBase, skipped, behind]) expect(result).toMatchObject({ ok: false, code: "bad-write" });
      expect(await store.load("char-a")).toEqual(before);
    });

    test("[server:rollback-apply-one-account] given a segment corrected by the rollback tool, when it is retired as the next one opens, then its rows leave the store and the version moves on", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));
      await appendTo(store, "char-a", 1, 2);
      const upgraded = stateAt("char-a", 2, "upgraded");
      must(
        await write(store, ["char-a"], {
          characters: [
            {
              id: "char-a",
              segment: { character: "char-a", segment: 1, fromV: 2, content: "content-2", start: { base: upgraded } },
              snapshots: [{ character: "char-a", v: 2, segment: 1, content: "content-2", state: upgraded }],
              append: logRows("char-a", 3, 5),
            },
          ],
        }),
      );
      const corrected = stateAt("char-a", 6, "corrected");

      must(
        await write(store, ["char-a"], {
          characters: [
            {
              id: "char-a",
              segment: { character: "char-a", segment: 2, fromV: 6, content: "content-2", start: { base: corrected } },
              snapshots: [{ character: "char-a", v: 6, segment: 2, content: "content-2", state: corrected }],
              retire: [1],
            },
          ],
        }),
      );

      const loaded = await store.load("char-a");
      expect(loaded?.character).toMatchObject({ v: 6, segment: 2 });
      expect(loaded?.segments.map((row) => row.segment)).toEqual([0, 2]);
      expect(loaded?.snapshot.state).toEqual(corrected);
      expect(loaded?.tail).toEqual([]);
      expect(await store.log("char-a", 0)).toEqual(logRows("char-a", 1, 2));
      await appendTo(store, "char-a", 7, 7);
      expect(await store.log("char-a", 0)).toEqual([...logRows("char-a", 1, 2), logRow("char-a", 7)]);
    });

    test("[server:rollback-apply-one-account] given the segment in force, when a write tries to retire it, then it is refused and nothing is written", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));
      await appendTo(store, "char-a", 1, 2);
      const before = await store.load("char-a");

      const current = await write(store, ["char-a"], { characters: [{ id: "char-a", retire: [0] }] });
      const unknown = await write(store, ["char-a"], { characters: [{ id: "char-a", retire: [4] }] });

      expect(current).toMatchObject({ ok: false, code: "bad-write" });
      expect(unknown).toMatchObject({ ok: false, code: "bad-write" });
      expect(await store.load("char-a")).toEqual(before);
    });

    test("[account:deleted-data-removed-within-month] given two characters, when one is removed, then no row names it and the other is untouched", async () => {
      const store = await make();
      must(await store.create(newCharacter("char-a")));
      must(await store.create(newCharacter("char-b")));
      await playTo(store, "char-a", 21);
      await appendTo(store, "char-b", 1, 1);
      const other = await store.load("char-b");

      await store.remove("char-a");

      expect(await store.load("char-a")).toBeNull();
      expect(await store.log("char-a", 0)).toEqual([]);
      expect(await store.transact(["char-a"], () => ({ writes: {}, result: null }))).toMatchObject({ ok: false, code: "missing" });
      expect(await store.load("char-b")).toEqual(other);
      must(await store.create(newCharacter("char-a")));
      expect((await store.load("char-a"))?.character.v).toBe(0);
    });

    test("[server:one-command-one-transaction] given a loaded character, when the caller changes what it was given, then the stored rows do not change", async () => {
      const store = await make();
      const input = newCharacter("char-a");
      must(await store.create(input));
      const loaded = await store.load("char-a");
      if (loaded === null) throw new Error("The character was not stored.");

      loaded.character.v = 99;
      loaded.tail.push(logRow("char-a", 1));
      input.account = "changed";

      const again = await store.load("char-a");
      expect(again?.character).toMatchObject({ v: 0, account: "account-of-char-a" });
      expect(again?.tail).toEqual([]);
    });

    test("[account:person-kept-with-character] given a character made with the person built at the door, when the person is read, then it is the one kept, and a character made without one, or none at all, reads null", async () => {
      const store = await make();
      const person: KeptPerson = { name: "Adaeze", look: "person_ada", archetype: "developer", style: { skin: "skin3", fabric: "adire" } };
      must(await store.create({ ...newCharacter("char-a"), person }));
      must(await store.create(newCharacter("char-b")));

      expect(await store.person("char-a")).toEqual(person);
      expect(await store.person("char-b")).toBeNull();
      expect(await store.person("char-unknown")).toBeNull();
      // The person stands beside the rows a load reads, never inside them.
      expect((await store.load("char-a"))?.character).toEqual({ id: "char-a", account: "account-of-char-a", v: 0, refilledAt: 1_000, segment: 0, fullAt: null, fullNotifiedAt: null });
    });

    test("[account:person-kept-with-character] given a kept person, when it is replaced, a command is written and the caller changes what it was given, then the replacement stands alone, and an unknown character is refused", async () => {
      const store = await make();
      must(await store.create({ ...newCharacter("char-a"), person: { name: "Adaeze", look: "person_ada", archetype: null } }));
      const renamed: KeptPerson = { name: "Bola", look: "person_ada", archetype: null };

      expect(await store.setPerson("char-a", renamed)).toBe(true);
      await appendTo(store, "char-a", 1, 1);
      renamed.name = "changed";

      expect(await store.person("char-a")).toEqual({ name: "Bola", look: "person_ada", archetype: null });
      expect(await store.setPerson("char-unknown", renamed)).toBe(false);
      expect(await store.person("char-unknown")).toBeNull();
      await store.remove("char-a");
      expect(await store.person("char-a")).toBeNull();
    });
  });
}
