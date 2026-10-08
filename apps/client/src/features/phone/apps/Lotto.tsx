// Lotto (docs/rules/world.md R-WORLD-018): the next draw, the tickets held, the last result, from
// the lottery view. Buying stays at the kiosk in the street; the phone only tells.
import { Ticket } from "lucide-react";

import { useView } from "../../../authority/GameProvider";
import { formatMoney, formatNumber } from "../../../shared/words/format";
import { say, sayCount } from "../../../shared/words/text";
import { Head } from "../act";
import { phoneWords } from "../phone.words";

export function Lotto() {
  const { lottery } = useView();
  if (lottery === null) {
    return (
      <div data-phone-app="lotto">
        <p className="text-[14px] text-text-2">{phoneWords("phone.lotto.offline")}</p>
      </div>
    );
  }
  const mine = new Set(lottery.numbers ?? []);
  const last = lottery.last;
  // The tickets held are the last draw's while that draw is still the one on show.
  const heldInLast = last !== null && lottery.draw === last.draw && mine.size > 0;
  const won = last === null ? [] : last.winners.flatMap((tier) => tier.tickets).filter((ticket) => heldInLast && mine.has(ticket));
  return (
    <div data-phone-app="lotto">
      <div className="band rounded-[6px] px-4 py-3" data-next-draw={lottery.draw}>
        <div className="label label-strong">{phoneWords("phone.lotto.next")}</div>
        <div className="title text-[15px]">{say("ui.lottery.draw", { draw: lottery.draw })}</div>
        <div className="label label-strong mt-2">{say("ui.lottery.jackpot")}</div>
        <div className="num text-[30px] leading-tight">{formatMoney(lottery.jackpot, "NGN")}</div>
      </div>

      <div className="mt-3 flex items-start gap-2.5" data-held={lottery.tickets}>
        <Ticket size={18} className="mt-0.5 shrink-0 text-text-2" aria-hidden />
        <div>
          <p className="text-[14px] font-bold">{sayCount("ui.lottery.held", lottery.tickets, { count: lottery.tickets })}</p>
          {lottery.numbers === null || lottery.numbers.length === 0 ? null : (
            <p className="num text-[14px]">{say("ui.lottery.numbers", { numbers: lottery.numbers.map((number) => formatNumber(number)).join(", ") })}</p>
          )}
          <p className="text-[13px] text-text-2">{phoneWords("phone.lotto.buy-where")}</p>
        </div>
      </div>

      {last === null ? null : (
        <div data-last-draw={last.draw}>
          <Head>{say("ui.lottery.last")}</Head>
          <p className="text-[14px]">{say("ui.lottery.last-line", { draw: last.draw, count: formatNumber(last.count) })}</p>
          <p className="mt-1 text-[14px] font-bold">{heldInLast ? (won.length > 0 ? phoneWords("phone.lotto.won", { number: won.map((ticket) => formatNumber(ticket)).join(", ") }) : phoneWords("phone.lotto.lost")) : phoneWords("phone.lotto.none-held")}</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {last.winners.map((tier) => (
              <li key={tier.tier} data-tier={tier.tier} className="rounded-[6px] border border-sheet-line bg-sheet-2 px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-bold">{say(`ui.lottery.tier.${tier.tier}`)}</span>
                  {tier.tickets.length === 0 ? null : <span className="num text-[14px]">{formatMoney(tier.amount, "NGN")}</span>}
                </div>
                {tier.tickets.length === 0 ? null : (
                  <div className="mt-1 flex flex-wrap gap-1" aria-label={phoneWords("phone.lotto.winners")}>
                    {tier.tickets.map((ticket) => (
                      <span key={ticket} className={`num rounded-[4px] px-1.5 py-0.5 text-[12px] ${heldInLast && mine.has(ticket) ? "bg-signal text-action-text" : "bg-sheet-muted"}`} data-matched={heldInLast && mine.has(ticket) ? "true" : undefined}>
                        {formatNumber(ticket)}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
