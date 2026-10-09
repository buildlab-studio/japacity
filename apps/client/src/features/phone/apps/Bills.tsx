// Bills (docs/rules/world.md R-WORLD-018, 019): the bill notices, each with what is due this month.
// A bill that can be paid now (a loan, held funds, a car behind, what a sponsor owes) opens its
// own paper slip; the rest are taken at the month's end. The engine still decides (R-OBLIGATION-008).
import { content } from "@japacity/content";
import type { Currency, PlayerView } from "@japacity/sim";
import { Receipt } from "lucide-react";

import { useView } from "../../../authority/GameProvider";
import { formatMoney, todayWords } from "../../../shared/words/format";
import { hasWords, nameOf, say, sayCount } from "../../../shared/words/text";
import { useAsk, type AskSpec } from "../act";
import { phoneWords } from "../phone.words";

type Owed = PlayerView["obligations"][number];

/** What paying a bill now would send, and its words, or null when it is taken at the month's end. */
export function payNow(owed: Owed): { amount: number; line: string; button: string; locked: boolean } | null {
  const type = content.obligation[owed.entry]?.type;
  if (type === "loan" || type === "group-loan") {
    if (owed.outstanding <= 0) return null;
    const amount = owed.due > 0 ? Math.min(owed.due, owed.outstanding) : owed.outstanding;
    return { amount, line: phoneWords("phone.bills.loan.line"), button: phoneWords("phone.bills.loan.button"), locked: false };
  }
  if (type === "held-funds") return owed.outstanding > 0 ? { amount: owed.outstanding, line: phoneWords("phone.bills.held.line"), button: say("ui.obligation.return"), locked: true } : null;
  if (type === "car") return owed.missed > 0 && owed.due > 0 ? { amount: owed.due, line: phoneWords("phone.bills.car.line"), button: phoneWords("phone.bills.car.button"), locked: false } : null;
  if (type === "undertaking") return owed.outstanding > 0 ? { amount: owed.outstanding, line: phoneWords("phone.bills.undertaking.line"), button: phoneWords("phone.bills.undertaking.button"), locked: false } : null;
  return null;
}

// the story work writes the notice words; `<obligation id>.notice` with `{amount}` is
// the key read here until its shape is settled.
/** The notice as the phone shows it: the story's words for the bill when content has them. */
function noticeWords(owed: Owed, currency: Currency): string {
  const amount = formatMoney(owed.due, currency);
  const key = `${owed.entry}.notice`;
  return hasWords(key) ? say(key, { amount }) : phoneWords("phone.bills.notice", { name: nameOf(owed.entry), amount });
}

/**
 * What the slip counts the payment from, so "after" says the money the character keeps. Held funds
 * go back from the locked pocket and leave the naira in bank and cash untouched, so once the locked
 * pocket holds the sum, what is left after is that naira; short of it, the
 * locked pocket is what is short.
 */
function haveFor(pocket: PlayerView["pockets"][Currency], pay: NonNullable<ReturnType<typeof payNow>>): number {
  if (!pay.locked) return pocket.bank + pocket.cash;
  return pocket.locked >= pay.amount ? pocket.bank + pocket.cash + pay.amount : pocket.locked;
}

export function Bills() {
  const view = useView();
  const { open, sheet } = useAsk();
  // What is due this month first, then what is only owed.
  const owed = [...view.obligations].sort((a, b) => Number(b.due > 0) - Number(a.due > 0));
  const slip = (bill: Owed, currency: Currency, pay: NonNullable<ReturnType<typeof payNow>>): AskSpec => ({
    form: "slip",
    icon: "receipt",
    who: nameOf(bill.entry),
    title: phoneWords("phone.app.bills"),
    line: pay.line,
    cost: { amount: pay.amount, currency },
    button: pay.button,
    have: haveFor(view.pockets[currency], pay),
    command: { type: "obligation/pay", obligation: bill.id, amount: pay.amount },
    done: phoneWords("phone.bills.paid"),
    reference: todayWords().toUpperCase(),
  });
  return (
    <div data-phone-app="bills">
      {owed.length === 0 ? (
        <p className="text-[14px] text-text-2">{say("ui.obligation.none")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {owed.map((bill) => {
            const currency: Currency = content.obligation[bill.entry]?.currency ?? "NGN";
            const pay = view.ended ? null : payNow(bill);
            return (
              <li key={bill.id} data-bill={bill.id} data-due={bill.due > 0 ? "true" : "false"} className="rounded-[6px] p-3 shadow-[0_2px_0_var(--sheet-line)]" style={{ background: "var(--paper-bill)" }}>
                <div className="flex items-start gap-2.5">
                  <Receipt size={18} className="mt-0.5 shrink-0 text-text-2" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold">{bill.due > 0 ? noticeWords(bill, currency) : nameOf(bill.entry)}</p>
                    {bill.outstanding > 0 ? <p className="num text-[13px] text-text-2">{say("ui.obligation.outstanding", { amount: formatMoney(bill.outstanding, currency) })}</p> : null}
                    {bill.missed > 0 ? <p className="text-[13px] font-bold text-out">{sayCount("ui.obligation.missed", bill.missed, { count: bill.missed })}</p> : null}
                    {pay === null ? <p className="text-[13px] text-text-2">{phoneWords("phone.bills.auto")}</p> : null}
                  </div>
                  {bill.state === "active" ? null : <span className="label shrink-0 text-out">{say(`ui.obligation.state.${bill.state}`)}</span>}
                </div>
                {pay === null ? null : (
                  <button type="button" onClick={() => open(slip(bill, currency, pay))} className="btn-dark press mt-2 w-full py-2.5 text-[14px]" data-pay={bill.id}>
                    {phoneWords("phone.bills.pay")}: {formatMoney(pay.amount, currency)}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {sheet}
    </div>
  );
}
