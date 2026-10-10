import type { Currency, Lot, MoneyParam, Pocket, QueuedConversion, Reason } from "../engine/types";

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
  | { type: "wallet/allowance-reset"; month: number }
  /** Cash paid into the bank this month, in kobo at the official rate, now `kobo` in all (R-WALLET-011). */
  | { type: "wallet/cash-paid-in"; month: number; kobo: number }
  /**
   * Money sent home (R-ABROAD-006). Its debits and credits are their own events.
   * `naira` is what arrives, or will arrive with a bank transfer; `lost` is an informal one that never came.
   */
  | { type: "wallet/remitted"; channel: RemitChannel; sent: MoneyParam; fee: number; naira: number; lost: boolean; readyMonth: number }
  /** The month closed with this net in the money of the place where it ended; above zero is a month kept (decision 0021). */
  | { type: "wallet/month-closed"; currency: Currency; net: number };

/** The ways money goes home (R-ABROAD-006). */
export type RemitChannel = "app" | "bank" | "informal";
