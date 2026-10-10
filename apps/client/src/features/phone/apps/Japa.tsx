// Japa (docs/rules/world.md R-WORLD-018, 019): the plan as steps with a percent: the japacity
// figure, the route's steps, the papers as a step with their state, and what is coming up (the visa
// decision, a paper's ready month). The Papers screen inside shows what is in the box under the
// bed; the papers themselves are a thing at home. Once a visa is granted it names the next step;
// after the flight it shows the visa held, what it lets you do, and the landing's steps.
import { content } from "@japacity/content";
import type { ChapterEntry, Currency, Id, PlayerView, RouteView } from "@japacity/sim";
import { Check, ChevronLeft, ChevronRight, Circle, FileCheck, FileClock, FileX } from "lucide-react";
import { use, useState } from "react";

import { useGame, useView } from "../../../authority/GameProvider";
import { monthsLeft, SOON } from "../../../shared/words/expiry";
import { formatBand, formatMoney } from "../../../shared/words/format";
import { blurbOf, forMonths, inMonths, nameOf, runningName, say, sayCount, words } from "../../../shared/words/text";
import { Head, PhoneSaid } from "../act";
import { phoneWords } from "../phone.words";
import { actOnCard, nowSaid } from "../../../shared/words/acts";

const ENGLISH_RESULT = "document.english-test";
const OFFICIAL = "activity.look-into-route";

/** Japa's words after the grant and the flight, first drafts in the voice of docs/rules/text.md; content's and the phone's tables win. */
const AFTER_TEXT: Record<string, string> = {
  "phone.japa.next": "Next: {step}",
  "phone.japa.visa.label": "Your visa",
  "phone.japa.visa.none": "No visa here",
  "phone.japa.visa.lets": "What it lets you do",
  "phone.japa.visa.way-up": "The way up",
  "phone.japa.chapter.soon": "Starts when this month ends.",
};

function afterWords(key: string, params: Record<string, string> = {}): string {
  const said = phoneWords(key, params);
  if (said !== key) return said;
  return (AFTER_TEXT[key] ?? key).replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => params[name] ?? whole);
}

/**
 * The chapter that follows a chapter (R-CHAPTER-009): the next base by order, or its variant for the way
 * out the current chapter follows. The engine reads the lean again at the close; the view does not carry
 * it, so a variant's way out stands for it here.
 */
function chapterAfter(current: Id<"chapter">): ChapterEntry | undefined {
  const entry = content.chapter[current];
  const base = entry?.variantOf === undefined ? entry : content.chapter[entry.variantOf];
  if (base === undefined) return undefined;
  const next = Object.values(content.chapter)
    .filter((candidate) => candidate.variantOf === undefined && candidate.order > base.order)
    .sort((a, b) => a.order - b.order)[0];
  if (next === undefined) return undefined;
  const route = entry?.route;
  return (route === undefined ? undefined : Object.values(content.chapter).find((candidate) => candidate.variantOf === next.id && candidate.route === route)) ?? next;
}

/**
 * The chapter whose steps lie ahead (R-WORLD-019): the current one while a step is undone, its steps
 * as the view marks them; once every step is met, the next by content's order, which opens when the
 * month ends, its steps not yet marked.
 */
export function chapterAhead(chapter: PlayerView["chapter"]): { id: Id<"chapter">; now: boolean; items: { id: string; met: boolean }[] } | null {
  const current = chapter.current;
  if (current === null) return null;
  if (chapter.items.some((item) => !item.met)) return { id: current, now: true, items: chapter.items };
  const next = chapterAfter(current);
  return next === undefined ? null : { id: next.id, now: false, items: next.items.map((item) => ({ id: item.id, met: false })) };
}

/**
 * R-CHAPTER-009: the chapter's own checklist while it is a way out's variant (the care file, the talent
 * file, the Gulf's), its items in the chapter's words, ticked as the chapter sheet ticks them. The
 * master's chapters keep the route's steps alone.
 */
function ChapterSteps({ chapter }: { chapter: PlayerView["chapter"] }) {
  const current = chapter.current;
  if (current === null || content.chapter[current]?.variantOf === undefined) return null;
  return (
    <div data-chapter-steps={current}>
      <Head>{nameOf(current)}</Head>
      <ul className="flex flex-col">
        {chapter.items.map((item) => (
          <Step key={item.id} met={item.met}>
            {words(`${current}.item.${item.id}`)}
          </Step>
        ))}
      </ul>
    </div>
  );
}

