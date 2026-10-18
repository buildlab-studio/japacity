import { DRAW_ODDS, logRow, must, newCharacter, suiteForPlayerStore } from "@japacity/store/contract";
import { describe, expect, test } from "vitest";

import { freshHandle } from "../pglite.testing";
import { pgAuditStore } from "./audit";
import { pgPlayerStores } from "./player";
import { pgWorldStore } from "./world";

const fresh = freshHandle();

suiteForPlayerStore(async () => {
  const handle = await fresh();
  return pgPlayerStores(handle).player;
});

describe("the Postgres transaction's own stores", () => {
  test("[server:one-command-one-transaction] [server:rejections-write-nothing] given work that buys tickets and writes an audit entry through its stores, when its character write is refused, then the tickets and the entry roll back with it", async () => {
    const handle = await fresh();
    const { player } = pgPlayerStores(handle);
    const world = pgWorldStore(handle);
    const audit = pgAuditStore(handle);
    must(await player.create(newCharacter("char-a")));
    const draw = { draw: 2, secret: "11".repeat(32), fingerprint: "22".repeat(32), beaconRound: 900, odds: DRAW_ODDS, jackpot: 20_000_000 };
    must(await world.putDraw(draw));

    const refused = await player.transact(["char-a"], async (_rows, stores) => {
      must(await stores.world.addTickets(draw.draw, "char-a", 3));
      await stores.audit.retire({ character: "char-a", why: "rollback", at: 5, note: "inside", segments: [], log: [], snapshots: [] });
      return { writes: { characters: [{ id: "char-a", append: [logRow("char-a", 2)] }] }, result: null };
    });

    expect(refused).toMatchObject({ ok: false, code: "bad-write" });
    expect(await world.tickets(draw.draw)).toEqual([]);
    expect(await audit.list("char-a")).toEqual([]);
    expect((await player.load("char-a"))?.character.v).toBe(0);
    must(await player.transact(["char-a"], () => ({ writes: { characters: [{ id: "char-a", append: [logRow("char-a", 1)] }] }, result: null })));
    expect((await player.load("char-a"))?.character.v).toBe(1);
  });
});
