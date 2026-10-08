import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import { config, MIX } from "./load.config";
import { accountAt, chooseCommand, classify, commandBody, kindAt, roll, staleAt, STREAM } from "./pick.js";
import type { LooseCommand } from "./pick.js";

const SEED = config.load.seed;
const RUNS = 100_000;

const month: LooseCommand = { type: "turn/end", slots: [] };
const offer: LooseCommand = { type: "offer/choose", offer: "offer.a", choice: "take" };
const answer: LooseCommand = { type: "setpiece/answer", question: "setpiece.q", answer: "yes" };
const convert: LooseCommand = { type: "wallet/convert", from: "NGN", to: "GBP", amount: 1000000, via: "bank" };

describe("the load test's picks", () => {
  test("[R-LOAD-006] given the same seed, when the picks are made twice, then the accounts, kinds, stale picks and choices are the same in the same order; another seed differs", () => {
    const picks = (seed: number) =>
      Array.from({ length: 500 }, (_, index) => [accountAt(seed, index, 10_000), kindAt(seed, index, MIX), staleAt(seed, index, 100), roll(seed, index, STREAM.choice, 1 << 30)]);
    expect(picks(SEED)).toEqual(picks(SEED));
    expect(picks(SEED + 1)).not.toEqual(picks(SEED));
  });

  test.prop([fc.integer({ min: 0, max: 0xffffffff }), fc.integer({ min: 1, max: 2000 }), fc.integer({ min: 0, max: 1_000_000 })], { numRuns: 40 })(
    "[R-LOAD-003] given any seed and number of accounts, when that many iterations pick in a row, then each account is picked exactly once, so no two commands in flight share one",
    (seed, count, from) => {
      const seen = new Set<number>();
      for (let index = from; index < from + count; index += 1) seen.add(accountAt(seed, index, count));
      expect(seen.size).toBe(count);
      expect([...seen].every((at) => at >= 0 && at < count)).toBe(true);
    },
  );

  test("[R-LOAD-003] given 100,000 iterations, when each asks for a kind, then every kind's share is within half a point of the mix", () => {
    const counts = new Map<string, number>();
    for (let index = 0; index < RUNS; index += 1) {
      const kind = kindAt(SEED, index, MIX);
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    for (const entry of MIX) {
      const share = (counts.get(entry.kind) ?? 0) * 10000;
      expect(Math.abs(share - entry.bp * RUNS)).toBeLessThanOrEqual(50 * RUNS);
    }
  });

  test("[R-LOAD-004] given a stale share of 1%, when 100,000 iterations pick, then within a tenth of a point of 1% are sent stale; at 0 none and at 10000 all", () => {
    let stale = 0;
    for (let index = 0; index < RUNS; index += 1) if (staleAt(SEED, index, config.load.staleShareBp)) stale += 1;
    expect(Math.abs(stale * 10000 - config.load.staleShareBp * RUNS)).toBeLessThanOrEqual(10 * RUNS);
    expect(Array.from({ length: 1000 }, (_, index) => staleAt(SEED, index, 0)).some(Boolean)).toBe(false);
    expect(Array.from({ length: 1000 }, (_, index) => staleAt(SEED, index, 10000)).every(Boolean)).toBe(true);
  });

  test("[R-LOAD-004] given a command and the stored version, when the body is built stale, then it is based on the version before; otherwise on the stored one", () => {
    expect(commandBody(month, 12, false)).toEqual({ command: { ...month, basedOn: 12 }, basedOn: 12 });
    expect(commandBody(month, 12, true)).toEqual({ command: { ...month, basedOn: 11 }, basedOn: 11 });
  });

  test("[R-LOAD-003] given a view offering the kind asked for, when a command is chosen, then it is of that kind and no fallback", () => {
    expect(chooseCommand([month, offer, convert], "offer/choose", 7)).toEqual({ command: offer, wanted: "offer/choose", fallback: false });
    expect(chooseCommand([month, convert], "wallet/convert", 0)?.command).toEqual(convert);
    expect(chooseCommand([{ type: "pair/say" }, month], "pair", 0)?.command.type).toBe("pair/say");
  });

  test("[R-LOAD-003] given a view without the kind asked for, when a command is chosen, then a month comes first, then an answer the turn waits on, then any legal command, and nothing for an ended life", () => {
    expect(chooseCommand([offer, month], "obligation/pay", 0)).toEqual({ command: month, wanted: "obligation/pay", fallback: true });
    expect(chooseCommand([offer, answer], "pair", 0)?.command).toEqual(answer);
    expect(chooseCommand([convert], "setpiece/answer", 3)).toEqual({ command: convert, wanted: "setpiece/answer", fallback: true });
    expect(chooseCommand([], "turn/end", 0)).toBeNull();
  });

  test("[R-LOAD-008] [R-LOAD-009] given each kind of reply, when it is counted, then a failed connection is the machine's, 5xx the server's, and only a stale answer to a stale command is expected", () => {
    expect(classify(0, null, false)).toBe("connection-error");
    expect(classify(0, null, true)).toBe("connection-error");
    expect(classify(500, null, false)).toBe("server-error");
    expect(classify(503, { ok: false }, true)).toBe("server-error");
    expect(classify(200, { ok: true }, false)).toBe("accepted");
    expect(classify(200, { ok: false, code: "stale" }, true)).toBe("stale-expected");
    expect(classify(200, { ok: false, code: "stale" }, false)).toBe("unexpected");
    expect(classify(200, { ok: false, code: "cannot-afford" }, true)).toBe("unexpected");
    expect(classify(429, { ok: false, code: "rate-limited" }, false)).toBe("rate-limited");
    expect(classify(404, { ok: false, code: "no-character" }, false)).toBe("unexpected");
    expect(classify(499, null, false)).toBe("unexpected");
  });
});
