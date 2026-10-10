// The authority creates no money: docs/rules/server.md R-SERVER-013, decision 0006 point 2.
// Every command, the authority's and the player's, is sent through `step` on each real
// life, and the ledger is read before and after.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { lifeSaves } from "../goldens/lives.data";
import { legalCommands } from "../testing/legal";
import type { Loose } from "../testing/play";
import { finishPrologue, start } from "../testing/play";
import { standInWorld } from "../world/standIn";
import { stableJson } from "./hash";
import { checkInvariants } from "./invariants";
import { replay } from "./replay";
import { ledgerReport } from "../wallet/report";
import { AUTHORITY_COMMANDS, STAND_IN_COMMANDS, step } from "./step";
import type { Command, CommandType, Currency, Id, Reason, Sender, State, World, PersonFacts } from "./types";
import { viewFor } from "./view";

type AuthorityCommand = (typeof AUTHORITY_COMMANDS)[number];
type PlayerCommand = Exclude<CommandType, AuthorityCommand>;
type Totals = State["wallet"]["totals"]["in"];

/** A draw on sale, as the online world carries it, so the life is played as it is online. */
const ONLINE: NonNullable<World["lottery"]> = { draw: 3, closesTick: 56, onSale: true, fingerprint: "ab".repeat(32), beaconRound: 1, salesSoFar: 0, jackpot: content.tuning.lottery.odds.jackpotStart, rolledOver: false, odds: content.tuning.lottery.odds, last: null };

/** Each real life: every scenario at its start, the prologue's open and finished, and the recorded lives halfway and at their end. */
function lives(): { name: string; state: State }[] {
  const found: { name: string; state: State }[] = [];
  for (const scenario of Object.keys(content.scenario) as Id<"scenario">[]) {
    const game = start({ content, scenario, seed: `money-${scenario}`, worldSeed: "golden-world" });
    found.push({ name: `${scenario} at the start`, state: game.state });
    if (game.state.prologue.open) {
      finishPrologue(game);
      found.push({ name: `${scenario} after the prologue`, state: game.state });
    }
  }
  for (const [name, save] of Object.entries(lifeSaves)) {
    const worldAt = (tick: number) => standInWorld(save.worldSeed, tick, content);
    const half = { ...save, commands: save.commands.slice(0, save.commands.length >> 1) };
    found.push({ name: `${name} halfway`, state: replay(half, content, worldAt).state });
    found.push({ name: `${name} at the end`, state: replay(save, content, worldAt).state });
  }
  return found;
}

function worldFor(state: State): World {
  return { ...standInWorld("golden-world", state.tick, content), lottery: ONLINE };
}

/** Every credit by reason and currency that rose from one ledger to the next. */
function credited(before: Totals, after: Totals): { reason: Reason; currency: Currency; amount: number }[] {
  const rises: { reason: Reason; currency: Currency; amount: number }[] = [];
  for (const [reason, byCurrency] of Object.entries(after) as [Reason, Partial<Record<Currency, number>>][]) {
    for (const [currency, total] of Object.entries(byCurrency) as [Currency, number][]) {
      const was = before[reason]?.[currency] ?? 0;
      if (total > was) rises.push({ reason, currency, amount: total - was });
    }
  }
  return rises;
}

/** Facts about another person, as the server would send them. */
const FACTS: PersonFacts = {
  label: "player",
  ageMonths: 300,
  where: "home",
  country: null,
  status: null,
  statusMonthsLeft: null,
  monthsInCountry: 0,
  job: null,
  meetsFloor: {},
  eduLevel: 3,
  englishBand: 60,
  home: "city",
  joint: null,
  funds: null,
  assistanceTaken: 0,
  sponsorReady: null,
};

