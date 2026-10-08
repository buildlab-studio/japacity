// The Friday draw as the character sees it: docs/rules/lottery.md. The server
// runs the draw and publishes it on the world; this kind holds the tickets
// bought, pays what the authority says, and shows the result once.
import type { RegisteredKind } from "../engine/kind";
import { reject } from "../engine/reject";
import type {
  BaseEvent,
  Cause,
  Command,
  Content,
  Ctx,
  Effect,
  LotterySlice,
  PlayerView,
  ReadCtx,
  Rejection,
  ReportLine,
  Requirement,
  RequirementResult,
  State,
} from "../engine/types";
import type { LotteryEvent } from "./lottery.events";

const TIERS = ["jackpot", "mid", "small"] as const;

/** Tickets and prizes are this kind's own doing, not an entry's. */
const CAUSE: Cause = { source: "lottery", param: null, terms: {} };

/** R-LOTTERY-004: tickets count only for the draw they were bought in. */
function heldIn(slice: LotterySlice, draw: number): number {
  return slice.draw === draw ? slice.tickets : 0;
}

/** R-LOTTERY-002 to 004: tickets for the draw on sale, from the naira bank, up to the cap. */
function buy(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "lottery/buy") throw new Error(`lottery/buy cannot handle ${command.type}.`);
  const open = ctx.world.lottery;
  if (open === null) return reject("not-legal", "The world runs no draw.");
  if (ctx.world.tick >= open.closesTick) return reject("not-legal", `Draw ${String(open.draw)} closed at tick ${String(open.closesTick)}.`);
  const { ticket, maxTickets } = ctx.content.tuning.lottery;
  const { tickets } = command;
  const held = heldIn(ctx.state.lottery, open.draw);
  if (!Number.isSafeInteger(tickets) || tickets < 1 || held + tickets > maxTickets) {
    return reject("bad-amount", `Tickets are a whole number from 1, and ${String(held)} are held of the ${String(maxTickets)} allowed.`);
  }
  const cost = tickets * ticket;
  // the first plan says naira cash; R-LOTTERY-003 says the naira bank pocket, which is followed here.
  if (ctx.state.wallet.pockets.NGN.bank < cost) return reject("cannot-afford", "The naira bank holds less than the tickets cost.");
  ctx.apply([{ type: "money/take", currency: "NGN", pocket: "bank", amount: cost, reason: "ticket" }], CAUSE);
  const bought: LotteryEvent = { type: "lottery/bought", draw: open.draw, tickets, cost };
  return [bought];
}

/** R-LOTTERY-013, R-LOTTERY-022: the authority's payout, to the naira bank as `win` and `pot-top-up`, never flagged, once per draw. */
function pay(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "lottery/pay") throw new Error(`lottery/pay cannot handle ${command.type}.`);
  const { draw, prizes } = command;
  if (!Number.isSafeInteger(draw) || draw < 0) return reject("not-legal", `There is no draw ${String(draw)}.`);
  const { paid } = ctx.state.lottery;
  // the slice keeps only the last draw paid, and draws are paid in order, so an earlier draw counts as paid too.
  if (paid !== null && draw <= paid) return reject("not-legal", `Draw ${String(draw)} is already paid: the last draw paid is ${String(paid)}.`);
  if (prizes.length === 0) return reject("bad-amount", "A payout names at least one prize.");
  for (const prize of prizes) {
    if (!(TIERS as readonly string[]).includes(prize.tier)) return reject("not-legal", `There is no tier ${String(prize.tier)}.`);
    if (!Number.isSafeInteger(prize.amount) || prize.amount < 1) return reject("bad-amount", "A prize is a whole number of kobo from 1.");
    if (!Number.isSafeInteger(prize.topUp) || prize.topUp < 0 || prize.topUp > prize.amount) {
      return reject("bad-amount", "A prize's top-up part is a whole number of kobo from 0 up to the prize.");
    }
  }
  // R-LOTTERY-022: the house's part as `pot-top-up`, the rest as `win`, so the two never mix in the ledger.
  const credits: Effect[] = prizes.flatMap((prize) => [
    ...(prize.amount > prize.topUp ? [{ type: "money/add", currency: "NGN", pocket: "bank", amount: prize.amount - prize.topUp, reason: "win" } as const] : []),
    ...(prize.topUp > 0 ? [{ type: "money/add", currency: "NGN", pocket: "bank", amount: prize.topUp, reason: "pot-top-up" } as const] : []),
  ]);
  ctx.apply(credits, CAUSE);
  const event: LotteryEvent = { type: "lottery/paid", draw, prizes: prizes.map((prize) => ({ tier: prize.tier, amount: prize.amount, topUp: prize.topUp })) };
  return [event];
}

