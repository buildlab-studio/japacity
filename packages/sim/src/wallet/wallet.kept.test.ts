// The months kept (decision 0021, world.md R-WORLD-008): as each month closes, the wallet counts it as kept
// when its net in the money of the place was above zero, from the same ledger the results sheet reads.
// Read on the recorded lives and on months played from them.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Accepted, BaseEvent, Currency, FlatSave, State } from "../engine/types";
import { lifeSaves } from "../goldens/lives.data";
import { newLifeSaves } from "../sweep/lives.data";
import type { Game } from "../testing/play";
import { finishPrologue, start } from "../testing/play";
import type { WalletEvent } from "./wallet.events";

type Closed = Extract<WalletEvent, { type: "wallet/month-closed" }>;

const SAVES: Record<string, FlatSave> = { ...lifeSaves, ...newLifeSaves };

function closedOf(result: Accepted): Closed | undefined {
  return result.events.find((event): event is BaseEvent & Closed => event.type === "wallet/month-closed");
}

/** The money of the place, as the results sheet reads it: naira at home and on the road, the country's own abroad. */
function local(state: State): Currency {
  const country = state.place.country;
  if (state.place.where !== "abroad" || country === null) return "NGN";
  return content.country[country]?.currency ?? "NGN";
}

/** A recorded life replayed into a game handle, the first `commands` of it, or all. */
function replay(name: string, commands?: number): Game {
  const save = SAVES[name];
  if (save === undefined) throw new Error(`No recorded life ${name}.`);
  const game = start({ content, scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed });
  for (const { command, tick, sender } of save.commands.slice(0, commands)) {
    game.tick = tick;
    game.accept(command, sender);
  }
  return game;
}

/** The commands of a recorded life up to and including its nth `turn/end`. */
/** The months a recorded life plays. */
function monthsOf(name: string): number {
  return (SAVES[name]?.commands ?? []).filter((entry) => entry.command.type === "turn/end").length;
}

function upToMonth(name: string, month: number): number {
  const commands = SAVES[name]?.commands ?? [];
  let seen = 0;
  const at = commands.findIndex((entry) => entry.command.type === "turn/end" && ++seen === month);
  if (at === -1) throw new Error(`${name} has no month ${String(month)}.`);
  return at + 1;
}

/** The net of a step's own money in one currency, moves between pockets and held funds aside. */
function netOf(events: readonly BaseEvent[], currency: Currency): number {
  let net = 0;
  for (const event of events as readonly WalletEvent[]) {
    if (event.type !== "wallet/credited" && event.type !== "wallet/debited") continue;
    if (event.currency !== currency || event.reason === "move" || event.reason === "held-funds" || event.reason === "held-funds-return") continue;
    net += event.type === "wallet/credited" ? event.amount : -event.amount;
  }
  return net;
}