/** The sample of each authority command. A command added to the list without one here does not compile. */
const AUTHORITY_SAMPLES: Record<AuthorityCommand, Loose[]> = {
  "turns/grant": [
    { type: "turns/grant", count: 1 },
    { type: "turns/grant", count: content.tuning.turn.cap },
  ],
  "lottery/pay": [
    { type: "lottery/pay", draw: ONLINE.draw, prizes: [{ tier: "small", amount: 500000 }] },
    {
      type: "lottery/pay",
      draw: ONLINE.draw,
      prizes: [
        { tier: "jackpot", amount: 900000000 },
        { tier: "mid", amount: 4000000 },
      ],
    },
    // Decision 0010: a prize that still carries a part from the retired house top-up is refused.
    { type: "lottery/pay", draw: ONLINE.draw, prizes: [{ tier: "mid", amount: 4000000, topUp: 1500000 } as { tier: "mid"; amount: number }] },
  ],
  // The people milestone's commands from the authority: refused by the stubs until the people agents build them, and then still no money.
  "people/link": [{ type: "people/link", slot: "partner", pair: "pair-1", facts: FACTS }],
  "people/facts": [{ type: "people/facts", pair: "pair-1", facts: FACTS }],
  "people/moments": [{ type: "people/moments", pair: "pair-1", moments: [{ n: 1, by: "them", kind: "met", spot: "spot.bar", what: "what.jollof", tick: 1 }] }],
  "people/proposal": [{ type: "people/proposal", pair: "pair-1", proposal: { step: "partner", route: null, lead: null } }],
  "people/agreed": [{ type: "people/agreed", pair: "pair-1", step: "partner" }],
  "people/ended": [{ type: "people/ended", pair: "pair-1", why: "them" }],
  "people/declined": [{ type: "people/declined", pair: "pair-1", step: "partner" }],
  "people/withdrawn": [{ type: "people/withdrawn", pair: "pair-1", step: "partner" }],
  "people/gossip": [{ type: "people/gossip", pair: "pair-1" }],
  "people/stand-in": [{ type: "people/stand-in", pair: "pair-1", stage: "warned" }],
  "people/family-request": [{ type: "people/family-request", offer: "offer.nepa-bill", terms: {} }],
  "interview/open": [{ type: "interview/open", pair: "pair-1", route: "route.uk-masters", questions: [{ id: "q1", options: ["a", "b"] }] }],
  "interview/scored": [{ type: "interview/scored", pair: "pair-1", theirs: ["a"] }],
  // docs/rules/home.md R-HOME-005: a guest staying, never money.
  "home/host": [{ type: "home/host", pair: "pair-1", until: 3 }],
};


/**
 * Samples of each player command on a life: what the view offers as legal,
 * and some it may refuse. A command type without an entry here does not compile.
 */
function playerSamples(state: State, world: World): Record<PlayerCommand, Loose[]> {
  const legal = legalCommands(viewFor({ state, world, content }));
  const of = <T extends PlayerCommand>(type: T) => legal.filter((command) => command.type === type);
  const owed = Object.keys(state.obligation.items)[0];
  const school = content.route["route.uk-masters"]?.schools[0];
  return {
    "turn/end": [{ type: "turn/end", slots: [] }, ...of("turn/end")],
    "activity/quit": [{ type: "activity/quit" }, { type: "activity/quit", side: true }],
    // R-ACTIVITY-015 added the command: the kiosk and the meetup now, a month-act refused, and the legal ones.
    "activity/now": [
      { type: "activity/now", activity: "activity.play-lotto", param: "1" },
      { type: "activity/now", activity: "activity.meetup", param: null },
      { type: "activity/now", activity: "activity.rest", param: null },
      ...of("activity/now"),
    ],
    "offer/choose": [{ type: "offer/choose", offer: "offer-1", choice: "take" }, ...of("offer/choose")],
    "wallet/convert": [
      { type: "wallet/convert", from: "NGN", to: "USD", amount: 1000000, via: "bank" },
      { type: "wallet/convert", from: "GBP", to: "NGN", amount: 1000, via: "aboki" },
      ...of("wallet/convert"),
    ],
    "wallet/move": [{ type: "wallet/move", currency: "NGN", amount: 1000, to: "cash" }, { type: "wallet/move", currency: "NGN", amount: 1000, to: "bank" }, ...of("wallet/move")],
    "obligation/pay": [...(owed === undefined ? [] : [{ type: "obligation/pay", obligation: owed, amount: 100 } as const]), ...of("obligation/pay")],
    "route/pay-deposit": [...(school === undefined ? [] : [{ type: "route/pay-deposit", route: "route.uk-masters", school } as const]), ...of("route/pay-deposit")],
    "route/depart": [{ type: "route/depart", route: "route.uk-masters" }, ...of("route/depart")],
    "setpiece/answer": [{ type: "setpiece/answer", question: "q", answer: "a" }, ...of("setpiece/answer")],
    "wallet/remit": [{ type: "wallet/remit", currency: "GBP", amount: 1000, channel: "app" }, ...of("wallet/remit")],
    "prologue/choose": [{ type: "prologue/choose", step: "s", answer: "a" }, ...of("prologue/choose")],
    "status/renew": [{ type: "status/renew" }],
    "return/home": [{ type: "return/home" }, ...of("return/home")],
    "place/ride": [{ type: "place/ride", from: "place.ojuelegba", to: "place.bode-thomas", way: "keke" }, { type: "place/ride", from: "place.ojuelegba", to: "place.ojuelegba", way: "danfo" }, ...of("place/ride")],
    "people/invite": [{ type: "people/invite", slot: "partner" }],
    "people/court": [{ type: "people/court", with: "person.none" }],
    "people/propose": [{ type: "people/propose", bond: "bond-1", step: "partner" }],
    "people/answer": [{ type: "people/answer", bond: "bond-1", step: "partner", yes: true }],
    "people/withdraw": [{ type: "people/withdraw", bond: "bond-1" }],
    "people/consent": [{ type: "people/consent", bond: "bond-1", countFunds: true }],
    "people/end": [{ type: "people/end", bond: "bond-1" }],
    "interview/answer": [{ type: "interview/answer", question: "q1", option: "a" }],
    "lottery/buy": [
      { type: "lottery/buy", tickets: 1 },
      { type: "lottery/buy", tickets: content.tuning.lottery.maxTickets + 1 },
    ],
    // docs/rules/home.md R-HOME-002: the move, and the move to where the character already lives.
    "home/move": [
      { type: "home/move", to: "place.makoko" },
      { type: "home/move", to: "place.family-house" },
    ],
    // docs/rules/chapter.md R-CHAPTER-009: the plan chosen, never money.
    "chapter/lean": [
      { type: "chapter/lean", route: "route.uk-care" },
      { type: "chapter/lean", route: "route.uk-masters" },
    ],
  };
}

