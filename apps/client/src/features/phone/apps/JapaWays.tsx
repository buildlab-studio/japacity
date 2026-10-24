// Japa's files of the ways out (world:phone-holds-what-phones-hold; route-gates.md; route.md), in the lively dress: each way
// looked into as a card with its state and its window as chips, the gate's own part (the sponsor and the salary bar, the
// points against the cut-off, the endorsement and its wait, the agent and the job, the partner it rests on), the
// universities with what they ask and cost, the funds shown against what is needed, and the record (the deposit, the
// visa's months, the refusals in words). The deposit is paid at the bank's counter and the plane boarded at the airport's
// gate, in the world. Then the goals: the open ones with their steps, the done ones with when, as months ago. The road is never a
// way here (road:road-route-has-no-figure). Nothing hidden is in the view, so nothing hidden is shown; never a percentage on screen.
import { content } from "@japacity/content";
import type { Currency, Id, PlayerView, RouteGateView, RouteView } from "@japacity/sim";
import { Check, Circle } from "lucide-react";

import { bondName } from "../../../shared/view/person";
import { atBankRate, shortfall } from "../../../shared/words/cost";
import { formatMoney, formatNumber } from "../../../shared/words/format";
import { anyOptions, requirementSentence } from "../../../shared/words/requirement";
import { blurbOf, byMonths, hasWords, inMonths, lowerFirst, monthsAgo, nameOf, say, sayCount, words } from "../../../shared/words/text";
import { Head } from "../act";
import { MoneyChip, PicTile, WordChip } from "../ui";

const GRADE = "quality.education-grade";

/** A month gone by as it reads inside a line: "2 months ago", "last month", "this month"; never its number (world:top-band-is-lively-pill). */
export function agoWords(stamped: number, now: number): string {
  return lowerFirst(monthsAgo(stamped, now));
}

/** The currency of the route's country: what its salary and funds are counted in. */
function countryCurrency(route: RouteView): Currency {
  const country = content.route[route.id]?.country ?? null;
  return (country === null ? undefined : content.country[country]?.currency) ?? "GBP";
}

/**
 * The ways with a file to show: looked into or further, never the road (road:road-route-has-no-figure, whatever the engine sends), and,
 * abroad, never the way already flown on, whose file is history.
 */
function waysOnFile(view: PlayerView): RouteView[] {
  const abroad = view.place.where === "abroad";
  return view.routes.filter(
    (route) => route.state !== "unknown" && route.state !== "heard" && !(abroad && route.state === "departed") && route.gate?.gate !== "road" && content.route[route.id]?.gate !== "road",
  );
}

/** A slow step's bar: how much of it is there, as a bar that fills. */
export function StepBar({ have, need, label }: { have: number; need: number; label: string }) {
  const share = need <= 0 ? 0 : Math.min(100, Math.max(0, Math.floor((have * 100) / need)));
  return (
    <span className="phone-meter mt-1 block h-2 w-full overflow-hidden" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={need} aria-valuenow={Math.min(have, need)} data-step-bar>
      <span style={{ width: `${String(share)}%` }} />
    </span>
  );
}

function employerWords(key: string): string {
  return hasWords(`ui.gate.employer.${key}`) ? say(`ui.gate.employer.${key}`) : say("ui.gate.employer.other");
}

function Line({ children, tone = "plain" }: { children: string; tone?: "plain" | "quiet" | "bad" | "good" }) {
  const colour = tone === "quiet" ? "text-text-2" : tone === "bad" ? "text-out" : tone === "good" ? "text-in" : "";
  return <p className={`text-[14px] leading-snug ${colour}`}>{children}</p>;
}

function Sponsor({ gate, currency }: { gate: Extract<RouteGateView, { gate: "sponsor" }>; currency: Currency }) {
  if (gate.employer === null) return <Line tone="quiet">{say("ui.gate.sponsor.none")}</Line>;
  return (
    <>
      <Line>{say("ui.gate.sponsor.who", { employer: employerWords(gate.employer) })}</Line>
      {gate.salary === null ? null : (
        <p className="num text-[15px] font-bold">{say("ui.gate.sponsor.salary", { salary: formatMoney(gate.salary, currency) })}</p>
      )}
      <div>
        <WordChip tone={gate.underBar ? "bad" : "study"}>{say(gate.underBar ? "ui.gate.sponsor.under" : "ui.gate.sponsor.over")}</WordChip>
      </div>
      {gate.underBar ? <Line tone="bad">{say("ui.gate.sponsor.under-why")}</Line> : null}
    </>
  );
}