describe("the months kept", () => {
  test("[R-WALLET-015] [R-WORLD-008] given each recorded life, when each month closes, then its net is the month's ledger in the money of the place where it ended, and the count is the months whose net was above zero", () => {
    for (const [name, save] of Object.entries(SAVES)) {
      const game = start({ content, scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed });
      const month: BaseEvent[] = [];
      const told: (Closed | null)[] = [];
      const ledger: (Closed | null)[] = [];
      const leftOpen: number[] = [];
      for (const { command, tick, sender } of save.commands) {
        game.tick = tick;
        const result = game.accept(command, sender);
        month.push(...result.events);
        if (command.type !== "turn/end") continue;
        const currency = local(game.state);
        const net = netOf(month, currency);
        const moved = month.some((event) => (event.type === "wallet/credited" || event.type === "wallet/debited") && !["move", "held-funds", "held-funds-return"].includes((event as WalletEvent & { reason: string }).reason));
        told.push(closedOf(result) ?? null);
        ledger.push(moved ? { type: "wallet/month-closed", currency, net } : null);
        if ("monthNet" in game.state.wallet) leftOpen.push(game.state.turn.month);
        month.length = 0;
      }
      expect({ name, told }).toEqual({ name, told: ledger });
      expect({ name, leftOpen }).toEqual({ name, leftOpen: [] });
      const kept = ledger.filter((closed) => closed !== null && closed.net > 0).length;
      expect(kept).toBeGreaterThan(0);
      expect({ name, view: game.view().keptMonths, slice: game.state.wallet.keptMonths }).toEqual({ name, view: kept, slice: kept });
    }
  });

  test("[R-WORLD-008] given a new life, when months close before the first kept one, then the slice carries no count and no month's net at a month's end, and the view's count is nothing", () => {
    const game = start({ content, scenario: "scenario.ada", seed: "kept-1", worldSeed: "golden-world" });
    expect(game.view().keptMonths).toBe(0);
    expect(game.state.wallet).not.toHaveProperty("keptMonths");
    expect(game.state.wallet).not.toHaveProperty("monthNet");
    // Resting months at home: the living costs go out and nothing comes in.
    for (let month = 0; month < 3; month += 1) {
      const closed = closedOf(game.endTurn());
      expect(closed?.net).toBeLessThan(0);
      expect(game.state.wallet).not.toHaveProperty("keptMonths");
      expect(game.state.wallet).not.toHaveProperty("monthNet");
    }
    expect(game.view().keptMonths).toBe(0);
  });

  test("[R-WORLD-008] given a month in hand, when money moves before the month ends, then it is held as the month's net and not counted until the month closes", () => {
    // Zainab's remote dollars changed into naira: money in, in the money of the place, before the month ends.
    // A month late in her life at home, before the flight, whichever month the cut flies in.
    const game = replay("zainab-remote", upToMonth("zainab-remote", Math.min(30, monthsOf("zainab-remote") - 2)));
    const before = game.view().keptMonths;
    game.accept({ type: "wallet/convert", from: "USD", to: "NGN", amount: game.state.wallet.pockets.USD.bank, via: "bank" });
    expect(game.state.wallet.monthNet?.NGN ?? 0).toBeGreaterThan(0);
    expect(game.view().keptMonths).toBe(before);
    const closed = closedOf(game.endTurn());
    expect(closed?.currency).toBe("NGN");
    expect(game.view().keptMonths).toBe(before + ((closed?.net ?? 0) > 0 ? 1 : 0));
    expect(game.state.wallet).not.toHaveProperty("monthNet");
  });

  test("[R-WALLET-003] given a month in hand, when the only money moved is a move between pockets, then the month's net does not move, and the month closes as it would have without it", () => {
    const at = upToMonth("ada-careful", 10);
    const plain = replay("ada-careful", at);
    const moved = replay("ada-careful", at);
    const bank = moved.state.wallet.pockets.NGN.bank;
    expect(bank).toBeGreaterThan(0);
    moved.accept({ type: "wallet/move", currency: "NGN", amount: bank, to: "cash" });
    expect(moved.state.wallet).not.toHaveProperty("monthNet");
    expect(closedOf(moved.endTurn())).toEqual(closedOf(plain.endTurn()));
    expect(moved.view().keptMonths).toBe(plain.view().keptMonths);
  });

  test("[R-WALLET-004] given a month in hand, when naira is changed into pounds at the bank, then the side paid in and the charge are money out of the naira, never money kept", () => {
    const game = replay("ada-careful", upToMonth("ada-careful", 10));
    expect(game.state.wallet).not.toHaveProperty("monthNet");
    const amount = 100_000_00;
    const result = game.accept({ type: "wallet/convert", from: "NGN", to: "GBP", amount, via: "bank" });
    expect(game.state.wallet.monthNet?.NGN).toBe(-amount);
    expect(game.state.wallet.monthNet?.GBP).toBe(netOf(result.events, "GBP"));
    expect(game.state.wallet.monthNet?.GBP).toBeGreaterThan(0);
  });

  test("[R-ABROAD-006] given a month in hand abroad, when money is sent home, then the pounds that leave are money out of the money of the place, and the naira that land are not counted there", () => {
    const game = replay("ada-careful");
    expect(local(game.state)).toBe("GBP");
    game.endTurn();
    const pounds = 20_000;
    if (game.state.wallet.pockets.GBP.bank < pounds) game.accept({ type: "wallet/convert", from: "USD", to: "GBP", amount: game.state.wallet.pockets.USD.bank, via: "bank" });
    const before = game.state.wallet.monthNet?.GBP ?? 0;
    game.accept({ type: "wallet/remit", currency: "GBP", amount: pounds, channel: "app" });
    expect((game.state.wallet.monthNet?.GBP ?? 0) - before).toBe(-pounds);
    const closed = closedOf(game.endTurn());
    expect(closed?.currency).toBe("GBP");
  });

  test("[R-WORLD-008] given a life with a prologue, when the prologue closes, then the money of its years is not the first month's", () => {
    const game = start({ content, scenario: "scenario.prologue", seed: "sixteen-0", worldSeed: "golden-world" });
    finishPrologue(game);
    // The years before the first month earned money, and none of it is the month in hand's.
    const earned = Object.entries(game.state.wallet.totals.in).filter(([reason]) => reason !== "opening");
    expect(earned.length).toBeGreaterThan(0);
    expect(game.state.wallet.monthNet ?? {}).toEqual({});
    const closed = closedOf(game.endTurn());
    expect(closed).toBeDefined();
  });

  test("[R-WORLD-008] given a recorded life that ends on its flight, when it is read, then the month of the flight, not ended, is not counted", () => {
    const game = replay("ada-careful");
    expect(game.state.wallet.monthNet).toBeDefined();
    const closed = replay("ada-careful", upToMonth("ada-careful", game.state.turn.month));
    expect(game.view().keptMonths).toBe(closed.view().keptMonths);
  });
});
