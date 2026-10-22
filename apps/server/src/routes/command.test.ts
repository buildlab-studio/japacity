// The command route never takes an outcome from the client (server:commands-only-through-route). The route reads two fields of the body, `command` and `basedOn` (`readRequest`); a field
// the command's kind does not know is never read by the simulation. So a body that also carries a state, a wallet,
// a result or events is not refused: what it carries is ignored, and the stored state is the one the plain command
// makes.
import type { ServerRejection, ServerReply } from "@japacity/api";
import type { Command } from "@japacity/sim";
import { describe, expect, test, vi } from "vitest";

import { accepted, call, held, newLife, restMonth, testServer } from "../authority/authority.testing";
import { freshDatabases, postgresStores } from "../postgres.testing";

const open = freshDatabases();

/** What a forged client might add, inside the command and beside it. */
const FORGED = {
  state: { v: 40, wallet: { cash: { NGN: 10 ** 12 } } },
  wallet: { cash: { NGN: 10 ** 12 }, bank: { NGN: 10 ** 12 } },
  result: { ok: true, lines: [] },
  events: [{ type: "wallet/credited", currency: "NGN", amount: 10 ** 12, reason: "salary" }],
  seed: "planted",
  sender: "authority",
  tick: 99,
};

describe("the command route", () => {
  test("[server:commands-only-through-route] given a command carrying a state, a wallet, a result and events inside it and beside it, when it is sent, then those fields are ignored and the stored state is exactly the plain command's", async () => {
    const plain = testServer();
    const forged = testServer();
    const plainLife = await newLife(plain, "acc-1");
    const forgedLife = await newLife(forged, "acc-1");
    expect((await held(forged, forgedLife)).tail).toEqual((await held(plain, plainLife)).tail);

    const command: Command = restMonth({ v: 0 });
    const plainReply = accepted((await call<ServerReply>(plain, "POST", "/api/command", "acc-1", { command, basedOn: 0 })).body);
    const forgedReply = accepted((await call<ServerReply>(forged, "POST", "/api/command", "acc-1", { command: { ...command, ...FORGED }, basedOn: 0, ...FORGED })).body);

    // The same state after, by its hash in the log, and the same view: no forged figure reached either.
    const [plainRow] = (await held(plain, plainLife)).tail;
    const [forgedRow] = (await held(forged, forgedLife)).tail;
    expect(forgedRow?.hash).toBe(plainRow?.hash);
    expect(forgedRow).toMatchObject({ v: 1, sender: "player", tick: plainRow?.tick });
    expect(forgedReply.view).toEqual(plainReply.view);
    expect(forgedReply.view.v).toBe(1);
    expect(JSON.stringify(forgedReply.view)).not.toContain(String(10 ** 12));
  });

  test("[server:commands-only-through-route] [server:rejections-write-nothing] given commands whose own keys hold U+0000 or a lone surrogate, and one with such text only in keys it does not know, when each is sent to the database's stores, then the first are refused with 400 and write nothing, and the last is played with only its own keys logged; no failure line is written", async () => {
    const server = testServer({ stores: postgresStores(await open()) });
    const character = await newLife(server, "acc-1");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const before = await held(server, character);

    for (const bad of ["bad\u0000", "bad\ud800", "\udc00bad"]) {
      const sent = await call<ServerRejection>(server, "POST", "/api/command", "acc-1", { command: { type: "activity/now", activity: "activity.ask-around", param: bad, basedOn: 0 }, basedOn: 0 });
      expect({ status: sent.status, code: sent.body.code }).toEqual({ status: 400, code: "not-legal" });
    }
    expect(await held(server, character)).toEqual(before);

    const command = restMonth({ v: 0 });
    const played = await call<ServerReply>(server, "POST", "/api/command", "acc-1", { command: { ...command, note: "x\u0000", "key\ud800": 1 }, basedOn: 0 });
    expect(played.status).toBe(200);
    accepted(played.body);
    const [row] = (await held(server, character)).tail;
    expect(Object.keys(row?.command ?? {}).sort()).toEqual(Object.keys(command).sort());
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

