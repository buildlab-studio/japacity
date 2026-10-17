// Lotto (docs/rules/world.md R-WORLD-018): the next draw, the tickets held, the last result, from
// the lottery view. Buying stays at the kiosk in the street; the phone only tells. Offline the kiosk
// runs its own draw: the app says where the kiosk is, the month's tickets and the last draw's result
// from the results' lines.
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { MapPin, Ticket } from "lucide-react";
import { use } from "react";

import { useGame, useView } from "../../../authority/GameProvider";
import { FactChip } from "../../../shared/ui/FactChip";
import { formatMoney, formatNumber } from "../../../shared/words/format";
import { lottoMonth } from "../../../shared/words/lotto";
import { nameOf, say, sayCount, words } from "../../../shared/words/text";
import { PhoneNav } from "../../../shared/phone/nav";
import { Head } from "../act";
import { phoneWords } from "../phone.words";
import { GhostButton, MoneyChip, PicCard, PicTile } from "../ui";

/** The street kiosk's draw told in the month's results: one ticket or more, and whether one came in (R-LUCK-005). */
const KIOSK_DRAW: ReadonlySet<string> = new Set(["line.activity.lotto-won", "line.activity.lotto-lost"]);
const KIOSK_ACT = "activity.play-lotto";

/** The place in the city that stages the kiosk's act, or null where none does. */
function kioskPlace(): string | null {
  return Object.values(content.place).find((entry) => entry.where === "home" && entry.stages.includes(KIOSK_ACT))?.id ?? null;
}

/** The street the kiosk stands on: the place in the city that stages its act. */
export function kioskStreet(): string | null {
  const place = kioskPlace();
  return place === null ? null : nameOf(place);
}

/** The way to the kiosk on the map, where the phone can open it (R-WORLD-019: a visit opens the map). */
function ToKiosk() {
  const nav = use(PhoneNav);
  const place = kioskPlace();
  if (place === null || nav.openMap === undefined) return null;
  return (
    <GhostButton wide className="mt-4 justify-center" onClick={() => nav.openMap?.(place)} data-lotto-go={place}>
      <MapPin size={18} aria-hidden />
      {phoneWords("phone.lotto.go")}
    </GhostButton>
  );
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
      {/* The kiosk: its picture, where it stands, this month's tickets; the last
          draw's result; and the way to the kiosk, since tickets are bought there and never on the phone. */}
      <div className="flex items-center gap-3 px-0.5">
        <PicTile of={KIOSK_ACT} size={64} tint="money" />
        <div className="min-w-0 flex-1">
          {street === null ? null : <p className="text-[17px] leading-snug font-bold" data-lotto-street>{phoneWords("phone.lotto.kiosk", { street })}</p>}
          {bought ? null : <p className="mt-0.5 text-[14px] text-text-2" data-lotto-none>{phoneWords("phone.lotto.none-month")}</p>}
        </div>
      </div>
      <ThisMonth />
      {last === null ? null : (
        <div data-last-draw-line={last.key}>
          <Head>{say("ui.lottery.last")}</Head>
          <p className="lively-card px-3.5 py-3 text-[15px]">{words(last.key, last.params)}</p>
        </div>
      )}
      <ToKiosk />
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
      <PicCard
        pic={KIOSK_ACT}
        tint="money"
        over={phoneWords("phone.lotto.next")}
        title={say("ui.lottery.draw", { draw: lottery.draw })}
        chips={
          <MoneyChip className="num text-[16px]">
            {say("ui.lottery.jackpot")}: {formatMoney(lottery.jackpot, "NGN")}
          </MoneyChip>
        }
        data-next-draw={lottery.draw}
      />

      <div className="lively-card mt-3 flex flex-col gap-2 p-3.5" data-held={lottery.tickets}>
        <p className="text-[16px] font-bold">{sayCount("ui.lottery.held", lottery.tickets, { count: lottery.tickets })}</p>
        {lottery.numbers === null || lottery.numbers.length === 0 ? null : (
          <div className="flex flex-wrap gap-2" aria-label={say("ui.lottery.numbers", { numbers: lottery.numbers.map((number) => formatNumber(number)).join(", ") })}>
            {lottery.numbers.map((number) => (
              <span key={number} className="phone-ball num flex size-11 items-center justify-center text-[16px] font-bold" aria-hidden>
                {formatNumber(number)}
              </span>
            ))}
          </div>
        )}
        <p className="text-[14px] text-text-2">{phoneWords("phone.lotto.buy-where")}</p>
      </div>
      <ThisMonth />

      {last === null ? null : (
        <div data-last-draw={last.draw}>
          <Head>{say("ui.lottery.last")}</Head>
          <p className="px-0.5 text-[15px]">{say("ui.lottery.last-line", { draw: last.draw, count: formatNumber(last.count) })}</p>
          <p className="mt-1 px-0.5 text-[15px] font-bold">{heldInLast ? (won.length > 0 ? phoneWords("phone.lotto.won", { number: won.map((ticket) => formatNumber(ticket)).join(", ") }) : phoneWords("phone.lotto.lost")) : phoneWords("phone.lotto.none-held")}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {last.winners.map((tier) => (
              <li key={tier.tier} data-tier={tier.tier} className="lively-card px-3.5 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-bold">{say(`ui.lottery.tier.${tier.tier}`)}</span>
                  {tier.tickets.length === 0 ? null : <MoneyChip className="num">{formatMoney(tier.amount, "NGN")}</MoneyChip>}
                </div>
                {tier.tickets.length === 0 ? null : (
                  <div className="mt-2 flex flex-wrap gap-1.5" aria-label={phoneWords("phone.lotto.winners")}>
                    {tier.tickets.map((ticket) => (
                      <span key={ticket} className={`phone-ball num flex size-10 items-center justify-center text-[14px] font-bold ${heldInLast && mine.has(ticket) ? "phone-ball-on" : ""}`} data-matched={heldInLast && mine.has(ticket) ? "true" : undefined}>
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
      <ToKiosk />
    </div>
  );
}