function Points({ gate, month }: { gate: Extract<RouteGateView, { gate: "points" }>; month: number }) {
  const short = Math.max(0, gate.cutoff - gate.points);
  // route-gates:points-view-carries-invites: whether an invitation will come is the engine's, the care cut-off for a carer among it.
  const said = !gate.invites ? say("ui.gate.points.short", { short: formatNumber(short) }) : short > 0 ? say("ui.gate.points.over-care") : say("ui.gate.points.over");
  return (
    <>
      <p className="flex items-baseline gap-2 text-[14px]">
        <span className="num text-[26px] leading-none font-bold" data-gate-points>
          {formatNumber(gate.points)}
        </span>
        <span>{say("ui.gate.points.cutoff", { cutoff: formatNumber(gate.cutoff) })}</span>
      </p>
      <StepBar have={gate.points} need={gate.cutoff} label={say("ui.gate.points.title")} />
      <Line tone={gate.invites ? "good" : "bad"}>{said}</Line>
      {gate.careCutoff === null ? null : <Line tone="quiet">{say("ui.gate.points.care", { cutoff: formatNumber(gate.careCutoff) })}</Line>}
      {gate.invitedMonth !== null ? (
        <Line tone="good">{say("phone.japa.invited", { when: agoWords(gate.invitedMonth, month) })}</Line>
      ) : gate.poolMonth === null ? (
        <Line tone="quiet">{say("ui.gate.points.no-pool")}</Line>
      ) : (
        <Line>{say("phone.japa.pool", { since: agoWords(gate.poolMonth, month), ends: inMonths(gate.profileEndsMonth ?? gate.poolMonth, month) })}</Line>
      )}
      <p className="text-[13px] text-text-2">{say("ui.gate.points.clock")}</p>
    </>
  );
}

function Endorsement({ gate, month }: { gate: Extract<RouteGateView, { gate: "endorsement" }>; month: number }) {
  if (gate.refusedMonth === null) return <Line tone="quiet">{say("ui.gate.endorsement.none")}</Line>;
  const cooled = gate.cooledFromMonth !== null && month >= gate.cooledFromMonth;
  return (
    <>
      <Line tone="bad">{say("phone.japa.endorsement.refused", { when: agoWords(gate.refusedMonth, month) })}</Line>
      <Line>{cooled ? say("ui.gate.endorsement.again-now") : say("phone.japa.endorsement.again", { when: inMonths(gate.cooledFromMonth ?? month, month) })}</Line>
    </>
  );
}

function Contract({ gate, currency }: { gate: Extract<RouteGateView, { gate: "contract" }>; currency: Currency }) {
  if (gate.employer === null) return <Line tone="quiet">{say("ui.gate.contract.none")}</Line>;
  return (
    <>
      <Line>{say("ui.gate.contract.who", { employer: employerWords(gate.employer) })}</Line>
      {gate.role === null ? null : <Line>{say("ui.gate.contract.role", { role: hasWords(`ui.gate.role.${gate.role}`) ? say(`ui.gate.role.${gate.role}`) : gate.role })}</Line>}
      {gate.salary === null ? null : <p className="num text-[15px] font-bold">{say("ui.gate.contract.salary", { salary: formatMoney(gate.salary, currency) })}</p>}
      <Line tone="quiet">{say("ui.gate.contract.passport")}</Line>
    </>
  );
}

/** The partner or dependant gate: the bond it rests on and how the other side's application stands (person:dependant-gate-needs, person:partner-gate-needs). */
function Bond({ gate, view }: { gate: Extract<RouteGateView, { gate: "partner" | "dependant" }>; view: PlayerView }) {
  const bond = gate.bond === null ? undefined : view.people.bonds.find((held) => held.id === gate.bond);
  if (bond === undefined) return <Line tone="quiet">{say("ui.gate.bond.none")}</Line>;
  return (
    <>
      {bond.stage === "ended" ? (
        <Line tone="bad">{say("ui.gate.bond.ended")}</Line>
      ) : (
        <Line>{say("ui.gate.bond.with", { name: bondName(bond), stage: say(`ui.people.stage.${bond.stage}`).toLowerCase() })}</Line>
      )}
      <Line tone="quiet">{gate.lead === null ? say("ui.gate.lead.none") : say("ui.gate.lead.state", { state: say(`ui.route.state.${gate.lead}`).toLowerCase() })}</Line>
    </>
  );
}