/**
 * What the ledger says is wrong after one command: the identity (R-WALLET-002), every credit
 * no reason may make here, and any reason that now holds more than it can produce in the
 * months played (the ledger report's alarms, R-WALLET-013) when it did not before.
 */
function ledgerProblems(before: State, after: State, mayCredit: (reason: Reason, currency: Currency) => boolean): string[] {
  const problems = checkInvariants(after, content).filter((problem) => problem.includes("R-WALLET"));
  for (const rise of credited(before.wallet.totals.in, after.wallet.totals.in)) {
    if (!mayCredit(rise.reason, rise.currency)) problems.push(`${rise.currency} ${String(rise.amount)} credited under ${rise.reason}`);
  }
  const raised = new Set(ledgerReport(before, content).alarms.map((alarm) => `${alarm.reason} ${alarm.currency}`));
  for (const alarm of ledgerReport(after, content).alarms) {
    if (!raised.has(`${alarm.reason} ${alarm.currency}`)) problems.push(`${alarm.currency} ${String(alarm.total)} under ${alarm.reason} is over what it can make, ${String(alarm.ceiling)}`);
  }
  return problems;
}

function send(state: State, loose: Loose, sender: Sender) {
  const command: Command = { ...loose, basedOn: state.v };
  return step(state, command, worldFor(state), content, sender);
}

const LIVES = lives();

