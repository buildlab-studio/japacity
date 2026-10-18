import { fc, test } from "@fast-check/vitest";
import { content } from "@japacity/content";
import { describe, expect } from "vitest";

import type { Content, LotteryOdds, LotteryResult } from "../engine/types";
import {
  checkLotteryContent,
  drawResults,
  drawSeed,
  drawWinners,
  expectedReturnPerMillion,
  forcedTicket,
  fromHex,
  jackpotHit,
  listHashOf,
  openingJackpot,
  PER_MILLION,
  prizesFor,
  prizesOwed,
  RAFFLE_AT_SWITCH_OFF,
  raffleProblems,
  rollJackpot,
  sha256,
  ticketDraw,
  ticketResult,
  tierOfDraw,
  tiersFor,
  toHex,
  topUpFor,
  topUpPart,
} from "./lottery.draw";
import type { TierSpec } from "./lottery.draw";

const { ticket, odds } = content.tuning.lottery;
/** The raffle's settings when decision 0016 switched it off, for the raffle's own tests. */
const tuning = RAFFLE_AT_SWITCH_OFF;

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

describe("the raffle, switched off by decision 0016", () => {
  const SEED = sha256(ascii("japacity"));
  const SPEC = (jackpot: number, mid: number, small: number): TierSpec[] => [
    { tier: "jackpot", count: jackpot },
    { tier: "mid", count: mid },
    { tier: "small", count: small },
  ];

  test("[lottery:ticket-result-is-public-function] given a fixed seed, when the winners are drawn, then they match an independent implementation of the published method", () => {
    // Worked in Python's hashlib from the rule's words: counter blocks, 64-bit words, rejection, redraw on a repeat.
    expect(toHex(SEED)).toBe("22300a4d5b852620facc406ad57d5db67381b8c3022d32758fc4e71df46bae54");
    expect(drawWinners(SEED, 100, SPEC(1, 10, 2))).toEqual([[34], [97, 99, 18, 62, 81, 54, 83, 47, 88, 23], [70, 17]]);
    expect(drawWinners(SEED, 1000, SPEC(1, 10, 20))).toEqual([
      [434],
      [597, 699, 918, 934, 962, 181, 754, 183, 647, 288],
      [123, 970, 117, 277, 892, 120, 172, 834, 26, 240, 139, 374, 295, 356, 655, 694, 957, 441, 357, 280],
    ]);
  });

  test("[lottery:ticket-result-is-public-function] given fewer tickets than places, when the winners are drawn, then the tiers fill in order and a tier with no ticket left pays nobody", () => {
    expect(drawWinners(SEED, 3, SPEC(1, 10, 1))).toEqual([[1], [0, 2], []]);
    expect(drawWinners(SEED, 0, SPEC(1, 10, 1))).toEqual([[], [], []]);
  });

  test.prop([fc.uint8Array({ minLength: 1, maxLength: 64 }), fc.integer({ min: 0, max: 400 }), fc.array(fc.integer({ min: 0, max: 30 }), { minLength: 1, maxLength: 4 })])(
    "[lottery:ticket-result-is-public-function] given any seed, count and tiers, when the winners are drawn twice, then they are the same, in range, and no ticket wins twice",
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

  test("[lottery:ticket-result-is-public-function] given two seeds one byte apart, when the winners are drawn, then the draws differ", () => {
    const other = new Uint8Array(SEED);
    other[0] = other[0]! ^ 1;
    expect(drawWinners(other, 1000, SPEC(1, 10, 20))).not.toEqual(drawWinners(SEED, 1000, SPEC(1, 10, 20)));
  });

  test("[lottery:seed-from-secret-and-beacon] given the secret, the list's hash and the beacon's randomness, when the seed is made, then it is the SHA-256 of the three joined in that order", () => {
    const [secret, list, beacon] = ["00".repeat(32), "11".repeat(32), "22".repeat(32)];
    // Python: sha256(bytes.fromhex(secret + list + beacon)).
    expect(toHex(drawSeed(secret, list, beacon))).toBe("b647d2614ad2099840c899399acf3b264e8f40f9eb0d0f997c2e6e1c3ffc2da6");
    expect(toHex(drawSeed(list, secret, beacon))).not.toBe(toHex(drawSeed(secret, list, beacon)));
    expect(() => drawSeed("abc", list, beacon)).toThrow();
  });
});

describe("the raffle's tiers and prizes, switched off by decision 0016", () => {
  test("[lottery:jackpot-rolls-over] given the tickets sold, when the tiers are set, then there is one jackpot, the mid count, and one small prize in every smallEvery, never fewer than keep a small share under a mid one", () => {
    const small = (count: number) => tiersFor(count, tuning).find((spec) => spec.tier === "small")?.count;
    expect(tiersFor(0, tuning).map((spec) => spec.tier)).toEqual(["jackpot", "mid", "small"]);
    expect(tiersFor(0, tuning)[0]?.count).toBe(1);
    expect(tiersFor(0, tuning)[1]?.count).toBe(tuning.midCount);
    // The shipped shares are equal, so the floor is one place more than the mid count.
    expect(tuning.smallBp).toBe(tuning.midBp);
    const floor = tuning.midCount + 1;
    expect(small(0)).toBe(floor);
    expect(small(tuning.smallEvery)).toBe(floor);
    expect(small(tuning.smallEvery * (floor + 1) - 1)).toBe(floor);
    expect(small(tuning.smallEvery * (floor + 1))).toBe(floor + 1);
    const lean = { ...tuning, midBp: tuning.midBp + tuning.smallBp, smallBp: 0 };
    expect(tiersFor(0, lean).find((spec) => spec.tier === "small")?.count).toBe(1);
  });

  test.prop([fc.integer({ min: 0, max: 20000 }), fc.integer({ min: 0, max: 10000 })])(
    "[lottery:jackpot-rolls-over] given any tickets sold and any declared top-up, when the prizes are set, then a mid prize pays more than a small one",
    (count, topUpTickets) => {
      const pot = count * tuning.ticket + topUpFor(count, topUpTickets, tuning.ticket);
      const tiers = tiersFor(count, tuning);
      const amounts = prizesFor(pot, tiers, [], tuning).winners;
      const mid = amounts.find((tier) => tier.tier === "mid")!.amount;
      const small = amounts.find((tier) => tier.tier === "small")!.amount;
      if (mid === 0) expect(small).toBe(0);
      else expect(small).toBeLessThan(mid);
    },
  );

  test("[lottery:jackpot-rolls-over] given a draw of 200 tickets sold under a top-up of 5000, when the prizes are set, then a mid prize is not the ₦16,500 against a small ₦41,250: the small pays less", () => {
    const count = 200;
    const pot = count * tuning.ticket + topUpFor(count, 5000, tuning.ticket);
    const amounts = prizesFor(pot, tiersFor(count, tuning), [], tuning).winners.map((tier) => tier.amount);
    expect(amounts[1]).toBe(1650000);
    expect(amounts[2]).toBeLessThan(amounts[1]!);
  });

  test("[lottery:jackpot-rolls-over] given the raffle's last settings, when they are checked, then the tiers share the whole fund, and settings that do not are refused", () => {
    expect(raffleProblems(tuning)).toEqual([]);
    expect(raffleProblems({ ...tuning, jackpotBp: tuning.jackpotBp + 1 })).toHaveLength(1);
  });

  test("[lottery:fixed-prizes-shared-jackpot] given 1000 tickets sold and every place filled, when the prizes are set, then the fund is 55% of the pot and the prizes pay all of it", () => {
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

  test("[lottery:fixed-prizes-shared-jackpot] given 3 tickets sold, when the prizes are set, then the unfilled places pay nothing and the rest of the fund is destroyed", () => {
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
    "[lottery:fixed-prizes-shared-jackpot] given any number of tickets sold, when the prizes are set, then no more than the fund is paid and every amount is whole",
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

  test("[lottery:result-published-in-tick-row] given a raffle's published winners, when anyone recomputes the seed and the winners, then they match the winning tickets", () => {
    const secret = toHex(sha256(ascii("secret")));
    const listHash = toHex(sha256(ascii("list")));
    const beaconRandomness = toHex(sha256(ascii("beacon")));
    const count = 240;
    const tiers = tiersFor(count, tuning);
    const pot = count * tuning.ticket;
    const table = prizesFor(pot, tiers, drawWinners(drawSeed(secret, listHash, beaconRandomness), count, tiers), tuning);
    const again = drawWinners(drawSeed(secret, listHash, beaconRandomness), count, tiersFor(count, tuning));
    expect(again).toEqual(table.winners.map((tier) => tier.tickets));
  });
});

describe("the raffle's house top-up, switched off by decision 0016", () => {
  const declared = tuning.topUpTickets;

  test("[lottery:odds-fixed-at-draw-open] given sales one under, at and one over the declared number, when the top-up is set, then it makes the pot up to that many tickets' worth and is 0 from there", () => {
    expect(topUpFor(0, declared, tuning.ticket)).toBe(declared * tuning.ticket);
    expect(topUpFor(declared - 1, declared, tuning.ticket)).toBe(tuning.ticket);
    expect(topUpFor(declared, declared, tuning.ticket)).toBe(0);
    expect(topUpFor(declared + 1, declared, tuning.ticket)).toBe(0);
    expect(topUpFor(0, 0, tuning.ticket)).toBe(0);
  });

  test.prop([fc.integer({ min: 0, max: 20000 }), fc.integer({ min: 0, max: 20000 })])(
    "[lottery:odds-fixed-at-draw-open] given any sales and any declared number, when the pot is made, then it is never under the declared tickets' worth and the top-up stops once sales pass it",
    (count, topUpTickets) => {
      const topUp = topUpFor(count, topUpTickets, tuning.ticket);
      const pot = count * tuning.ticket + topUp;
      expect(pot).toBe(Math.max(count, topUpTickets) * tuning.ticket);
      expect(topUp === 0).toBe(count >= topUpTickets);
    },
  );

  test("[lottery:expected-return-below-price] given a pot that is half top-up, when a prize is split, then the top-up part is the prize times the top-up over the pot, rounded down", () => {
    expect(topUpPart(1001, 500, 1000)).toBe(500);
    expect(topUpPart(1001, 1000, 1000)).toBe(1001);
    expect(topUpPart(1001, 0, 1000)).toBe(0);
    expect(topUpPart(0, 500, 1000)).toBe(0);
    expect(topUpPart(5, 0, 0)).toBe(0);
  });

  test.prop([fc.integer({ min: 0, max: 20000 }), fc.integer({ min: 0, max: 20000 }), fc.uint8Array({ minLength: 32, maxLength: 32 })])(
    "[lottery:expected-return-below-price] given any draw, when every prize is split, then the top-up parts paid never pass the top-up and each part is a whole number from 0 up to its prize",
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

  test("[lottery:odds-fixed-at-draw-open] given the raffle's last settings, when they are checked, then the declared number passes, and one that is not a whole number from 0 is refused", () => {
    expect(raffleProblems(tuning)).toEqual([]);
    for (const topUpTickets of [-1, Number("2.5")]) expect(raffleProblems({ ...tuning, topUpTickets })).toHaveLength(1);
    expect(raffleProblems({ ...tuning, topUpTickets: Number.MAX_SAFE_INTEGER })).toHaveLength(1);
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
