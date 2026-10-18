// The last draw's result under the kiosk (lottery:view-shows-draw-state, lottery:screen-states-odds-plainly): the
// tickets sold, whether the jackpot was hit or rolled over, and how many
// tickets won each prize. Tickets are numbers, never names.
import type { LotteryResult } from "@japacity/sim";

import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Panel";
import { formatMoney, formatNumber } from "../../shared/words/format";
import { say, sayCount } from "../../shared/words/text";
import { resultCounts } from "./draw";

export function Tiers({ result, showTickets = false }: { result: LotteryResult; showTickets?: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {result.winners.map((tier) => (
        <li key={tier.tier} className="flex flex-col gap-0.5" data-tier={tier.tier}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium">{say(`ui.lottery.tier.${tier.tier}`)}</span>
            {tier.tickets.length === 0 ? null : <span className="font-semibold tabular-nums">{formatMoney(tier.amount, "NGN")}</span>}
          </div>
          <span className="text-sm text-text-2">{sayCount("ui.lottery.tier-line", tier.tickets.length, { tickets: tier.tickets.length, amount: formatMoney(tier.amount, "NGN") })}</span>
          {showTickets && tier.tickets.length > 0 ? (
            <span className="text-xs text-text-2 tabular-nums">{say("ui.lottery.tier-tickets", { numbers: tier.tickets.map((ticket) => formatNumber(ticket)).join(", ") })}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function LastDraw({ result, onCheck }: { result: LotteryResult; onCheck: (() => void) | null }) {
  return (
    <Card className="flex flex-col gap-3" data-lottery-last={result.draw}>
      <p className="text-xs font-semibold tracking-widest text-text-2 uppercase">{say("ui.lottery.last")}</p>
      <p className="text-sm">{say("ui.lottery.last-line", { draw: result.draw, count: formatNumber(result.count) })}</p>
      <p className="text-sm font-medium" data-lottery-last-hit={resultCounts(result).hit}>
        {resultCounts(result).hit
          ? say("ui.lottery.last-hit", { jackpot: formatMoney(result.jackpot, "NGN") })
          : say("ui.lottery.last-missed", { jackpot: formatMoney(result.jackpot, "NGN"), next: formatMoney(result.nextJackpot, "NGN") })}
      </p>
      <Tiers result={result} />
      {onCheck === null ? null : (
        <div>
          <Button small onClick={onCheck}>
            {say("ui.lottery.check", { draw: result.draw })}
          </Button>
        </div>
      )}
    </Card>
  );
}