/** The first step not done of the chapter ahead, in the story's words. */
function nextStepWords(ahead: NonNullable<ReturnType<typeof chapterAhead>>): string | null {
  const step = ahead.items.find((item) => !item.met);
  return step === undefined ? null : words(`${ahead.id}.item.${step.id}`);
}

/**
 * R-ADVICE-002: the route whose official page can be read now: the plan's route when the page
 * offers it, else the first route the page offers (a route only heard of, before any plan).
 */
export function officialRoute(view: PlayerView): string | null {
  const official = view.activities.find((option) => option.id === OFFICIAL);
  if (official?.allowed !== true || official.params === null || official.params.length === 0) return null;
  const planned = planRoute(view)?.id;
  return planned !== undefined && official.params.includes(planned) ? planned : (official.params[0] ?? null);
}

/** The route the plan follows: the japacity figure's route, else the furthest one heard of. */
export function planRoute(view: PlayerView): RouteView | null {
  const lead = view.routes.find((route) => route.id === view.japacity.route);
  if (lead !== undefined) return lead;
  return view.routes.find((route) => route.state !== "unknown" && route.state !== "heard" && route.gate?.gate !== "road") ?? null;
}

/**
 * The way out the Japa header names (R-WORLD-019), read as the nudge reads it: the plan's route,
 * else a route only heard of, since a route heard of is already a way out to look into.
 */
export function headRoute(view: PlayerView): RouteView | null {
  return planRoute(view) ?? view.routes.find((route) => route.state === "heard" && route.gate?.gate !== "road") ?? null;
}

export interface MoveCost {
  key: string;
  amount: number;
  currency: Currency;
}

/**
 * What the study route's "saved for the move" figure is made of, as R-ROUTE-009 counts the funds to
 * show: the tuition still to pay (the school chosen, else the cheapest offer, else the cheapest
 * school, less any discount and deposit), the living money for the months, and beside them the
 * flight, paid in naira when the visa is granted. Empty for a route whose gate counts its own funds.
 */
export function moveCosts(route: RouteView): MoveCost[] {
  const entry = content.route[route.id];
  // The funds as the checklist reads them live, as the results' savings bar does; else the last month-end check.
  const funds = new Set((entry?.checklist ?? []).filter((item) => item.requirement.type === "route/funds").map((item) => item.id));
  const required = route.checklist.find((item) => funds.has(item.id) && item.need !== null)?.need ?? route.funds.required;
  if (entry === undefined || route.gate !== null || required <= 0) return [];
  const course = (id: string, discounted: boolean): number => {
    const school = content.school[id as keyof typeof content.school];
    const discount = discounted ? (route.schools.find((held) => held.id === id)?.discount ?? 0) : 0;
    return (school?.tuition ?? 0) - discount;
  };
  const offers = route.schools.filter((school) => school.state === "offer").map((school) => school.id);
  const tuition =
    route.school !== null
      ? course(route.school, true) - route.depositPaid
      : offers.length > 0
        ? Math.min(...offers.map((id) => course(id, true)))
        : Math.min(...entry.schools.map((id) => course(id, false)));
  const owed = Math.max(0, Math.min(tuition, required));
  const currency: Currency = "GBP";
  const flight = content.tuning.route.flight;
  return [
    { key: "ui.japa.cost.tuition", amount: owed, currency },
    { key: "ui.japa.cost.living", amount: required - owed, currency },
    { key: "ui.japa.cost.funds", amount: required, currency },
    ...(typeof flight.amount === "number" ? [{ key: "ui.japa.cost.flight", amount: flight.amount, currency: flight.currency }] : []),
  ];
}

/** What is coming up: the visa decision, and each paper on its way. */
export function remindersOf(view: PlayerView): string[] {
  const out: string[] = [];
  for (const route of view.routes) {
    if (route.visa !== null && (route.state === "applying" || route.state === "known")) out.push(phoneWords("phone.japa.visa", { when: inMonths(route.visa.decisionMonth, view.month) }));
  }
  for (const paper of view.documents) {
    if (paper.state === "pending" && paper.readyMonth !== null) out.push(phoneWords("phone.japa.paper-ready", { paper: nameOf(paper.id), when: inMonths(paper.readyMonth, view.month) }));
  }
  return out;
}

