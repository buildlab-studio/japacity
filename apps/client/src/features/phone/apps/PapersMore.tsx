// What the box under the bed holds beyond the papers (status:view-shows-status, status:renewing-a-status; place.md
// place:view-shows-place-and-returns; return:return-record-in-words): the status held abroad with the work it allows, the months left, the lawful months
// toward settling, the way up and the renewal; where the life is, the months there, the fare home with what it takes and
// the times it came home, newest first; and the person as content names them. In the phone's cards and chips. The way
// home itself is the bag's Go home in the room abroad (features/city/acts/goHome.ts): here the fare is only read.
import { content } from "@japacity/content";
import { int, type PlayerView } from "@japacity/sim";
import { useState } from "react";

import { useGame, useView } from "../../../authority/GameProvider";
import { Meter } from "../../../shared/ui/Meter";
import { actOnCard } from "../../../shared/words/acts";
import { shortfall } from "../../../shared/words/cost";
import { formatMoney } from "../../../shared/words/format";
import { keptAtHome } from "../../../shared/words/kept";
import { type OverstayWords, overstayWords } from "../../../shared/words/overstay";
import { AGE, valueWords } from "../../../shared/words/quality";
import { blurbOf, hasWords, monthsAgo, nameOf, say, sayCount, words } from "../../../shared/words/text";
import { Head, Refused } from "../act";
import { PicCard, WordChip } from "../ui";

type Held = NonNullable<PlayerView["status"]>;

function Renew({ held }: { held: Held }) {
  const view = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const [sure, setSure] = useState(false);
  const cost = held.renew;
  if (cost === null) return null;
  const needsJob = held.work === "one-employer" && view.job.id === null;
  const total = formatMoney(cost.fee + cost.surcharge, cost.currency);
  const gap = shortfall(view, [{ currency: cost.currency, amount: cost.fee + cost.surcharge }]);
  return (
    <div className="flex flex-col gap-2" data-renew>
      <p className="text-[15px] font-bold">{say("ui.status.renew-title", { months: cost.months })}</p>
      <p className="num text-[14px]">{say("ui.status.renew-fees", { fee: formatMoney(cost.fee, cost.currency), surcharge: formatMoney(cost.surcharge, cost.currency), total })}</p>
      {gap.foreign && gap.need > 0 ? <p className="text-[13px] text-text-2">{say("ui.status.renew-naira", { naira: formatMoney(gap.need, "NGN") })}</p> : null}
      {gap.short > 0 ? <p className="text-[13px] text-out">{say("ui.status.renew-short", { short: formatMoney(gap.short, "NGN") })}</p> : null}
      {needsJob ? <p className="text-[13px] text-out">{say("ui.status.renew-needs-job")}</p> : null}
      <Refused />
      {sure ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="press-button w-full"
            disabled={busy}
            onClick={() => {
              setSure(false);
              void send({ type: "status/renew" });
            }}
          >
            {say("ui.status.renew-yes", { total })}
          </button>
          <button type="button" className="phone-ghost w-full justify-center" onClick={() => setSure(false)}>
            {say("ui.place.go-no")}
          </button>
        </div>
      ) : (
        <button type="button" className="phone-ghost w-full justify-center" disabled={busy || view.ended || needsJob} onClick={() => setSure(true)}>
          {say("ui.status.renew")}
        </button>
      )}
    </div>
  );
}

const APPLY_GRADUATE = "activity.apply-graduate";

/**
 * status:graduate-visa-applied-for: from course month 9 the card says what the Graduate application costs, so the months to save show; once
 * it may be made, Apply asks once more with the sum and sends it at once.
 */
function Graduate({ held }: { held: Held }) {
  const view = useView();
  const send = useGame((state) => state.send);
  const addToPlan = useGame((state) => state.addToPlan);
  const busy = useGame((state) => state.busy);
  const [sure, setSure] = useState(false);
  const cost = held.graduate;
  if (cost === null) return null;
  const total = formatMoney(cost.fee + cost.surcharge, cost.currency);
  const open = view.activities.find((option) => option.id === APPLY_GRADUATE)?.allowed === true;
  const gap = shortfall(view, [{ currency: cost.currency, amount: cost.fee + cost.surcharge }]);
  return (
    <div className="flex flex-col gap-2" data-graduate>
      <p className="text-[15px] font-bold">{nameOf(APPLY_GRADUATE)}</p>
      <p className="num text-[14px]">{say("ui.status.graduate-fees", { fee: formatMoney(cost.fee, cost.currency), surcharge: formatMoney(cost.surcharge, cost.currency), total })}</p>
      {gap.short > 0 ? <p className="text-[13px] text-out">{say("ui.status.renew-short", { short: formatMoney(gap.short, "NGN") })}</p> : null}
      {!open ? (
        <p className="text-[13px] text-text-2">{say("ui.status.graduate-later")}</p>
      ) : sure ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="press-button w-full"
            disabled={busy}
            onClick={() => {
              setSure(false);
              void actOnCard({ activity: APPLY_GRADUATE, param: null }, { send, addToPlan });
            }}
            data-graduate-yes
          >
            {say("ui.status.graduate-yes", { total })}
          </button>
          <button type="button" className="phone-ghost w-full justify-center" onClick={() => setSure(false)}>
            {say("ui.place.go-no")}
          </button>
        </div>
      ) : (
        <button type="button" className="phone-ghost w-full justify-center" disabled={busy || view.ended} onClick={() => setSure(true)} data-graduate-apply>
          {say("ui.status.graduate-apply")}
        </button>
      )}
    </div>
  );
}