describe("the authority's reach", () => {
  test("[R-SERVER-013] given the simulation, when its authority commands are listed, then they are the closed list: the turn grant, the draw's payout, and the people milestone's messages from another life (decision 0007)", () => {
    expect([...AUTHORITY_COMMANDS].sort()).toEqual(
      [
        "turns/grant",
        "lottery/pay",
        "people/link",
        "people/facts",
        "people/moments",
        "people/proposal",
        "people/agreed",
        "people/ended",
        "people/declined",
        "people/withdrawn",
        "people/gossip",
        "people/stand-in",
        "people/family-request",
        "interview/open",
        "interview/scored",
        // docs/rules/home.md R-HOME-005: a joined player's character staying with this one.
        "home/host",
      ].sort(),
    );
  });

  test.each(LIVES.map((life) => [life.name, life.state] as const))(
    "[R-SERVER-013] [R-WALLET-002] given %s, when the authority grants turns, then no money of any currency is credited and the ledger's identity holds",
    (_name, state) => {
      for (const sample of AUTHORITY_SAMPLES["turns/grant"]) {
        const result = send(state, sample, "authority");
        const after = result.ok ? result.state : state;
        expect(result.ok ? "accepted" : result.code).toBe("accepted");
        expect(stableJson(after.wallet)).toBe(stableJson(state.wallet));
        expect(ledgerProblems(state, after, () => false)).toEqual([]);
      }
    },
  );

  test.each(LIVES.map((life) => [life.name, life.state] as const))(
    "[R-SERVER-013] given %s, when the authority pays a draw, then money is credited only under the win reason to the naira bank and no more than the prizes, or the payment is rejected and nothing moves",
    (_name, state) => {
      for (const sample of AUTHORITY_SAMPLES["lottery/pay"]) {
        const result = send(state, sample, "authority");
        const after = result.ok ? result.state : state;
        const prizes = sample.type === "lottery/pay" ? sample.prizes.reduce((sum, prize) => sum + prize.amount, 0) : 0;
        // Until the lottery kind pays, its stub refuses with not-legal; a life in its prologue refuses every command but the prologue's.
        expect(["accepted", "not-legal", "prologue-open"]).toContain(result.ok ? "accepted" : result.code);
        expect(ledgerProblems(state, after, (reason, currency) => reason === "win" && currency === "NGN")).toEqual([]);
        expect(after.wallet.pockets.NGN.bank - state.wallet.pockets.NGN.bank).toBeLessThanOrEqual(prizes);
        expect(after.wallet.pockets.NGN.cash).toBe(state.wallet.pockets.NGN.cash);
      }
    },
  );

  test.each(LIVES.map((life) => [life.name, life.state] as const))(
    "[R-SERVER-013] given %s, when a player sends an authority command, then it is rejected as not theirs",
    (_name, state) => {
      for (const type of AUTHORITY_COMMANDS) {
        for (const sample of AUTHORITY_SAMPLES[type]) {
          const result = send(state, sample, "player");
          expect(result.ok ? "accepted" : result.code).toBe(state.turn.ended && type !== "turns/grant" ? "ended" : "not-yours");
        }
      }
    },
  );

  test.each(LIVES.map((life) => [life.name, life.state] as const))(
    "[R-SERVER-013] [R-WALLET-002] [R-WALLET-013] given %s on a world that runs the draw, when every player command is sent, then the ledger's identity holds, no reason makes more than it can, none credits an opening balance and none records a draw as paid",
    (_name, state) => {
      const samples = playerSamples(state, worldFor(state));
      let accepted = 0;
      for (const [type, commands] of Object.entries(samples) as [PlayerCommand, Loose[]][]) {
        for (const sample of commands) {
          const result = send(state, sample, "player");
          if (result.ok) accepted += 1;
          const after = result.ok ? result.state : state;
          expect(ledgerProblems(state, after, (reason) => reason !== "opening")).toEqual([]);
          expect(`${type} ${String(after.lottery.paid)}`).toBe(`${type} ${String(state.lottery.paid)}`);
        }
      }
      expect(accepted).toBeGreaterThan(0);
    },
  );

  test.each(LIVES.map((life) => [life.name, life.state] as const))(
    "[R-PEOPLE-044] given %s, when every player command is sent by the stand-in, then only the interview's answer and the people's answer pass the engine; everything else is refused as not the stand-in's",
    (_name, state) => {
      expect([...STAND_IN_COMMANDS].sort()).toEqual(["interview/answer", "people/answer"]);
      const samples = playerSamples(state, worldFor(state));
      for (const [type, commands] of Object.entries(samples) as [PlayerCommand, Loose[]][]) {
        for (const sample of commands) {
          const result = send(state, sample, "stand-in");
          // The engine refuses every other command as not the stand-in's; the allowed two reach the kind, which judges them with the sender in hand.
          const allowed = (STAND_IN_COMMANDS as readonly string[]).includes(type);
          const refusedAsNotYours = !result.ok && result.code === "not-yours";
          expect(`${type}: ${refusedAsNotYours ? "not-yours" : "through"}`).toBe(`${type}: ${!allowed && !state.turn.ended ? "not-yours" : "through"}`);
        }
      }
    },
  );
});
