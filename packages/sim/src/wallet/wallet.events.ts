import type { Currency, Id, Lot, MoneyParam, Pocket, QueuedConversion, Reason } from "../engine/types";

/** Where money sits: the two spendable pockets, and the locked one (wallet:locked-money-stays-put). */
export type AnyPocket = Pocket | "locked";

export type WalletEvent =
  /** Money came into a pocket (wallet:ledger-balances-each-currency). */
  | { type: "wallet/credited"; currency: Currency; pocket: AnyPocket; amount: number; reason: Reason }
  /** Money left a pocket (wallet:ledger-balances-each-currency). */
  | { type: "wallet/debited"; currency: Currency; pocket: AnyPocket; amount: number; reason: Reason }
  /** A bank purchase was queued. Its money was already debited (wallet:bank-queue-delays-purchases). */
  | { type: "wallet/queued"; conversion: QueuedConversion }
  /** A queued purchase arrived. Its money is credited by its own event. */
  | { type: "wallet/arrived"; id: string }
  /** A deposit a visa officer would question (wallet:large-deposits-record-lots). */
  | { type: "wallet/lot-recorded"; lot: Lot }
  /** Lots from before `keepFrom` were forgotten (wallet:large-deposits-record-lots). */
  | { type: "wallet/lots-dropped"; keepFrom: number; count: number }
  /** route-gates:family-gift-counts-with-deed: one lot whose source a paper now explains, dropped before its months are up. */
  | { type: "wallet/lot-dropped"; lot: Lot }
  /** A bank purchase used this much of the month's allowance, in US cents (wallet:monthly-fx-allowance). */
  | { type: "wallet/bought"; month: number; cents: number }
  /** A new month: the allowance is whole again (wallet:monthly-fx-allowance). */
  | { type: "wallet/allowance-reset"; month: number }
  /** Cash paid into the bank this month, in kobo at the official rate, now `kobo` in all (wallet:large-deposits-record-lots). */
  | { type: "wallet/cash-paid-in"; month: number; kobo: number }
  /**
   * Money sent home (abroad-money:remit-sends-money-home). Its debits and credits are their own events.
   * `naira` is what arrives, or will arrive with a bank transfer; `lost` is an informal one that never came.
   */
  | { type: "wallet/remitted"; channel: RemitChannel; sent: MoneyParam; fee: number; naira: number; lost: boolean; readyMonth: number }
  /** The month closed with this net in the money of the place where it ended; above zero is a month kept (decision 0024). */
  | { type: "wallet/month-closed"; currency: Currency; net: number }
  /** A month closed with more naira cash on the character than the warning line, the first time in the life (wallet:cash-pile-warning). */
  | { type: "wallet/cash-warned" }
  /** The passbook: a month closed at home keeping this much for the road, in kobo at the official rate, the road's own fees aside. */
  | { type: "wallet/paced"; kept: number }
  /** The passbook: a stamp reached, once, at a month's close; `target` is the road's own figure, on the plan's `route`. */
  | { type: "wallet/stamped"; at: number; month: number; target: boolean; route: Id<"route"> | null };

/** The ways money goes home (abroad-money:remit-sends-money-home). */
export type RemitChannel = "app" | "bank" | "informal";