/** The gate's own part of a way, a block inside its card; none for the study gate. */
function Gate({ route, view }: { route: RouteView; view: PlayerView }) {
  const gate = route.gate;
  if (gate === null || gate.gate === "road") return null;
  const currency = countryCurrency(route);
  return (
    <div className="mt-3 flex flex-col gap-1.5 rounded-[14px] bg-sheet-2 p-3" data-gate={gate.gate}>
      <h4 className="text-[15px] font-bold">{say(`ui.gate.${gate.gate}.title`)}</h4>
      {gate.gate === "sponsor" ? <Sponsor gate={gate} currency={currency} /> : null}
      {gate.gate === "points" ? <Points gate={gate} month={view.month} /> : null}
      {gate.gate === "endorsement" ? <Endorsement gate={gate} month={view.month} /> : null}
      {gate.gate === "contract" ? <Contract gate={gate} currency={currency} /> : null}
      {gate.gate === "partner" || gate.gate === "dependant" ? <Bond gate={gate} view={view} /> : null}
    </div>
  );
}

type School = RouteView["schools"][number];

/** Every university on the way, with what it asks and costs, and the answer where the papers went. */
function Schools({ route, view }: { route: RouteView; view: PlayerView }) {
  const ids = content.route[route.id]?.schools ?? [];
  if (ids.length === 0) return null;
  const applied = new Map<string, School>(route.schools.map((school) => [school.id, school]));
  return (
    <div className="mt-3" data-schools>
      <h4 className="mb-1.5 text-[15px] font-bold">{applied.size === 0 ? say("ui.route.schools.before") : say("ui.route.schools")}</h4>
      <ul className="flex flex-col gap-2">
        {ids.map((id) => {
          const entry = content.school[id];
          if (entry === undefined) return null;
          const school = applied.get(id);
          const discount = school?.discount ?? 0;
          const status =
            school === undefined
              ? null
              : school.state === "pending"
                ? say("phone.japa.school.pending", { when: byMonths(school.readyMonth, view.month) })
                : school.state === "offer"
                  ? say("ui.route.school.offer")
                  : say("ui.route.school.rejected");
          const owing = school?.state === "offer" && route.school === null;
          const deposit = shortfall(view, [{ currency: "GBP", amount: entry.deposit }]);
          const grade = hasWords(`${GRADE}.value.${String(entry.minGrade)}`) ? lowerFirst(say(`${GRADE}.value.${String(entry.minGrade)}`)) : String(entry.minGrade);
          return (
            <li key={id} className="flex flex-col gap-1 rounded-[14px] bg-sheet-2 p-3" data-school={id}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="min-w-0 flex-1 text-[15px] font-bold">{nameOf(id)}</span>
                {status === null || school === undefined ? null : <WordChip tone={school.state === "offer" ? "soft" : school.state === "rejected" ? "bad" : "study"}>{status}</WordChip>}
                {discount > 0 ? <MoneyChip>{say("ui.route.school.discount", { amount: formatMoney(discount, "GBP") })}</MoneyChip> : null}
                {route.school === id ? <WordChip tone="soft">{say("ui.route.school.chosen")}</WordChip> : null}
              </div>
              <Line>
                {discount > 0
                  ? say("ui.route.school.costs-discount", { deposit: formatMoney(entry.deposit, "GBP"), tuition: formatMoney(entry.tuition, "GBP"), after: formatMoney(entry.tuition - discount, "GBP") })
                  : say("ui.route.school.costs", { deposit: formatMoney(entry.deposit, "GBP"), tuition: formatMoney(entry.tuition, "GBP") })}
              </Line>
              {school === undefined ? <Line tone="quiet">{say("ui.route.school.asks", { grade })}</Line> : null}
              {route.school === null ? <Line tone="quiet">{say("ui.route.school.naira", { naira: formatMoney(deposit.need, "NGN") })}</Line> : null}
              {owing && deposit.short > 0 ? (
                <Line tone="bad">{say("ui.route.school.short", { need: formatMoney(deposit.need, "NGN"), have: formatMoney(deposit.have, "NGN"), short: formatMoney(deposit.short, "NGN") })}</Line>
              ) : null}
            </li>
          );
        })}
      </ul>
      {route.school === null ? <p className="mt-1.5 text-[13px] text-text-2">{say("ui.route.foreign-fee")}</p> : null}
    </div>
  );
}

/** The funds now: the checklist's slow item carries them live, while the route's own record holds the last check. */
function fundsNow(route: RouteView): { shown: number; required: number } {
  const ids = (content.route[route.id]?.checklist ?? []).filter((item) => item.requirement.type === "route/funds").map((item) => item.id);
  const live = route.checklist.find((item) => ids.includes(item.id) && item.have !== null && item.need !== null);
  return live === undefined ? { shown: route.funds.shown, required: route.funds.required } : { shown: live.have ?? 0, required: live.need ?? 0 };
}

