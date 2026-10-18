// The odds of a draw as plain chances (lottery:screen-states-odds-plainly),
// for the kiosk and the draw page.
import type { LotteryOdds } from "@japacity/sim";

import { formatMoney, formatNumber } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { chancesOf } from "./draw";

/** The chances, the jackpot first and at the amount it stands at. */
export function Chances({ odds, jackpot }: { odds: LotteryOdds; jackpot: number }) {
  return (
    <ul className="flex flex-col gap-1 text-sm" data-lottery-odds>
      {chancesOf(odds, jackpot).map((chance) => (
        <li key={chance.tier} className="tabular-nums" data-chance={chance.tier}>
          {say(`ui.lottery.chance.${chance.tier}${chance.exact ? "" : "-about"}`, { every: formatNumber(chance.every), amount: formatMoney(chance.amount, "NGN") })}
        </li>
      ))}
    </ul>
  );
}
