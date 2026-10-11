// Lotto (docs/rules/world.md R-WORLD-018): the next draw, the tickets held, the last result, from
// the lottery view. Buying stays at the kiosk in the street; the phone only tells. Offline the kiosk
// runs its own draw: the app says where the kiosk is, the month's tickets and the last draw's result
// from the results' lines.
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { Ticket } from "lucide-react";

import { useGame, useView } from "../../../authority/GameProvider";
import { FactChip } from "../../../shared/ui/FactChip";
import { formatMoney, formatNumber } from "../../../shared/words/format";
import { lottoMonth } from "../../../shared/words/lotto";
import { nameOf, say, sayCount, words } from "../../../shared/words/text";
import { Head } from "../act";
import { phoneWords } from "../phone.words";

/** The street kiosk's draw told in the month's results: one ticket or more, and whether one came in (R-LUCK-005). */
const KIOSK_DRAW: ReadonlySet<string> = new Set(["line.activity.lotto-won", "line.activity.lotto-lost"]);
const KIOSK_ACT = "activity.play-lotto";

/** The street the kiosk stands on: the place in the city that stages its act. */
export function kioskStreet(): string | null {
  const place = Object.values(content.place).find((entry) => entry.where === "home" && entry.stages.includes(KIOSK_ACT));
  return place === undefined ? null : nameOf(place.id);
}

/** The last draw's line in the last month's results, or null when that month held no ticket. */
export function kioskDrawLine(lines: readonly ReportLine[]): ReportLine | null {
  return lines.find((line) => KIOSK_DRAW.has(line.key)) ?? null;
}

/** What this month's tickets cost (R-LUCK-005): the month's lines, so the kiosk and the app agree. */
function ThisMonth() {
  const { tickets, spent } = lottoMonth(useGame((state) => state.monthLines));
  if (spent === null) return null;
  return (
    <div className="mt-3" data-lotto-month={tickets}>
      <FactChip icon={Ticket} label={phoneWords(tickets === 1 ? "phone.lotto.month.one" : "phone.lotto.month", { count: tickets })} note={phoneWords("phone.lotto.month-cost", { amount: formatMoney(spent.amount, spent.currency) })} id="lotto-month" />
    </div>
  );
}

/** Offline: where the tickets are sold, this month's tickets, and the last draw's result when the last month had one. */
function KioskLotto() {
  const { report } = useView();
  const monthLines = useGame((state) => state.monthLines);
  const street = kioskStreet();
  const bought = lottoMonth(monthLines).spent !== null;
  const last = kioskDrawLine(report?.lines ?? []);
  return (
    <div data-phone-app="lotto" data-lotto-kiosk>
      <div className="flex items-start gap-2.5">
        <Ticket size={18} className="mt-0.5 shrink-0 text-text-2" aria-hidden />
        <div>
          {street === null ? null : <p className="text-[14px] font-bold" data-lotto-street>{phoneWords("phone.lotto.kiosk", { street })}</p>}
          {bought ? null : <p className="text-[13px] text-text-2" data-lotto-none>{phoneWords("phone.lotto.none-month")}</p>}
        </div>
      </div>
      <ThisMonth />
      {last === null ? null : (
        <div data-last-draw-line={last.key}>
          <Head>{say("ui.lottery.last")}</Head>
          <p className="text-[14px]">{words(last.key, last.params)}</p>
        </div>
      )}
    </div>
  );
}

export function Lotto() {
  const { lottery } = useView();
  if (lottery === null) return <KioskLotto />;
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
      <ThisMonth />

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
