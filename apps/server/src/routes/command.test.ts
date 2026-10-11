// The command route never takes an outcome from the client (server.md R-SERVER-001; the maintainer's audit of 11 Oct
// 2026 asked it be shown). The route reads two fields of the body, `command` and `basedOn` (`readRequest`); a field
// the command's kind does not know is never read by the simulation. So a body that also carries a state, a wallet,
// a result or events is not refused: what it carries is ignored, and the stored state is the one the plain command
// makes.
import type { Command } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { call, held, newLife, restMonth, testServer } from "../authority/testing";
import type { ServerReply } from "../types";

function accepted(reply: ServerReply): Extract<ServerReply, { ok: true }> {
  if (!reply.ok) throw new Error(`Rejected with ${reply.code}: ${reply.detail}`);
  return reply;
}

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
  test("[R-SERVER-001] given a command carrying a state, a wallet, a result and events inside it and beside it, when it is sent, then those fields are ignored and the stored state is exactly the plain command's", async () => {
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
});
