// Bills (docs/rules/world.md R-WORLD-018, 019): the bill notices, each with what is due this month.
// A bill that can be paid now (a loan, held funds, a car behind, what a sponsor owes) opens its
// own paper slip; the rest are taken at the month's end. The engine still decides (R-OBLIGATION-008).
import { content } from "@japacity/content";
import type { Currency, PlayerView } from "@japacity/sim";

import { useView } from "../../../authority/GameProvider";
import { formatMoney } from "../../../shared/words/format";
import { clockWords } from "../../../shared/words/quality";
import { hasWords, inMonths, nameOf, say, sayCount } from "../../../shared/words/text";
import { Head, useAsk, type AskSpec } from "../act";
import { phoneWords } from "../phone.words";
import { GhostButton, MoneyChip, PicCard, WordChip } from "../ui";
import { CarFacts, UndertakingFacts } from "./BillFacts";
import { HomeCard } from "./Home";

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

/**
 * When a bill taken every few months comes next, said as months away (R-WORLD-002), in a month none is
 * taken: "Next instalment in 2 months." Null for a bill due now,
 * one behind, or one taken every month.
 */
function nextTaken(owed: Owed, month: number): string | null {
  const ahead = nextTakenAhead(owed, month);
  if (ahead === null) return null;
  const own = `ui.obligation.next.${owed.entry}`;
  return say(hasWords(own) ? own : "ui.obligation.next", { when: inMonths(month + ahead, month + 1) });
}

/** How many months on from the month in hand a bill taken every few months comes next, or null as `nextTaken` says none. */
export function nextTakenAhead(owed: Owed, month: number): number | null {
  const entry = content.obligation[owed.entry];
  const every = entry?.everyMonths;
  // A rent owes nothing between its years, so it is said whatever is outstanding.
  if (every === undefined || every <= 1 || owed.due > 0 || owed.missed > 0 || (owed.outstanding <= 0 && entry?.type !== "rent")) return null;
  // R-OBLIGATION-015: a period paid when it opened is first taken a whole period after the opening month.
  const first = entry?.prepaid === true ? every : 1;
  // The view's "this month" is the month after the one in hand, as `due` reads it.
  for (let ahead = 1; ahead <= every + 1; ahead += 1) {
    const age = month + ahead - owed.openedMonth - first;
    if (age >= 0 && age % every === 0) return ahead;
  }
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

/**
 * R-HOME-012 (decision 0035): the naira living at home is bought as you go and charged nothing as the month turns, so
 * its notice would say a bill is taken at the month's end when none is. The home card above says how it is lived.
 */
function livedByHand(owed: Owed): boolean {
  const entry = content.obligation[owed.entry];
  return entry?.type === "upkeep" && entry.currency === "NGN" && owed.due === 0 && owed.missed === 0 && owed.outstanding <= 0;
}

export function Bills() {
  const view = useView();
  const { open, sheet } = useAsk();
  // What is due this month first, then what is only owed.
  const owed = view.obligations.filter((bill) => !livedByHand(bill)).sort((a, b) => Number(b.due > 0) - Number(a.due > 0));
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
    // The game's own time, as the band's clock says it, never the real calendar.
    reference: clockWords(view.qualities).toUpperCase(),
  });
  return (
    <div data-phone-app="bills">
      {/* R-HOME-007: where the character lives and what it costs, above the bills it brings. */}
      <HomeCard />
      {owed.length === 0 ? (
        <p className="px-0.5 text-[15px] text-text-2">{say("ui.obligation.none")}</p>
      ) : (
        <>
          <Head>{phoneWords("phone.bills.title")}</Head>
          <ul className="flex flex-col gap-2.5">
            {owed.map((bill) => {
              const currency: Currency = content.obligation[bill.entry]?.currency ?? "NGN";
              const pay = view.ended ? null : payNow(bill);
              const kind = content.obligation[bill.entry]?.type;
              return (
                <li key={bill.id} data-bill={bill.id} data-due={bill.due > 0 ? "true" : "false"}>
                  <PicCard
                    pic="phone.bill"
                    tint={bill.missed > 0 ? "food" : "plain"}
                    title={bill.due > 0 ? noticeWords(bill, currency) : nameOf(bill.entry)}
                    line={pay === null ? (nextTaken(bill, view.month) ?? phoneWords("phone.bills.auto")) : null}
                    chips={
                      bill.outstanding <= 0 && bill.missed <= 0 && bill.state === "active" ? null : (
                        <>
                          {bill.outstanding > 0 ? <MoneyChip out className="num">{say("ui.obligation.outstanding", { amount: formatMoney(bill.outstanding, currency) })}</MoneyChip> : null}
                          {/* A loan's months left (R-OBLIGATION-003's counts); a car and a promise say theirs below. */}
                          {bill.monthsLeft === null || bill.outstanding <= 0 || kind === "car" || kind === "undertaking" ? null : <WordChip tone="plain">{sayCount("ui.obligation.months-left", bill.monthsLeft, { months: bill.monthsLeft })}</WordChip>}
                          {bill.missed > 0 ? <WordChip tone="bad">{sayCount("ui.obligation.missed", bill.missed, { count: bill.missed })}</WordChip> : null}
                          {bill.state === "active" ? null : <WordChip tone="bad">{say(`ui.obligation.state.${bill.state}`)}</WordChip>}
                        </>
                      )
                    }
                    foot={
                      pay === null && kind !== "car" && kind !== "undertaking" ? null : (
                        <div className="flex flex-col gap-2.5">
                          {/* R-CAR-007, R-UNDERTAKING-012: a car and a sponsor's promise carry their own figures. */}
                          {kind === "car" ? <CarFacts owed={bill} /> : kind === "undertaking" ? <UndertakingFacts owed={bill} /> : null}
                          {pay === null ? null : (
                            <GhostButton wide onClick={() => open(slip(bill, currency, pay))} className="justify-center" data-pay={bill.id}>
                              {phoneWords("phone.bills.pay")}: {formatMoney(pay.amount, currency)}
                            </GhostButton>
                          )}
                        </div>
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
      {sheet}
    </div>
  );
}