/** The overstay's stage on the status card (status:view-shows-status): its months, what it means, an application holding it and the fine owed. */
function OverstayStage({ said }: { said: OverstayWords }) {
  return (
    <div className="flex flex-col gap-1" data-overstay={said.stage}>
      <p className={`text-[15px] font-bold ${said.stage === "grace" ? "" : "text-out"}`}>{said.title}</p>
      <p className="text-[14px] leading-snug">{said.line}</p>
      {said.pending === null ? null : <p className="text-[14px] text-text-2">{said.pending}</p>}
      {said.fine === null ? null : <p className="num text-[14px] font-semibold text-out">{said.fine}</p>}
    </div>
  );
}

/** The status held abroad, or that none is held; nothing at home. */
export function PapersStatus() {
  const view = useView();
  const held = view.status;
  if (view.place.where !== "abroad") return null;
  if (held === null) {
    return (
      <section data-papers-status="none">
        <Head>{say("ui.status.title")}</Head>
        <PicCard pic="place.visa-centre" tint="food" title={say("ui.status.none")} />
      </section>
    );
  }
  const lawful = held.settleMonths === null ? null : say("ui.status.lawful", { months: held.lawfulMonths, need: held.settleMonths });
  // An overstay's stage stands where the end date and the way up would: it has neither, and its ways out are its own.
  const overstay = overstayWords(view);
  return (
    <section data-papers-status={held.entry}>
      <Head>{say("ui.status.title")}</Head>
      <PicCard
        pic="place.visa-centre"
        tint="money"
        title={nameOf(held.entry)}
        line={blurbOf(held.entry)}
        chips={
          <>
            {held.clock === null ? null : <WordChip tone="bad">{sayCount("ui.status.clock", held.clock, { months: held.clock })}</WordChip>}
            <WordChip tone={held.work === "none" || held.work === "cash" ? "bad" : "study"}>{say(`ui.status.work.${held.work}`)}</WordChip>
            {overstay === null ? (
              <WordChip tone={held.monthsLeft !== null && held.monthsLeft <= 3 ? "bad" : "plain"}>
                {held.monthsLeft === null ? say("ui.status.no-end") : sayCount("ui.status.months-left", held.monthsLeft, { months: held.monthsLeft })}
              </WordChip>
            ) : null}
          </>
        }
        foot={
          <div className="flex flex-col gap-3">
            {overstay === null ? null : <OverstayStage said={overstay} />}
            {lawful === null ? (
              <p className="text-[14px] text-text-2">{say("ui.status.no-settle")}</p>
            ) : (
              <div className="flex flex-col gap-1" data-lawful>
                <p className="text-[14px] font-semibold">{lawful}</p>
                <Meter value={held.lawfulMonths} max={held.settleMonths ?? 0} label={lawful} tone="ink" />
              </div>
            )}
            {overstay !== null || held.nextStep === null || !hasWords(held.nextStep) ? null : (
              <p className="text-[14px]" data-way-up>
                <span className="font-semibold">{say("ui.status.next")} </span>
                {words(held.nextStep)}
              </p>
            )}
            <Renew held={held} />
            <Graduate held={held} />
          </div>
        }
      />
    </section>
  );
}

