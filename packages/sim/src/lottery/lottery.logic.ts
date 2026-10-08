// The Friday draw as the character sees it: docs/rules/lottery.md. The server
// runs the draw and publishes it on the world; this kind holds the tickets
// bought, pays what the authority says, and shows the result once. Not built
// yet beyond the slice, the requirement and the view: the online milestone's
// lottery agent fills the commands, the phase and the lines.
import type { RegisteredKind } from "../engine/kind";
import { reject } from "../engine/reject";
import type { LotterySlice, PlayerView, ReadCtx, ReportLine, Requirement, RequirementResult, State } from "../engine/types";
import type { LotteryEvent } from "./lottery.events";

function evolve(slice: LotterySlice, event: LotteryEvent): LotterySlice {
  switch (event.type) {
    case "lottery/bought":
      return { ...slice, draw: event.draw, tickets: (slice.draw === event.draw ? slice.tickets : 0) + event.tickets };
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
    case "lottery/shown":
      return [];
    case "lottery/paid":
      return [{ key: "line.lottery.letter", params: { draw: event.draw }, tone: "good", attention: true, counts: [] }];
    default: {
      const never: never = event;
      throw new Error(`Unknown lottery event ${JSON.stringify(never)}.`);
    }
  }
}

/** R-LOTTERY-002: `activity.play-lotto` holds only while the world runs no draw. */
function judgeWorld(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "world/lottery") throw new Error(`world/lottery cannot judge ${requirement.type}.`);
  return { met: (read.world.lottery !== null) === requirement.online };
}

function view(read: ReadCtx): Pick<PlayerView, "lottery"> {
  const draw = read.world.lottery;
  if (draw === null) return { lottery: null };
  const { ticket, maxTickets } = read.content.tuning.lottery;
  const mine = read.state.lottery;
  return {
    lottery: {
      ticket,
      maxTickets,
      draw: draw.draw,
      closesTick: draw.closesTick,
      tickets: mine.draw === draw.draw ? mine.tickets : 0,
      numbers: null,
      potSoFar: draw.potSoFar,
      fingerprint: draw.fingerprint,
      last: draw.last,
    },
  };
}

function invariants(state: State): string[] {
  const problems: string[] = [];
  const { draw, tickets } = state.lottery;
  if (!Number.isSafeInteger(tickets) || tickets < 0) problems.push(`The lottery holds ${String(tickets)} tickets.`);
  if (draw === null && tickets !== 0) problems.push("The lottery holds tickets for no draw.");
  return problems;
}

export const lotteryKind: RegisteredKind<LotterySlice, LotteryEvent> = {
  kind: "lottery",
  initial: () => ({ draw: null, tickets: 0, paid: null, seen: null }),
  commands: {
    "lottery/buy": () => reject("not-legal", "The draw is not built yet."),
    "lottery/pay": () => reject("not-legal", "The draw is not built yet."),
  },
  evolve,
  lines,
  requirements: { "world/lottery": judgeWorld },
  invariants,
  view,
};
