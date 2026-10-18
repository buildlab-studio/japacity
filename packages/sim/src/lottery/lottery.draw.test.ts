import { fc, test } from "@fast-check/vitest";
import { content } from "@japacity/content";
import { describe, expect } from "vitest";

import type { Content, LotteryOdds, LotteryResult } from "../engine/types";
import {
  checkLotteryContent,
  drawResults,
  drawSeed,
  expectedReturnPerMillion,
  forcedTicket,
  fromHex,
  jackpotHit,
  listHashOf,
  openingJackpot,
  PER_MILLION,
  prizesOwed,
  rollJackpot,
  sha256,
  ticketDraw,
  ticketResult,
  tierOfDraw,
  toHex,
} from "./lottery.draw";

const { ticket, odds } = content.tuning.lottery;

function withOdds(change: Partial<LotteryOdds>): Content {
  return { ...content, tuning: { ...content.tuning, lottery: { ...content.tuning.lottery, odds: { ...odds, ...change } } } };
}

/** The test messages are plain ASCII, one byte a character. */
function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

function hashOf(text: string): string {
  return toHex(sha256(ascii(text)));
}

describe("SHA-256", () => {
  test("[lottery:ticket-result-is-public-function] given the examples of FIPS 180-4, when they are hashed, then each digest is the published one", () => {
    expect(hashOf("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hashOf("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(hashOf("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
    expect(
      hashOf("abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu"),
    ).toBe("cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1");
    expect(hashOf("a".repeat(1000000))).toBe("cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0");
  });

  test("[lottery:ticket-result-is-public-function] given messages at the padding's edges, when they are hashed, then each matches a reference implementation", () => {
    // From `shasum -a 256`: 55 bytes fit one block with the length, 56 need two.
    expect(hashOf("a".repeat(55))).toBe("9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318");
    expect(hashOf("a".repeat(56))).toBe("b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a");
    expect(hashOf("a".repeat(63))).toBe("7d3e74a05d7db15bce4ad9ec0658ea98e3f06eeecf16b4c6fff2da457ddc2f34");
    expect(hashOf("a".repeat(64))).toBe("ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb");
    expect(hashOf("a".repeat(119))).toBe("31eba51c313a5c08226adf18d4a359cfdfd8d2e816b13f4af952f7ea6584dcfb");
  });

  test.prop([fc.uint8Array({ maxLength: 200 })])("[lottery:ticket-result-is-public-function] given any bytes, when they go to hex and back, then they are unchanged", (bytes) => {
    expect(fromHex(toHex(bytes))).toEqual(bytes);
  });
});

describe("the draw's seed and the ticket list", () => {
  test("[lottery:seed-from-secret-and-beacon] given the secret, the list's hash and the beacon's randomness, when the seed is made, then it is the SHA-256 of the three joined in that order", () => {
    const [secret, list, beacon] = ["00".repeat(32), "11".repeat(32), "22".repeat(32)];
    // Python: sha256(bytes.fromhex(secret + list + beacon)).
    expect(toHex(drawSeed(secret, list, beacon))).toBe("b647d2614ad2099840c899399acf3b264e8f40f9eb0d0f997c2e6e1c3ffc2da6");
    expect(toHex(drawSeed(list, secret, beacon))).not.toBe(toHex(drawSeed(secret, list, beacon)));
    expect(() => drawSeed("abc", list, beacon)).toThrow();
  });

  test("[lottery:ticket-list-frozen-anonymously] given tokens in ticket order, when the list's hash is made, then it is the SHA-256 of their bytes joined in that order", () => {
    const tokens = ["0011223344556677", "8899aabbccddeeff", "0011223344556677", "fedcba9876543210"];
    expect(listHashOf(tokens)).toBe(toHex(sha256(fromHex(tokens.join("")))));
    expect(listHashOf([...tokens].reverse())).not.toBe(listHashOf(tokens));
    expect(listHashOf([])).toBe(hashOf(""));
  });
});

describe("the draw at fixed odds", () => {
  const SEED = sha256(ascii("japacity"));

  test("[lottery:ticket-result-is-public-function] given a fixed seed, when tickets are drawn, then each ticket's draw and result match an independent implementation of the published method", () => {
    // Worked in Python's hashlib from the rule's words: int(sha256(seed + n.to_bytes(8, "big"))[:8]) % 1000000.
    expect(toHex(SEED)).toBe("22300a4d5b852620facc406ad57d5db67381b8c3022d32758fc4e71df46bae54");
    expect([0, 1, 2, 3, 4, 5].map((number) => ticketDraw(SEED, number))).toEqual([933434, 137934, 612183, 828970, 213120, 949240]);
    expect([ticketDraw(SEED, 479), ticketDraw(SEED, 3961), ticketDraw(SEED, 7)]).toEqual([83, 529, 12957]);
    expect([ticketResult(SEED, 479, odds), ticketResult(SEED, 3961, odds), ticketResult(SEED, 7, odds), ticketResult(SEED, 0, odds)]).toEqual(["jackpot", "mid", "small", null]);
    const winners = drawResults(SEED, 20000, odds, odds.jackpotStart);
    expect(winners[0]).toEqual({ tier: "jackpot", tickets: [479], amount: odds.jackpotStart });
    expect(winners[1]).toEqual({ tier: "mid", tickets: [3961, 3971, 9951, 12035, 14734, 18195, 19698], amount: odds.mid });
    expect(winners[2]?.tickets).toHaveLength(2001);
    expect(winners[2]?.tickets.slice(0, 10)).toEqual([7, 8, 27, 31, 36, 56, 57, 65, 69, 79]);
    expect(winners[2]?.amount).toBe(odds.small);
  });

  test("[lottery:ticket-result-is-public-function] given a draw at each edge of the odds, when it is read, then it falls in the jackpot, the mid prize, the small prize or nothing", () => {
    const jackpotEnd = odds.jackpotPerMillion;
    const midEnd = jackpotEnd + odds.midPerMillion;
    const smallEnd = midEnd + odds.smallPerMillion;
    expect([0, jackpotEnd - 1, jackpotEnd, midEnd - 1, midEnd, smallEnd - 1, smallEnd, PER_MILLION - 1].map((draw) => tierOfDraw(draw, odds))).toEqual([
      "jackpot",
      "jackpot",
      "mid",
      "mid",
      "small",
      "small",
      null,
      null,
    ]);
  });

  test.prop([fc.uint8Array({ minLength: 32, maxLength: 32 }), fc.integer({ min: 0, max: 300 }), fc.integer({ min: 0, max: 300 })])(
    "[lottery:ticket-result-is-public-function] given any seed and two counts sold, when the draw is made, then every ticket's result is the same whatever the count, and is its own ticketResult",
    (seed, few, many) => {
      const shared = Math.min(few, many);
      const cut = (winners: LotteryResult["winners"]) => winners.map((tier) => tier.tickets.filter((number) => number < shared));
      expect(cut(drawResults(seed, few, odds, odds.jackpotStart))).toEqual(cut(drawResults(seed, many, odds, odds.jackpotStart)));
      const winners = drawResults(seed, many, odds, odds.jackpotStart);
      for (let number = 0; number < many; number += 1) {
        const tier = ticketResult(seed, number, odds);
        expect(winners.filter((each) => each.tickets.includes(number)).map((each) => each.tier)).toEqual(tier === null ? [] : [tier]);
      }
    },
  );

  test("[lottery:fixed-prizes-shared-jackpot] given every ticket hitting a jackpot that does not divide, when the draw is made, then each hit is paid an equal share to the kobo and the kobo left over is destroyed", () => {
    const always: LotteryOdds = { ...odds, jackpotPerMillion: PER_MILLION, midPerMillion: 0, smallPerMillion: 0 };
    const winners = drawResults(SEED, 3, always, 1000);
    expect(winners[0]).toEqual({ tier: "jackpot", tickets: [0, 1, 2], amount: 333 });
    expect(prizesOwed(winners)).toBe(999);
    expect(drawResults(SEED, 1, always, 1000)[0]?.amount).toBe(1000);
    expect(drawResults(SEED, 0, always, 1000)).toEqual([
      { tier: "jackpot", tickets: [], amount: 1000 },
      { tier: "mid", tickets: [], amount: always.mid },
      { tier: "small", tickets: [], amount: always.small },
    ]);
  });

  test.prop([fc.uint8Array({ minLength: 32, maxLength: 32 }), fc.integer({ min: 0, max: 400 }), fc.integer({ min: 0, max: 100_000_000 })])(
    "[lottery:fixed-prizes-shared-jackpot] given any draw, when it is paid, then small and mid prizes are their fixed amounts, the jackpot's hits share no more than the jackpot, and every amount is whole",
    (seed, count, jackpot) => {
      const winners = drawResults(seed, count, odds, jackpot);
      const [hit, mid, small] = winners;
      expect(mid?.amount).toBe(odds.mid);
      expect(small?.amount).toBe(odds.small);
      expect((hit?.amount ?? 0) * (hit?.tickets.length ?? 0)).toBeLessThanOrEqual(jackpot);
      expect(winners.every((tier) => Number.isSafeInteger(tier.amount) && tier.amount >= 0)).toBe(true);
      expect(prizesOwed(winners)).toBe(winners.reduce((sum, tier) => sum + tier.tickets.length * tier.amount, 0));
    },
  );

  test("[lottery:jackpot-rolls-over] given a draw nobody hit, when the jackpot rolls, then it grows by the growth share of sales rounded down, up to the cap and never past it; after a hit it starts again", () => {
    const start = odds.jackpotStart;
    expect(rollJackpot(start, 25 * ticket, false, odds)).toBe(start + 50000);
    expect(rollJackpot(start, 9, false, odds)).toBe(start);
    expect(rollJackpot(start, 10, false, odds)).toBe(start + 1);
    expect(rollJackpot(odds.jackpotCap - 1, 10, false, odds)).toBe(odds.jackpotCap);
    expect(rollJackpot(odds.jackpotCap - 1, 20, false, odds)).toBe(odds.jackpotCap);
    expect(rollJackpot(odds.jackpotCap, 5000 * ticket, false, odds)).toBe(odds.jackpotCap);
    expect(rollJackpot(odds.jackpotCap, 5000 * ticket, true, odds)).toBe(start);
  });

  test("[lottery:jackpot-rolls-over] given the last result, when the next draw opens, then its jackpot is the start for the first draw or after a hit, the rolled-over amount after a miss, held under a lowered cap", () => {
    const miss: Pick<LotteryResult, "winners" | "nextJackpot"> = { winners: [{ tier: "jackpot", tickets: [], amount: 1 }], nextJackpot: 30_000_000 };
    const hit: Pick<LotteryResult, "winners" | "nextJackpot"> = { winners: [{ tier: "jackpot", tickets: [4], amount: 1 }], nextJackpot: odds.jackpotStart };
    expect(jackpotHit(miss.winners)).toBe(false);
    expect(jackpotHit(hit.winners)).toBe(true);
    expect(openingJackpot(null, odds)).toBe(odds.jackpotStart);
    expect(openingJackpot(hit, odds)).toBe(odds.jackpotStart);
    expect(openingJackpot(miss, odds)).toBe(30_000_000);
    expect(openingJackpot(miss, { ...odds, jackpotCap: 25_000_000 })).toBe(25_000_000);
    expect(openingJackpot(hit, { ...odds, jackpotStart: 10_000_000 })).toBe(10_000_000);
  });

  test("[lottery:jackpot-rolls-over] given a forced win with no hit, when the draw is made, then the ticket whose draw is highest takes the whole jackpot and nothing else; with a hit or no ticket, nothing is forced", () => {
    // Python: the highest of the first 100 draws of the seed is ticket 39's, 998188.
    expect(forcedTicket(SEED, 100)).toBe(39);
    expect(ticketDraw(SEED, 39)).toBe(998188);
    expect(forcedTicket(SEED, 0)).toBeNull();
    const natural = drawResults(SEED, 100, odds, odds.jackpotStart);
    expect(natural[0]?.tickets).toEqual([]);
    const forced = drawResults(SEED, 100, odds, odds.jackpotStart, true);
    expect(forced[0]).toEqual({ tier: "jackpot", tickets: [39], amount: odds.jackpotStart });
    expect(forced.slice(1).flatMap((tier) => tier.tickets)).not.toContain(39);
    expect(forced.slice(1).map((tier) => tier.tickets)).toEqual(natural.slice(1).map((tier) => tier.tickets.filter((number) => number !== 39)));
    expect(drawResults(SEED, 20000, odds, odds.jackpotStart, true)).toEqual(drawResults(SEED, 20000, odds, odds.jackpotStart));
    expect(drawResults(SEED, 0, odds, odds.jackpotStart, true)[0]?.tickets).toEqual([]);
  });
});

describe("the odds are settings", () => {
  test("[lottery:expected-return-below-price] given the shipped odds, when a ticket's expected return is worked out, then it is under the ticket's price at the starting jackpot and at the cap", () => {
    expect(odds.forcedWinWeeks).toBeNull();
    // About ₦115 at the start and ₦151 at the cap on a ₦200 ticket.
    expect(expectedReturnPerMillion(odds, odds.jackpotStart)).toBe(115 * 100 * PER_MILLION);
    expect(expectedReturnPerMillion(odds, odds.jackpotCap)).toBe(151 * 100 * PER_MILLION);
    expect(expectedReturnPerMillion(odds, odds.jackpotStart)).toBeLessThan(ticket * PER_MILLION);
    expect(expectedReturnPerMillion(odds, odds.jackpotCap)).toBeLessThan(ticket * PER_MILLION);
    expect(checkLotteryContent(content)).toEqual([]);
  });

  test("[lottery:expected-return-below-price] given a cap one kobo under and exactly at the return of the ticket's price, when content is checked, then the first passes and the second is refused", () => {
    // small × 100000 + mid × 500 is 7,500,000,000; the jackpot's 200 in a million leave 12,500,000,000, so ₦625,000 is the edge.
    const edge = 62_500_000;
    expect(expectedReturnPerMillion(odds, edge)).toBe(ticket * PER_MILLION);
    expect(checkLotteryContent(withOdds({ jackpotCap: edge - 1 }))).toEqual([]);
    expect(checkLotteryContent(withOdds({ jackpotCap: edge }))).toHaveLength(1);
    expect(checkLotteryContent(withOdds({ jackpotStart: edge, jackpotCap: edge }))).toHaveLength(2);
  });

  test("[lottery:odds-fixed-at-draw-open] given odds whose chances pass a million, or a jackpot that starts over its cap, when content is checked, then each is refused", () => {
    expect(checkLotteryContent(withOdds({ smallPerMillion: PER_MILLION - odds.jackpotPerMillion - odds.midPerMillion, small: 0 }))).toEqual([]);
    expect(checkLotteryContent(withOdds({ smallPerMillion: PER_MILLION - odds.jackpotPerMillion - odds.midPerMillion + 1, small: 0 }))).toHaveLength(1);
    expect(checkLotteryContent(withOdds({ jackpotStart: odds.jackpotCap }))).toEqual([]);
    expect(checkLotteryContent(withOdds({ jackpotStart: odds.jackpotCap + 1 }))).toHaveLength(1);
  });

  test("[lottery:expected-return-below-price] given 25 tickets sold, and given 5,000, when the draw is made over many seeds at the starting jackpot and at the cap, then a ticket is paid on average under its price", () => {
    for (const [count, seeds] of [
      [25, 4000],
      [5000, 40],
    ] as const) {
      for (const jackpot of [odds.jackpotStart, odds.jackpotCap]) {
        let paid = 0;
        for (let index = 0; index < seeds; index += 1) paid += prizesOwed(drawResults(sha256(ascii(`seed-${String(count)}-${String(index)}`)), count, odds, jackpot));
        expect(paid).toBeLessThan(count * seeds * ticket);
      }
    }
  });
});
