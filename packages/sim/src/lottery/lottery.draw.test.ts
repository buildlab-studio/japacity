import { fc, test } from "@fast-check/vitest";
import { content } from "@japacity/content";
import { describe, expect } from "vitest";

import type { Content, LotteryResult } from "../engine/types";
import { checkLotteryContent, drawSeed, drawWinners, fromHex, listHashOf, prizesFor, sha256, tiersFor, toHex, topUpFor, topUpPart } from "./lottery.draw";
import type { TierSpec } from "./lottery.draw";

const tuning = content.tuning.lottery;

/** The test messages are plain ASCII, one byte a character. */
function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

function hashOf(text: string): string {
  return toHex(sha256(ascii(text)));
}

describe("SHA-256", () => {
  test("[R-LOTTERY-010] given the examples of FIPS 180-4, when they are hashed, then each digest is the published one", () => {
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

  test("[R-LOTTERY-010] given messages at the padding's edges, when they are hashed, then each matches a reference implementation", () => {
    // From `shasum -a 256`: 55 bytes fit one block with the length, 56 need two.
    expect(hashOf("a".repeat(55))).toBe("9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318");
    expect(hashOf("a".repeat(56))).toBe("b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a");
    expect(hashOf("a".repeat(63))).toBe("7d3e74a05d7db15bce4ad9ec0658ea98e3f06eeecf16b4c6fff2da457ddc2f34");
    expect(hashOf("a".repeat(64))).toBe("ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb");
    expect(hashOf("a".repeat(119))).toBe("31eba51c313a5c08226adf18d4a359cfdfd8d2e816b13f4af952f7ea6584dcfb");
  });

  test.prop([fc.uint8Array({ maxLength: 200 })])("[R-LOTTERY-010] given any bytes, when they go to hex and back, then they are unchanged", (bytes) => {
    expect(fromHex(toHex(bytes))).toEqual(bytes);
  });
});

describe("the draw", () => {
  const SEED = sha256(ascii("japacity"));
  const SPEC = (jackpot: number, mid: number, small: number): TierSpec[] => [
    { tier: "jackpot", count: jackpot },
    { tier: "mid", count: mid },
    { tier: "small", count: small },
  ];

  test("[R-LOTTERY-010] given a fixed seed, when the winners are drawn, then they match an independent implementation of the published method", () => {
    // Worked in Python's hashlib from the rule's words: counter blocks, 64-bit words, rejection, redraw on a repeat.
    expect(toHex(SEED)).toBe("22300a4d5b852620facc406ad57d5db67381b8c3022d32758fc4e71df46bae54");
    expect(drawWinners(SEED, 100, SPEC(1, 10, 2))).toEqual([[34], [97, 99, 18, 62, 81, 54, 83, 47, 88, 23], [70, 17]]);
    expect(drawWinners(SEED, 1000, SPEC(1, 10, 20))).toEqual([
      [434],
      [597, 699, 918, 934, 962, 181, 754, 183, 647, 288],
      [123, 970, 117, 277, 892, 120, 172, 834, 26, 240, 139, 374, 295, 356, 655, 694, 957, 441, 357, 280],
    ]);
  });

  test("[R-LOTTERY-010] given fewer tickets than places, when the winners are drawn, then the tiers fill in order and a tier with no ticket left pays nobody", () => {
    expect(drawWinners(SEED, 3, SPEC(1, 10, 1))).toEqual([[1], [0, 2], []]);
    expect(drawWinners(SEED, 0, SPEC(1, 10, 1))).toEqual([[], [], []]);
  });

  test.prop([fc.uint8Array({ minLength: 1, maxLength: 64 }), fc.integer({ min: 0, max: 400 }), fc.array(fc.integer({ min: 0, max: 30 }), { minLength: 1, maxLength: 4 })])(
    "[R-LOTTERY-010] given any seed, count and tiers, when the winners are drawn twice, then they are the same, in range, and no ticket wins twice",
    (seed, count, counts) => {
      const tiers: TierSpec[] = counts.map((size) => ({ tier: "mid", count: size }));
      const first = drawWinners(seed, count, tiers);
      expect(drawWinners(seed, count, tiers)).toEqual(first);
      const all = first.flat();
      expect(new Set(all).size).toBe(all.length);
      expect(all.every((ticket) => Number.isSafeInteger(ticket) && ticket >= 0 && ticket < count)).toBe(true);
      expect(all.length).toBe(Math.min(count, counts.reduce((sum, size) => sum + size, 0)));
    },
  );

  test("[R-LOTTERY-010] given two seeds one byte apart, when the winners are drawn, then the draws differ", () => {
    const other = new Uint8Array(SEED);
    other[0] = other[0]! ^ 1;
    expect(drawWinners(other, 1000, SPEC(1, 10, 20))).not.toEqual(drawWinners(SEED, 1000, SPEC(1, 10, 20)));
  });

  test("[R-LOTTERY-009] given the secret, the list's hash and the beacon's randomness, when the seed is made, then it is the SHA-256 of the three joined in that order", () => {
    const [secret, list, beacon] = ["00".repeat(32), "11".repeat(32), "22".repeat(32)];
    // Python: sha256(bytes.fromhex(secret + list + beacon)).
    expect(toHex(drawSeed(secret, list, beacon))).toBe("b647d2614ad2099840c899399acf3b264e8f40f9eb0d0f997c2e6e1c3ffc2da6");
    expect(toHex(drawSeed(list, secret, beacon))).not.toBe(toHex(drawSeed(secret, list, beacon)));
    expect(() => drawSeed("abc", list, beacon)).toThrow();
  });
});

describe("tiers and prizes", () => {
  test("[R-LOTTERY-012] given the tickets sold, when the tiers are set, then there is one jackpot, the mid count, and one small prize in every smallEvery with at least one", () => {
    const small = (count: number) => tiersFor(count, tuning).find((spec) => spec.tier === "small")?.count;
    expect(tiersFor(0, tuning).map((spec) => spec.tier)).toEqual(["jackpot", "mid", "small"]);
    expect(tiersFor(0, tuning)[0]?.count).toBe(1);
    expect(tiersFor(0, tuning)[1]?.count).toBe(tuning.midCount);
    expect(small(0)).toBe(1);
    expect(small(tuning.smallEvery - 1)).toBe(1);
    expect(small(tuning.smallEvery)).toBe(1);
    expect(small(tuning.smallEvery * 2 - 1)).toBe(1);
    expect(small(tuning.smallEvery * 2)).toBe(2);
  });

  test("[R-LOTTERY-012] given the shipped tuning, when content is checked, then the tiers share the whole fund, and a tuning that does not is refused", () => {
    expect(checkLotteryContent(content)).toEqual([]);
    const off: Content = { ...content, tuning: { ...content.tuning, lottery: { ...tuning, jackpotBp: tuning.jackpotBp + 1 } } };
    expect(checkLotteryContent(off)).toHaveLength(1);
  });

  test("[R-LOTTERY-011] given 1000 tickets sold and every place filled, when the prizes are set, then the fund is 55% of the pot and the prizes pay all of it", () => {
    const count = 1000;
    const pot = count * tuning.ticket;
    const tiers = tiersFor(count, tuning);
    const winners = drawWinners(sha256(ascii("full")), count, tiers);
    const table = prizesFor(pot, tiers, winners, tuning);
    expect(table.fund).toBe(11000000);
    expect(table.winners.map((tier) => tier.amount)).toEqual([4400000, 330000, 165000]);
    const paid = table.winners.reduce((sum, tier) => sum + tier.amount * tier.tickets.length, 0);
    // The expected return: 55 kobo of each naira staked.
    expect(paid).toBe(table.fund);
    expect(paid * 100).toBe(pot * 55);
  });

  test("[R-LOTTERY-011] given 3 tickets sold, when the prizes are set, then the unfilled places pay nothing and the rest of the fund is destroyed", () => {
    const count = 3;
    const pot = count * tuning.ticket;
    const tiers = tiersFor(count, tuning);
    const winners = drawWinners(sha256(ascii("japacity")), count, tiers);
    const table = prizesFor(pot, tiers, winners, tuning);
    expect(table.winners.map((tier) => tier.tickets.length)).toEqual([1, 2, 0]);
    const paid = table.winners.reduce((sum, tier) => sum + tier.amount * tier.tickets.length, 0);
    expect(paid).toBeLessThan(table.fund);
  });

  test.prop([fc.integer({ min: 0, max: 100000 }), fc.uint8Array({ minLength: 32, maxLength: 32 })])(
    "[R-LOTTERY-011] given any number of tickets sold, when the prizes are set, then no more than the fund is paid and every amount is whole",
    (count, seed) => {
      const pot = count * tuning.ticket;
      const tiers = tiersFor(count, tuning);
      const table = prizesFor(pot, tiers, drawWinners(seed, count, tiers), tuning);
      const paid = table.winners.reduce((sum, tier) => sum + tier.amount * tier.tickets.length, 0);
      expect(paid).toBeLessThanOrEqual(table.fund);
      expect(table.fund).toBeLessThanOrEqual(pot);
      expect(table.winners.every((tier) => Number.isSafeInteger(tier.amount) && tier.amount >= 0)).toBe(true);
    },
  );

  test("[R-LOTTERY-015] given a published result, when anyone recomputes the seed and the winners from it, then they match the result's winning tickets", () => {
    const secret = toHex(sha256(ascii("secret")));
    const listHash = toHex(sha256(ascii("list")));
    const beaconRandomness = toHex(sha256(ascii("beacon")));
    const count = 240;
    const tiers = tiersFor(count, tuning);
    const pot = count * tuning.ticket;
    const table = prizesFor(pot, tiers, drawWinners(drawSeed(secret, listHash, beaconRandomness), count, tiers), tuning);
    const result: LotteryResult = { draw: 4, revealed: secret, beaconRound: 9, beaconRandomness, listHash, count, pot, topUp: 0, fund: table.fund, winners: table.winners };
    const again = drawWinners(drawSeed(result.revealed, result.listHash, result.beaconRandomness), result.count, tiersFor(result.count, tuning));
    expect(again).toEqual(result.winners.map((tier) => tier.tickets));
  });
});

describe("the house top-up", () => {
  const declared = tuning.topUpTickets;

  test("[R-LOTTERY-021] given sales one under, at and one over the declared number, when the top-up is set, then it makes the pot up to that many tickets' worth and is 0 from there", () => {
    expect(topUpFor(0, declared, tuning.ticket)).toBe(declared * tuning.ticket);
    expect(topUpFor(declared - 1, declared, tuning.ticket)).toBe(tuning.ticket);
    expect(topUpFor(declared, declared, tuning.ticket)).toBe(0);
    expect(topUpFor(declared + 1, declared, tuning.ticket)).toBe(0);
    expect(topUpFor(0, 0, tuning.ticket)).toBe(0);
  });

  test.prop([fc.integer({ min: 0, max: 20000 }), fc.integer({ min: 0, max: 20000 })])(
    "[R-LOTTERY-021] given any sales and any declared number, when the pot is made, then it is never under the declared tickets' worth and the top-up stops once sales pass it",
    (count, topUpTickets) => {
      const topUp = topUpFor(count, topUpTickets, tuning.ticket);
      const pot = count * tuning.ticket + topUp;
      expect(pot).toBe(Math.max(count, topUpTickets) * tuning.ticket);
      expect(topUp === 0).toBe(count >= topUpTickets);
    },
  );

  test("[R-LOTTERY-022] given a pot that is half top-up, when a prize is split, then the top-up part is the prize times the top-up over the pot, rounded down", () => {
    expect(topUpPart(1001, 500, 1000)).toBe(500);
    expect(topUpPart(1001, 1000, 1000)).toBe(1001);
    expect(topUpPart(1001, 0, 1000)).toBe(0);
    expect(topUpPart(0, 500, 1000)).toBe(0);
    expect(topUpPart(5, 0, 0)).toBe(0);
  });

  test.prop([fc.integer({ min: 0, max: 20000 }), fc.integer({ min: 0, max: 20000 }), fc.uint8Array({ minLength: 32, maxLength: 32 })])(
    "[R-LOTTERY-022] given any draw, when every prize is split, then the top-up parts paid never pass the top-up and each part is a whole number from 0 up to its prize",
    (count, topUpTickets, seed) => {
      const topUp = topUpFor(count, topUpTickets, tuning.ticket);
      const pot = count * tuning.ticket + topUp;
      const tiers = tiersFor(count, tuning);
      const table = prizesFor(pot, tiers, drawWinners(seed, count, tiers), tuning);
      let house = 0;
      for (const tier of table.winners) {
        const part = topUpPart(tier.amount, topUp, pot);
        expect(Number.isSafeInteger(part) && part >= 0 && part <= tier.amount).toBe(true);
        house += part * tier.tickets.length;
      }
      expect(house).toBeLessThanOrEqual(topUp);
    },
  );

  test("[R-LOTTERY-021] given the shipped tuning, when content is checked, then the declared number passes, and one that is not a whole number from 0 is refused", () => {
    expect(checkLotteryContent(content)).toEqual([]);
    for (const topUpTickets of [-1, Number("2.5")]) {
      const off: Content = { ...content, tuning: { ...content.tuning, lottery: { ...tuning, topUpTickets } } };
      expect(checkLotteryContent(off)).toHaveLength(1);
    }
    const huge: Content = { ...content, tuning: { ...content.tuning, lottery: { ...tuning, topUpTickets: Number.MAX_SAFE_INTEGER } } };
    expect(checkLotteryContent(huge)).toHaveLength(1);
  });

  test("[R-LOTTERY-008] given tokens in ticket order, when the list's hash is made, then it is the SHA-256 of their bytes joined in that order", () => {
    const tokens = ["0011223344556677", "8899aabbccddeeff", "0011223344556677", "fedcba9876543210"];
    expect(listHashOf(tokens)).toBe(toHex(sha256(fromHex(tokens.join("")))));
    expect(listHashOf([...tokens].reverse())).not.toBe(listHashOf(tokens));
    expect(listHashOf([])).toBe(hashOf(""));
  });
});