/** R-LOTTERY-016: the last draw, once, to a character who has not been shown it. */
function tell(ctx: Ctx): BaseEvent[] {
  const last = ctx.world.lottery?.last ?? null;
  if (last === null) return [];
  const { seen } = ctx.state.lottery;
  if (seen !== null && seen >= last.draw) return [];
  const jackpot = last.winners.find((tier) => tier.tier === "jackpot" && tier.tickets.length > 0)?.amount ?? 0;
  const winners = last.winners.reduce((sum, tier) => sum + tier.tickets.length, 0);
  const shown: LotteryEvent = { type: "lottery/shown", draw: last.draw, jackpot, winners };
  return [shown];
}

function evolve(slice: LotterySlice, event: LotteryEvent): LotterySlice {
  switch (event.type) {
    case "lottery/bought":
      return { ...slice, draw: event.draw, tickets: heldIn(slice, event.draw) + event.tickets };
    case "lottery/paid":
      return { ...slice, paid: event.draw };
    case "lottery/shown":
      return { ...slice, seen: event.draw };
    default: {
      const never: never = event;
      throw new Error(`Unknown lottery event ${JSON.stringify(never)}.`);
    }
  }
}

function lines(event: LotteryEvent): ReportLine[] {
  switch (event.type) {
    case "lottery/bought":
      return [];
    case "lottery/shown":
      return [
        {
          key: "line.lottery.drawn",
          params: { draw: event.draw, jackpot: { currency: "NGN", amount: event.jackpot }, winners: event.winners },
          tone: "plain",
          attention: false,
          counts: [],
        },
      ];
    case "lottery/paid": {
      const won = event.prizes.reduce((sum, prize) => sum + prize.amount, 0);
      // R-LUCK-008: a jackpot or a mid prize is staged.
      const big = event.prizes.some((prize) => prize.tier === "jackpot" || prize.tier === "mid");
      return [{ key: "line.lottery.letter", params: { draw: event.draw, won: { currency: "NGN", amount: won } }, tone: "good", big, attention: true, counts: [] }];
    }
    default: {
      const never: never = event;
      throw new Error(`Unknown lottery event ${JSON.stringify(never)}.`);
    }
  }
}

/** R-LOTTERY-001: `activity.play-lotto` holds only while the world runs no draw. */
function judgeWorld(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "world/lottery") throw new Error(`world/lottery cannot judge ${requirement.type}.`);
  return { met: (read.world.lottery !== null) === requirement.online };
}

/**
 * R-LOTTERY-006, R-LOTTERY-023. The top-up so far is the declared tickets'
 * worth less the sales so far, at 0 once sales pass it.
 * R-LOTTERY-005's ticket numbers are the server's; nothing in the world or the slice carries them, so `numbers` stays null.
 */
function view(read: ReadCtx): Pick<PlayerView, "lottery"> {
  const draw = read.world.lottery;
  if (draw === null) return { lottery: null };
  const { ticket, maxTickets } = read.content.tuning.lottery;
  return {
    lottery: {
      ticket,
      maxTickets,
      draw: draw.draw,
      closesTick: draw.closesTick,
      tickets: heldIn(read.state.lottery, draw.draw),
      numbers: null,
      potSoFar: draw.potSoFar,
      topUpTickets: draw.topUpTickets,
      topUpSoFar: Math.max(0, draw.topUpTickets * ticket - draw.potSoFar),
      fingerprint: draw.fingerprint,
      last: draw.last,
    },
  };
}

function isDraw(value: number | null): boolean {
  return value === null || (Number.isSafeInteger(value) && value >= 0);
}

function invariants(state: State, content: Content): string[] {
  const problems: string[] = [];
  const { draw, tickets, paid, seen } = state.lottery;
  if (!Number.isSafeInteger(tickets) || tickets < 0) problems.push(`The lottery holds ${String(tickets)} tickets.`);
  if (tickets > content.tuning.lottery.maxTickets) problems.push(`The lottery holds ${String(tickets)} tickets, over the cap of ${String(content.tuning.lottery.maxTickets)}.`);
  if (draw === null && tickets !== 0) problems.push("The lottery holds tickets for no draw.");
  if (!isDraw(draw) || !isDraw(paid) || !isDraw(seen)) problems.push(`The lottery names a draw that is not a whole number from 0: ${JSON.stringify(state.lottery)}.`);
  return problems;
}

export const lotteryKind: RegisteredKind<LotterySlice, LotteryEvent> = {
  kind: "lottery",
  initial: () => ({ draw: null, tickets: 0, paid: null, seen: null }),
  commands: { "lottery/buy": buy, "lottery/pay": pay },
  phases: { news: tell },
  evolve,
  lines,
  requirements: { "world/lottery": judgeWorld },
  invariants,
  view,
};