function Funds({ route, view }: { route: RouteView; view: PlayerView }) {
  const { shown, required } = fundsNow(route);
  const open = route.state === "known" || route.state === "applying";
  if (!open && shown === 0 && required === 0 && route.support === null) return null;
  const short = Math.max(0, required - shown);
  // Each gate shows its own line in its own currency (route-gates:route-entry-gate-block).
  const currency = countryCurrency(route);
  return (
    <div className="mt-3 flex flex-col gap-1" data-funds>
      <h4 className="text-[15px] font-bold">{say("ui.route.funds")}</h4>
      {required === 0 ? (
        <Line tone="quiet">{say("ui.route.funds.none-needed")}</Line>
      ) : (
        <>
          <StepBar have={shown} need={required} label={say("ui.route.funds")} />
          <Line>{say("ui.route.funds.line", { shown: formatMoney(shown, currency), required: formatMoney(required, currency) })}</Line>
          {short > 0 ? <Line tone="bad">{say("ui.route.funds.short", { short: formatMoney(short, currency), naira: formatMoney(atBankRate(view, currency, short), "NGN") })}</Line> : null}
          <p className="text-[13px] text-text-2">{say("ui.route.funds.what")}</p>
          <div>
            <WordChip tone={route.funds.heldMonths > 0 ? "soft" : "plain"}>{sayCount("ui.route.funds.held", route.funds.heldMonths, { months: route.funds.heldMonths })}</WordChip>
          </div>
        </>
      )}
      {route.support === null ? null : <Line>{say("ui.route.support", { amount: formatMoney(route.support.amount, route.support.currency) })}</Line>}
    </div>
  );
}

