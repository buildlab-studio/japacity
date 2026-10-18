// The price and the balance on a priced act (world:one-action-one-sheet; decision 0013): the button says the act and
// its price, and under it the balance before stands struck through beside the balance after, as a price tag shows a
// discount. Nothing moves until the tap. When the money is short, the button says how much instead, the one exception.
import type { CSSProperties } from "react";

import { say } from "../words/text";

/** A priced act's button with no second line: the act and its price in the middle (the main button's own style spreads its two lines). */
export const CENTRED: CSSProperties = { justifyContent: "center" };

/** The button's words for a priced act: "Indomie and egg · ₦1,500". */
export function pricedLabel(act: string, price: string): string {
  return say("ui.act.priced", { act, price });
}

export interface BalanceProps {
  /** The money held before the act, in the smallest unit, and its words. */
  before: { amount: number; words: string };
  /** The money held after it. */
  after: { amount: number; words: string };
  className?: string;
}

/** The balance before, struck, then the balance after (world:one-action-one-sheet). */
export function Balance({ before, after, className = "" }: BalanceProps) {
  return (
    <p className={`flex items-baseline gap-2 text-[15px] leading-none ${className}`} aria-label={say("ui.act.balance", { before: before.words, after: after.words })} data-balance>
      <s className="num text-text-2 decoration-[1.5px]" data-balance-before={before.amount}>
        {before.words}
      </s>
      <span className="num font-bold" data-balance-after={after.amount}>
        {after.words}
      </span>
    </p>
  );
}