function Papers({ onBack }: { onBack: () => void }) {
  const { documents, month } = useView();
  return (
    <div data-papers>
      <button type="button" onClick={onBack} className="press mb-2 flex items-center gap-1 text-[14px] font-bold text-text-2" data-papers-back>
        <ChevronLeft size={16} aria-hidden />
        {phoneWords("phone.app.japa")}
      </button>
      <h3 className="title text-[18px]">{phoneWords("phone.japa.papers.title")}</h3>
      <p className="mt-1 mb-3 text-[13px] text-text-2">{phoneWords("phone.japa.papers.hint")}</p>
      {documents.length === 0 ? (
        <p className="text-[14px] text-text-2">{phoneWords("phone.japa.papers.none")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((paper) => {
            const left = monthsLeft(paper, month);
            const soon = left !== null && left <= SOON;
            const Icon = paper.state === "held" ? FileCheck : paper.state === "pending" ? FileClock : FileX;
            return (
              <li key={paper.id} data-paper={paper.id} data-state={paper.state} className="flex items-start gap-3 rounded-[6px] p-3" style={{ background: "var(--paper-bill)" }}>
                <Icon size={20} aria-hidden className={`mt-0.5 shrink-0 ${paper.state === "held" ? "text-in" : paper.state === "expired" ? "text-out" : "text-text-2"}`} />
                <div className="min-w-0">
                  <p className={`text-[15px] font-bold ${paper.state === "expired" ? "line-through" : ""}`}>{nameOf(paper.id)}</p>
                  <p className="text-[13px] text-text-2">
                    {paper.state === "pending" && paper.readyMonth !== null
                      ? phoneWords("phone.japa.paper-pending", { when: inMonths(paper.readyMonth, month) })
                      : paper.state === "expired"
                        ? say("ui.document.expired")
                        : paper.expiresMonth === null
                          ? say("ui.document.held")
                          : phoneWords("phone.japa.paper-valid", { when: forMonths(paper.expiresMonth, month) })}
                  </p>
                  {soon && left !== null ? <p className="text-[13px] font-bold text-out">{sayCount("ui.document.expires-soon", left, { months: left })}</p> : null}
                  {paper.id === ENGLISH_RESULT && paper.value !== null ? <p className="text-[13px] font-bold">{say("ui.document.band", { band: formatBand(paper.value) })}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Step({ met, children }: { met: boolean; children: string }) {
  return (
    <li className="flex items-start gap-2.5 py-1.5" data-met={met ? "true" : "false"}>
      {met ? <Check size={18} className="mt-0.5 shrink-0 text-in" aria-hidden /> : <Circle size={18} className="mt-0.5 shrink-0 text-text-2" aria-hidden />}
      <span className={`text-[14px] ${met ? "text-text-2 line-through" : ""}`}>{children}</span>
    </li>
  );
}

function NextStep({ step }: { step: string }) {
  return (
    <p className="mt-2 flex items-center gap-2 rounded-[6px] border-l-4 border-signal bg-sheet-2 px-3 py-2 text-[14px] font-bold" data-japa-next>
      <ChevronRight size={16} className="shrink-0" aria-hidden />
      {afterWords("phone.japa.next", { step })}
    </p>
  );
}

/** After the flight (R-WORLD-019): the visa held and what it lets you do, then the landing's steps. */
function Abroad({ view, onPapers }: { view: PlayerView; onPapers: () => void }) {
  const held = view.status;
  const ahead = chapterAhead(view.chapter);
  const next = ahead?.now === true ? nextStepWords(ahead) : null;
  const lets = held === null ? null : blurbOf(held.entry);
  return (
    <div data-phone-app="japa">
      <div className="band rounded-[6px] px-4 py-3" data-japa-visa={held?.entry ?? ""}>
        <div className="label label-strong">{afterWords("phone.japa.visa.label")}</div>
        <div className="title truncate text-[18px]">{held === null ? afterWords("phone.japa.visa.none") : nameOf(held.entry)}</div>
        {held === null ? null : (
          <div className="mt-0.5 text-[13px] font-bold opacity-85">{held.monthsLeft === null ? say("ui.status.no-end") : sayCount("ui.status.months-left", held.monthsLeft, { months: held.monthsLeft })}</div>
        )}
      </div>
      {held === null ? <p className="mt-2 text-[14px]">{say("ui.status.none")}</p> : null}
      {lets === null ? null : (
        <>
          <Head>{afterWords("phone.japa.visa.lets")}</Head>
          <p className="text-[14px]">{lets}</p>
        </>
      )}
      {held?.clock === null || held?.clock === undefined ? null : <p className="mt-2 text-[14px] font-bold text-out">{sayCount("ui.status.clock", held.clock, { months: held.clock })}</p>}
      {next === null ? null : <NextStep step={next} />}
      {ahead === null ? null : (
        <div data-landing={ahead.now ? "now" : "soon"}>
          <Head>{nameOf(ahead.id)}</Head>
          {ahead.now ? null : <p className="mb-1 text-[13px] text-text-2">{afterWords("phone.japa.chapter.soon")}</p>}
          <ul className="flex flex-col">
            {ahead.items.map((item) => (
              <Step key={item.id} met={item.met}>
                {words(`${ahead.id}.item.${item.id}`)}
              </Step>
            ))}
          </ul>
        </div>
      )}
      {held?.nextStep === null || held?.nextStep === undefined ? null : (
        <>
          <Head>{afterWords("phone.japa.visa.way-up")}</Head>
          <p className="text-[14px]">{words(held.nextStep)}</p>
        </>
      )}
      <PapersButton view={view} onOpen={onPapers} />
    </div>
  );
}

function PapersButton({ view, onOpen }: { view: PlayerView; onOpen: () => void }) {
  const held = view.documents.filter((paper) => paper.state === "held").length;
  return (
    <button type="button" onClick={onOpen} className="press mt-1 flex w-full items-center gap-2.5 rounded-[6px] border border-sheet-line bg-sheet-2 px-3 py-2.5 text-left" data-open-papers>
      {view.documents.length > 0 && held === view.documents.length ? <Check size={18} className="shrink-0 text-in" aria-hidden /> : <Circle size={18} className="shrink-0 text-text-2" aria-hidden />}
      <span className="flex-1">
        <span className="block text-[14px] font-bold">{phoneWords("phone.japa.papers")}</span>
        <span className="block text-[13px] text-text-2">{view.documents.length === 0 ? phoneWords("phone.japa.papers.none") : phoneWords("phone.japa.papers.line", { held, count: view.documents.length })}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-text-2" aria-hidden />
    </button>
  );
}

export function Japa() {
  const view = useView();
  const [papers, setPapers] = useState(false);
  // R-ADVICE-002: the official page can be read from the phone: it goes into the month like the hub's desk would put it.
  const addToPlan = useGame((state) => state.addToPlan);
  const send = useGame((state) => state.send);
  const plan = useGame((state) => state.plan);
  const said = use(PhoneSaid);
  if (papers) {
    return (
      <div data-phone-app="japa">
        <Papers onBack={() => setPapers(false)} />
      </div>
    );
  }
  if (view.place.where === "abroad") return <Abroad view={view} onPapers={() => setPapers(true)} />;
  const route = planRoute(view);
  const head = headRoute(view);
  const costs = route === null ? [] : moveCosts(route);
  const lookInto = view.ended ? null : officialRoute(view);
  const planned = lookInto !== null && plan.some((pick) => pick !== null && pick.activity === OFFICIAL && pick.param === lookInto);
  const percent = view.japacity.percent;
  const coming = remindersOf(view);
  // Once a visa is granted the plan is done but the story is not: the next step, the plane, is named.
  const ahead = view.routes.some((candidate) => candidate.state === "granted") ? chapterAhead(view.chapter) : null;
  const next = ahead === null ? null : nextStepWords(ahead);
  // The page offered may be about another way than the plan's: then it stands under its own heading,
  // after the plan's costs, and names its route, so Canada is never offered under the UK.
  const otherWay = lookInto !== null && route !== null && lookInto !== route.id;
  const officialCard =
    lookInto === null ? null : (
      <button
        type="button"
        disabled={planned}
        // R-ACTIVITY-015: the official page is read at once; the place's answer opens over the world.
        onClick={() => void actOnCard({ activity: OFFICIAL, param: lookInto }, { send, addToPlan }).then((acted) => said(acted === "planned" ? say("ui.world.planned", { what: nameOf(OFFICIAL) }) : acted === "full" ? say("ui.world.full") : acted === "answered" ? nowSaid(OFFICIAL, lookInto) : ""))}
        className="press mt-1 flex w-full items-center gap-2.5 rounded-[6px] border border-sheet-line bg-sheet-2 px-3 py-2.5 text-left disabled:opacity-70"
        data-official-page={lookInto}
        data-official-other={otherWay ? "true" : undefined}
      >
        <FileCheck size={18} className="shrink-0 text-text-2" aria-hidden />
        <span className="flex-1">
          <span className="block text-[14px] font-bold">{otherWay ? say("ui.japa.official.title-route", { route: runningName(lookInto) }) : nameOf(OFFICIAL)}</span>
          <span className="block text-[13px] text-text-2">{phoneWords(planned ? "phone.japa.official-planned" : "phone.japa.official", { route: runningName(lookInto) })}</span>
        </span>
        {planned ? <Check size={18} className="shrink-0 text-in" aria-hidden /> : <ChevronRight size={18} className="shrink-0 text-text-2" aria-hidden />}
      </button>
    );
  return (
    <div data-phone-app="japa">
      <div className="band flex items-end justify-between gap-3 rounded-[6px] px-4 py-3" data-japa-head>
        <div className="min-w-0">
          <div className="label label-strong" data-japa-label>
            {phoneWords("phone.japa.label")}
          </div>
          <div className="title truncate text-[15px]" data-japa-route={head?.id ?? ""}>
            {head === null ? phoneWords("phone.japa.none") : nameOf(head.id)}
          </div>
          {/* The figure's one name says once what it means, where the figure shows. */}
          {percent === null ? null : (
            <div className="mt-0.5 text-[12px] opacity-85" data-japa-gloss>
              {phoneWords("phone.japa.gloss")}
            </div>
          )}
        </div>
        {percent === null ? null : (
          <div className="num text-[44px] leading-none" data-japa-percent={percent}>
            {percent}
            <span className="text-[24px]">%</span>
          </div>
        )}
      </div>
      {/* The header names the route; the figure's route is said again only when it is another. */}
      {view.japacity.route === null || view.japacity.route === head?.id ? null : <p className="mt-1 text-[12px] text-text-2">{say("ui.japacity.of", { route: runningName(view.japacity.route) })}</p>}
      {next === null ? null : <NextStep step={next} />}
      {ahead === null ? <ChapterSteps chapter={view.chapter} /> : null}

      {coming.length === 0 ? null : (
        <>
          <Head>{phoneWords("phone.japa.reminders")}</Head>
          <ul className="flex flex-col gap-1.5" data-reminders>
            {coming.map((line) => (
              <li key={line} className="rounded-[6px] border-l-4 border-signal bg-sheet-2 px-3 py-2 text-[14px]">
                {line}
              </li>
            ))}
          </ul>
        </>
      )}

      {officialCard === null || otherWay ? null : officialCard}
      {costs.length === 0 ? null : (
        <>
          <Head>{say("ui.japa.cost.title")}</Head>
          <dl className="flex flex-col rounded-[6px] border border-sheet-line bg-sheet-2 px-3 py-1" data-move-costs>
            {costs.map((cost) => (
              <div key={cost.key} className={`flex items-baseline justify-between gap-3 py-1.5 text-[14px] ${cost.key === "ui.japa.cost.funds" ? "border-t border-sheet-line font-bold" : ""}`} data-cost={cost.key}>
                <dt className="min-w-0">{say(cost.key)}</dt>
                <dd className="num shrink-0">{formatMoney(cost.amount, cost.currency)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {officialCard !== null && otherWay ? (
        <>
          <Head>{say("ui.japa.official.other")}</Head>
          {officialCard}
        </>
      ) : null}
      <Head>{phoneWords("phone.japa.steps")}</Head>
      <ul className="flex flex-col" data-steps>
        {route === null || route.state === "heard" ? null : route.checklist.map((item) => <Step key={item.id} met={item.met}>{words(`${route.id}.item.${item.id}`)}</Step>)}
      </ul>
      <PapersButton view={view} onOpen={() => setPapers(true)} />
    </div>
  );
}
