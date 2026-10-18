// The command transaction on Postgres (PGlite, the committed migrations): the
// stores behind one handle and its one-connection lock, as one request has
// them in production (decision 0006). The memory stores cannot show what
// these show: their world store takes no lock the player store holds.
import type { ServerReply } from "@japacity/api";
import { describe, expect, test } from "vitest";

import { productionConfig } from "../config";
import { drawJob } from "../scheduled/draw";
import { TICKS_CRON } from "../scheduled/ticks";
import { freshDatabases, postgresStores } from "../postgres.testing";
import type { TestServer } from "./authority.testing";
import { accepted, held, newLife, restMonth, send, testServer } from "./authority.testing";

const { epoch, worldTickMs } = productionConfig.clock;
/** Long enough for any command on PGlite, short of the test's own timeout, so a hang fails by name. */
const HANG_MS = 5000;

// One database for each test, so a test that hangs holds no lock another needs.
const database = freshDatabases();

async function onPostgres(): Promise<TestServer> {
  return testServer({ stores: postgresStores(await database()) });
}

/** `work`, or a failure that names it once `HANG_MS` has passed. */
function settles<T>(what: string, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const hung = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not settle in ${String(HANG_MS)} ms`)), HANG_MS);
  });
  return Promise.race([work, hung]).finally(() => clearTimeout(timer));
}

describe("the command transaction on Postgres", () => {
  test(
    "[server:one-command-one-transaction] given a character on the Postgres stores, when its first, second and third commands are sent in three ticks, then each settles, and the log holds the three months at their ticks with the earned grants between",
    async () => {
      const server = await onPostgres();
      const character = await newLife(server, "acc-1");
      let v = 0;
      for (let month = 0; month < 3; month += 1) {
        server.setNow(epoch + month * worldTickMs + 1);
        const reply = await settles(`command ${String(month + 1)}`, send(server, "acc-1", restMonth({ v })));
        const after = accepted(reply.body).view.v;
        expect(after).toBeGreaterThan(v);
        v = after;
      }
      const stored = await held(server, character);
      expect(stored.character.v).toBe(v);
      const log = await server.deps.stores.player.log(character, 0);
      expect(log.filter((row) => row.sender === "player").map((row) => [row.command.type, row.tick])).toEqual([
        ["turn/end", 0],
        ["turn/end", 1],
        ["turn/end", 2],
      ]);
    },
    HANG_MS * 4,
  );

  test(
    "[server:one-command-one-transaction] [lottery:tickets-numbered-by-commit] given an open draw on the Postgres stores, when a character buys tickets twice, then both purchases settle, the tickets are numbered in commit order and the world rows read under the lock are the stored ones",
    async () => {
      const server = await onPostgres();
      await drawJob(server.deps, { beacon: { genesis: 0, period: 1, randomness: () => Promise.resolve(null) } }, TICKS_CRON);
      const character = await newLife(server, "acc-1");
      const other = await newLife(server, "acc-2");
      const buy = async (account: string, id: string, tickets: number) => {
        const { v } = (await held(server, id)).character;
        return settles(`a purchase by ${account}`, send(server, account, { type: "lottery/buy", tickets, basedOn: v }));
      };
      accepted((await buy("acc-1", character, 2)).body);
      accepted((await buy("acc-2", other, 1)).body);
      accepted((await buy("acc-1", character, 3)).body);
      const draw = (await server.deps.stores.world.latest())?.world.lottery?.draw;
      if (draw === undefined) throw new Error("No draw is open.");
      const tickets = await server.deps.stores.world.tickets(draw);
      expect(tickets.map((ticket) => [ticket.n, ticket.character])).toEqual([
        [0, character],
        [1, character],
        [2, other],
        [3, character],
        [4, character],
        [5, character],
      ]);
      expect((await server.deps.stores.player.log(character, 0)).filter((row) => row.command.type === "lottery/buy")).toHaveLength(2);
    },
    HANG_MS * 4,
  );

  test(
    "[server:one-command-one-transaction] [lottery:tickets-numbered-by-commit] [clock:command-uses-stamped-tick] given the same draw, lives and clock on the memory stores and on Postgres, when each life buys tickets and plays months across ticks, then every log row and every ticket is the same on both, and every reply but for the order of its routes",
    async () => {
      const play = async (server: TestServer) => {
        await drawJob(server.deps, { beacon: { genesis: 0, period: 1, randomness: () => Promise.resolve(null) } }, TICKS_CRON);
        const ids = [await newLife(server, "acc-1"), await newLife(server, "acc-2")];
        const replies: ServerReply[] = [];
        for (let month = 0; month < 3; month += 1) {
          server.setNow(epoch + month * worldTickMs + 1);
          for (const [index, id] of ids.entries()) {
            const account = `acc-${String(index + 1)}`;
            const bought = await settles(`a purchase by ${account}`, send(server, account, { type: "lottery/buy", tickets: 1, basedOn: (await held(server, id)).character.v }));
            const rested = await settles(`a month for ${account}`, send(server, account, restMonth({ v: (await held(server, id)).character.v })));
            replies.push(bought.body, rested.body);
          }
        }
        const draw = (await server.deps.stores.world.tick(0))?.world.lottery?.draw ?? -1;
        return {
          replies,
          logs: await Promise.all(ids.map((id) => server.deps.stores.player.log(id, 0))),
          tickets: await server.deps.stores.world.tickets(draw),
        };
      };
      const onMemory = await play(testServer());
      const onPg = await play(await onPostgres());
      expect(onMemory.tickets.length).toBeGreaterThan(0);
      expect(onMemory.replies.flatMap((reply) => (reply.ok ? [] : [`${reply.code} ${reply.detail}`]))).toEqual([]);
      // The view lists routes in the key order of the stored state, which jsonb does not keep: compared by id here, and reported.
      const byRoute = (replies: ServerReply[]) =>
        replies.map((reply) => (reply.ok ? { ...reply, view: { ...reply.view, routes: [...reply.view.routes].sort((x, y) => x.id.localeCompare(y.id)) } } : reply));
      expect(onPg.logs).toEqual(onMemory.logs);
      expect(onPg.tickets).toEqual(onMemory.tickets);
      expect(byRoute(onPg.replies)).toEqual(byRoute(onMemory.replies));
    },
    HANG_MS * 8,
  );
});
