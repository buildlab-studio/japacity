import type { Currency, Pocket, Reason } from "../engine/types";

/** Placeholder: the wallet work defines the real events. */
export type WalletEvent =
  | { type: "wallet/credited"; currency: Currency; pocket: Pocket | "locked"; amount: number; reason: Reason }
  | { type: "wallet/debited"; currency: Currency; pocket: Pocket | "locked"; amount: number; reason: Reason };
