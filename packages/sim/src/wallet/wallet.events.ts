import type { Currency, Lot, Pocket, QueuedConversion, Reason } from "../engine/types";

/** Where money sits: the two spendable pockets, and the locked one (R-WALLET-010). */
export type AnyPocket = Pocket | "locked";

export type WalletEvent =
  /** Money came into a pocket (R-WALLET-002). */
  | { type: "wallet/credited"; currency: Currency; pocket: AnyPocket; amount: number; reason: Reason }
  /** Money left a pocket (R-WALLET-002). */
  | { type: "wallet/debited"; currency: Currency; pocket: AnyPocket; amount: number; reason: Reason }
  /** A bank purchase was queued. Its money was already debited (R-WALLET-006). */
  | { type: "wallet/queued"; conversion: QueuedConversion }
  /** A queued purchase arrived. Its money is credited by its own event. */
  | { type: "wallet/arrived"; id: string }
  /** A deposit a visa officer would question (R-WALLET-011). */
  | { type: "wallet/lot-recorded"; lot: Lot }
  /** Lots from before `keepFrom` were forgotten (R-WALLET-011). */
  | { type: "wallet/lots-dropped"; keepFrom: number; count: number }
  /** A bank purchase used this much of the month's allowance, in US cents (R-WALLET-005). */
  | { type: "wallet/bought"; month: number; cents: number }
  /** A new month: the allowance is whole again (R-WALLET-005). */
  | { type: "wallet/allowance-reset"; month: number };
