// Money: docs/rules/wallet.md. Stub: the opening balances are real and are
// recorded as credits with the reason `opening` (R-SCENARIO-002), so the
// ledger identity of R-WALLET-002 holds from the first state.
import type { RegisteredKind } from "../engine/kind";
import { effectsNotBuilt, requirementsNotBuilt } from "../engine/stub";
import type { Currency, PocketBalance, WalletSlice } from "../engine/types";
import type { WalletEvent } from "./wallet.events";

const CURRENCIES: readonly Currency[] = ["NGN", "GBP", "USD"];

export const walletKind: RegisteredKind<WalletSlice, WalletEvent> = {
  kind: "wallet",
  initial(scenario) {
    const pockets = {} as Record<Currency, PocketBalance>;
    const opening: Partial<Record<Currency, number>> = {};
    for (const currency of CURRENCIES) {
      const given = scenario.pockets[currency] ?? { bank: 0, cash: 0 };
      pockets[currency] = { bank: given.bank, cash: given.cash, locked: 0 };
      if (given.bank + given.cash > 0) opening[currency] = given.bank + given.cash;
    }
    return {
      pockets,
      queued: [],
      lots: [],
      totals: { in: Object.keys(opening).length > 0 ? { opening } : {}, out: {} },
      bought: { month: 0, cents: 0 },
    };
  },
  effects: effectsNotBuilt(["money/add", "money/take", "money/pay-fee"]),
  evolve: (slice) => slice,
  requirements: requirementsNotBuilt(["money/min", "money/can-pay"]),
  invariants(state) {
    const problems: string[] = [];
    for (const currency of CURRENCIES) {
      const pocket = state.wallet.pockets[currency];
      for (const [name, value] of Object.entries(pocket)) {
        if (!Number.isSafeInteger(value) || value < 0) problems.push(`${currency} ${name} is ${String(value)} (R-WALLET-001).`);
      }
    }
    return problems;
  },
  view: ({ state, world }) => ({
    pockets: state.wallet.pockets,
    queued: state.wallet.queued,
    rates: world.rates,
    bankAllowanceLeft: 0,
  }),
};