/** The fare home as the view gives it, December and where it comes from; the act itself is the bag's. */
function Fare({ view }: { view: PlayerView }) {
  const home = view.place.wayHome;
  if (home === null) return null;
  const { fare, offPeak, paidFrom, naira, shape } = home;
  const december = fare.amount > offPeak.amount;
  const entry = view.place.country === null ? undefined : content.country[view.place.country];
  return (
    <div className="flex flex-col gap-1 text-[14px]" data-papers-fare>
      <p className="num font-semibold">{say("ui.place.fare", { fare: formatMoney(fare.amount, fare.currency) })}</p>
      {december ? (
        <p>{say("ui.place.fare-december-now", { fare: formatMoney(offPeak.amount, offPeak.currency) })}</p>
      ) : entry === undefined ? null : (
        <p className="text-text-2">{say("ui.place.fare-december", { fare: formatMoney(int.bp(offPeak.amount, entry.decemberFactorBp), offPeak.currency) })}</p>
      )}
      {paidFrom === "naira" ? <p>{say("ui.place.fare-naira", { naira: formatMoney(naira, "NGN") })}</p> : null}
      {paidFrom === null && shape !== "assisted" ? <p className="text-out">{say("ui.place.fare-short", { fare: formatMoney(fare.amount, fare.currency), naira: formatMoney(naira, "NGN") })}</p> : null}
    </div>
  );
}

/** Where the life is and the times it came home; at home only when a return is on record or a status is kept abroad. */
export function PapersPlace() {
  const view = useView();
  const beganAt = useGame((state) => state.beganAt);
  const { where, country, monthsHere, heldAbroad, returns } = view.place;
  if (where === "home" && returns.length === 0 && heldAbroad === null) return null;
  // return:papers-return-keeps-status: the status kept from the return, the month it runs to and any line at home crossed.
  const kept = keptAtHome(view, beganAt);
  const here =
    where === "abroad" && country !== null ? (hasWords(`ui.place.in.${country}`) ? say(`ui.place.in.${country}`) : say("ui.place.in", { country: nameOf(country) })) : say(`ui.place.now.${where}`);
  return (
    <section data-papers-place={where}>
      <Head>{say("ui.place.title")}</Head>
      <PicCard
        pic={where === "abroad" ? "place.the-room" : "place.family-house"}
        tint="plain"
        title={here}
        line={sayCount("ui.place.months-here", monthsHere, { months: monthsHere })}
        foot={
          <div className="flex flex-col gap-2.5">
            {kept.map((said) => (
              <p key={said} className="text-[14px]" data-papers-kept>
                {said}
              </p>
            ))}
            <Fare view={view} />
            {returns.length === 0 ? null : (
              <div className="flex flex-col gap-1">
                <p className="text-[14px] font-semibold">{say("ui.place.returns")}</p>
                <ol className="flex flex-col gap-1 text-[14px]" aria-label={say("ui.place.returns")}>
                  {returns.map((back) => (
                    <li key={`${String(back.month)}-${back.country ?? "road"}`}>
                      {say("phone.papers.return", { when: monthsAgo(back.month, view.month), country: back.country === null ? say("ui.place.road-name") : nameOf(back.country), shape: say(`ui.place.shape.${back.shape}`) })}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        }
      />
    </section>
  );
}

/** Qualities that only start to count once you have left: at home, while at nothing, they wait folded. */
const LATER = new Set(["quality.credit-mark", "quality.care", "quality.family-stake", "quality.land"]);

function Quality({ id, value }: { id: string; value: number }) {
  const entry = content.quality[id as keyof typeof content.quality];
  const ranged = entry !== undefined && id !== AGE && !hasWords(`${id}.value.${String(value)}`);
  return (
    <div className="flex flex-col gap-1" data-quality={id}>
      <dt className="text-[13px] font-semibold text-text-2">{nameOf(id)}</dt>
      <dd className="text-[16px] font-bold">{valueWords(id, value)}</dd>
      {ranged ? <Meter value={value - entry.min} max={entry.max - entry.min} label={nameOf(id)} tone="ink" /> : null}
    </div>
  );
}

/** The person as content names them: every quality marked shown, the ones for later folded while they wait. */
export function PapersYou() {
  const view = useView();
  const shown = view.qualities.filter((quality) => content.quality[quality.id]?.shown === true);
  const atHome = view.place.where === "home";
  const waiting = (quality: { id: string; value: number }) => atHome && LATER.has(quality.id) && quality.value === 0;
  const now = shown.filter((quality) => !waiting(quality));
  const later = shown.filter(waiting);
  return (
    <section data-papers-you>
      <Head>{say("ui.profile.title")}</Head>
      <div className="look-card flex flex-col gap-3 p-3" data-look-card>
        <dl className="grid grid-cols-2 gap-3">
          {now.map(({ id, value }) => (
            <Quality key={id} id={id} value={value} />
          ))}
        </dl>
        {later.length === 0 ? null : (
          <details className="border-t border-sheet-line pt-3" data-later>
            <summary className="cursor-pointer text-[14px] font-semibold">{say("ui.profile.later")}</summary>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              {later.map(({ id, value }) => (
                <Quality key={id} id={id} value={value} />
              ))}
            </dl>
          </details>
        )}
      </div>
    </section>
  );
}