/** What is on the way's record: the deposit, the visa's months, the refusals and their reasons in words, a refund due. */
function Record({ route, month }: { route: RouteView; month: number }) {
  const any = route.depositPaid > 0 || route.visa !== null || route.refusals > 0 || route.lastRefusal !== null || route.depositRefund !== null;
  if (!any) return null;
  return (
    <div className="mt-3 flex flex-col gap-1" data-way-record>
      {route.depositPaid > 0 ? <Line>{say("ui.route.deposit-paid", { amount: formatMoney(route.depositPaid, "GBP") })}</Line> : null}
      {route.visa === null ? null : <Line>{say("phone.japa.visa.sent", { sent: agoWords(route.visa.submittedMonth, month), decision: inMonths(route.visa.decisionMonth, month) })}</Line>}
      {route.refusals > 0 ? (
        <div>
          <WordChip tone="bad">{sayCount("ui.route.refusals", route.refusals, { count: route.refusals })}</WordChip>
        </div>
      ) : null}
      {route.lastRefusal === null ? null : (
        <div data-last-refusal>
          <Line>{say("phone.japa.last-refusal", { when: agoWords(route.lastRefusal.month, month) })}</Line>
          <ul className="mt-1 flex flex-col gap-1">
            {route.lastRefusal.reasons.map((reason) => (
              <li key={reason} className="text-[14px] font-semibold" data-refusal-reason={reason}>
                {hasWords(`ui.refusal.${reason}`) ? say(`ui.refusal.${reason}`) : reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {route.depositRefund === null ? null : <Line>{say("phone.japa.refund", { amount: formatMoney(route.depositRefund.amount, "GBP"), when: inMonths(route.depositRefund.readyMonth, month) })}</Line>}
    </div>
  );
}

/**
 * What the first application into Canada still owes after a removal (route-gates:canada-return-asks-authorisation): the authorisation to return
 * and the removal costs, as money, before the application is sent. Nothing when the view says none is owed.
 */
function Authorisation({ route }: { route: RouteView }) {
  const owed = route.authorisation;
  if (owed === undefined) return null;
  return (
    <div className="mt-3 flex flex-col gap-1 rounded-[14px] bg-sheet-2 p-3" data-way-authorisation>
      <h4 className="text-[15px] font-bold">{say("ui.route.authorisation.title")}</h4>
      <Line>{say("ui.route.authorisation", { arc: formatMoney(owed.arc.amount, owed.arc.currency), removal: formatMoney(owed.removal.amount, owed.removal.currency) })}</Line>
    </div>
  );
}

/** One way's file as a card: its picture, its name, its state and window as chips, then the gate, the universities, the funds and the record. */
function WayFile({ route, view }: { route: RouteView; view: PlayerView }) {
  return (
    <li className="lively-card p-3.5" data-way-file={route.id}>
      <div className="flex items-start gap-3">
        <PicTile of={route.id} size={52} tint="study" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[18px] leading-tight font-bold">{nameOf(route.id)}</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <WordChip tone={route.state === "granted" ? "soft" : route.state === "refused" ? "bad" : "study"}>{say(`ui.route.state.${route.state}`)}</WordChip>
            <WordChip tone={route.window === "closed" ? "bad" : route.window === "narrowing" ? "soft" : "plain"} data-way-window={route.window}>
              {say(`ui.route.window.${route.window}`)}
            </WordChip>
          </div>
        </div>
      </div>
      <Gate route={route} view={view} />
      <Authorisation route={route} />
      <Schools route={route} view={view} />
      <Funds route={route} view={view} />
      <Record route={route} month={view.month} />
    </li>
  );
}

/** Every way on file, each its own card, under one heading; nothing when none is looked into yet. */
export function WayFiles({ view }: { view: PlayerView }) {
  const ways = waysOnFile(view);
  if (ways.length === 0) return null;
  return (
    <div data-way-files>
      <Head>{say("ui.route.title")}</Head>
      <ul className="flex flex-col gap-2.5">
        {ways.map((route) => (
          <WayFile key={route.id} route={route} view={view} />
        ))}
      </ul>
    </div>
  );
}

/** An item's words: content's own key when it has one, else the sentence for the goal's requirement at that place in its `doneIf`. */
function goalItemWords(goal: Id<"goal">, item: string): string {
  const key = `${goal}.item.${item}`;
  if (hasWords(key)) return words(key);
  const requirement = /^\d+$/.test(item) ? content.goal[goal]?.doneIf[Number(item)] : undefined;
  return requirement === undefined ? say("ui.goal.item", { n: item }) : requirementSentence(requirement);
}

/** The paths of an item that any one of several meets, when content names the item in its own words. */
function goalItemOptions(goal: Id<"goal">, item: string): string[] {
  if (!hasWords(`${goal}.item.${item}`)) return [];
  const requirement = /^\d+$/.test(item) ? content.goal[goal]?.doneIf[Number(item)] : undefined;
  return requirement === undefined ? [] : anyOptions(requirement);
}

/**
 * The life's goals (goal.md, the view rule): each open one as a card with its steps ticked or not, the done ones as chips
 * with the month each was done. Abroad with none yet, a line says they open as life settles; at home with none, nothing.
 * Goals gate nothing: they are what could come next.
 */
export function Goals({ view }: { view: PlayerView }) {
  const { open, done } = view.goals;
  if (open.length === 0 && done.length === 0) {
    if (view.place.where !== "abroad") return null;
    return (
      <div data-goals="none">
        <Head>{say("ui.goal.title")}</Head>
        <p className="text-[14px] text-text-2">{say("ui.goal.none")}</p>
      </div>
    );
  }
  return (
    <div data-goals>
      <Head>{say("ui.goal.title")}</Head>
      {open.length === 0 ? null : (
        <ul className="flex flex-col gap-2.5">
          {open.map((goal) => (
            <li key={goal.id} className="lively-card p-3.5" data-goal={goal.id}>
              <p className="text-[17px] leading-tight font-bold">{nameOf(goal.id)}</p>
              {blurbOf(goal.id) === null ? null : <p className="mt-0.5 text-[14px] text-text-2">{blurbOf(goal.id)}</p>}
              <ul className="mt-2 flex flex-col gap-1.5">
                {goal.items.map((item) => {
                  const options = goalItemOptions(goal.id, item.id);
                  return (
                    <li key={item.id} className="flex items-start gap-2 text-[14px]" data-met={item.met ? "true" : "false"}>
                      {item.met ? <Check size={16} className="mt-0.5 shrink-0 text-in" aria-hidden /> : <Circle size={16} className="mt-0.5 shrink-0 text-text-2" aria-hidden />}
                      <span className={item.met ? "text-text-2 line-through" : ""}>
                        {goalItemWords(goal.id, item.id)}
                        {options.length < 2 ? null : (
                          <span className="mt-1 block text-text-2" data-one-of>
                            {say("ui.chapter.one-of")} {options.join("; ")}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {done.length === 0 ? null : (
        <div className="mt-2.5" data-goals-done>
          <p className="mb-1.5 text-[14px] font-semibold text-text-2">{say("ui.goal.done")}</p>
          <ul className="flex flex-wrap gap-1.5">
            {done.map((goal) => (
              <li key={goal.id}>
                <WordChip tone="soft" data-goal-done={goal.id}>
                  {say("phone.japa.goal.done", { goal: nameOf(goal.id), when: agoWords(goal.month, view.month) })}
                </WordChip>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
