// Japa (docs/rules/world.md R-WORLD-018, 019): the plan as steps with a percent: the japacity
// figure, the route's steps, the papers as a step with their state, and what is coming up (the visa
// decision, a paper's ready month). The Papers screen inside shows what is in the box under the
// bed; the papers themselves are a thing at home. Once a visa is granted it names the next step;
// after the flight it shows the visa held, what it lets you do, and the landing's steps. The head names
// the plan the chapters follow with its file, and each other way heard of opens its page with the switch
// (docs/rules/chapter.md R-CHAPTER-009).
import { content } from "@japacity/content";
import type { Currency, Id, PlayerView, RouteView } from "@japacity/sim";
import { Check, ChevronRight, Circle, FileCheck, FileClock, Flag, Stamp, type LucideIcon } from "lucide-react";
import { use, useState } from "react";

import { useGame, useView } from "../../../authority/GameProvider";
import { PhoneNav } from "../../../shared/phone/nav";
import { Mark } from "../../../shared/ui/Mark";
import { actOnCard, nowSaid } from "../../../shared/words/acts";
import { formatMoney } from "../../../shared/words/format";
import { type Coming, comingOf } from "../../../shared/words/coming";
import { checklistWords } from "../../../shared/words/requirement";
import { readyPercent } from "../../../shared/words/ready";
import { planRoute } from "../../../shared/words/savings";
import { wardMonths } from "../../../shared/words/sixteen";
import { blurbOf, hasWords, inMonths, nameOf, runningName, say, sayCount, words } from "../../../shared/words/text";
import { Head, PhoneSaid } from "../act";
import { phoneWords } from "../phone.words";
import { RoutePage } from "./PlanSwitch";

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
 * The chapter whose steps lie ahead (R-WORLD-019): the current one while it does not close, its steps as the
 * view marks them; once the view says it closes at the month's end (R-CHAPTER-010, `closesOn` honoured), the
 * chapter the view names next, which opens when the month ends, its steps not yet marked.
 */
export function chapterAhead(chapter: PlayerView["chapter"]): { id: Id<"chapter">; now: boolean; items: { id: string; met: boolean }[] } | null {
  const current = chapter.current;
  if (current === null) return null;
  if (!chapter.closes) return { id: current, now: true, items: chapter.items };
  const next = chapter.next === null ? undefined : content.chapter[chapter.next];
  return next === undefined ? null : { id: next.id, now: false, items: next.items.map((item) => ({ id: item.id, met: false })) };
}

/**
 * R-CHAPTER-009: the chapter's own checklist while it is a way out's variant (the care file, the talent
 * file, the Gulf's), its items in the chapter's words, ticked as the chapter sheet ticks them. The
 * master's chapters keep the route's steps alone.
 */
function ChapterSteps({ view }: { view: PlayerView }) {
  const { chapter } = view;
  const current = chapter.current;
  if (current === null || content.chapter[current]?.variantOf === undefined) return null;
  const ward = wardMonths(view);
  return (
    <div data-chapter-steps={current}>
      <Head>{nameOf(current)}</Head>
      <ul className="flex flex-col">
        {chapter.items.map((item) => {
          const own = `${current}.item.${item.id}`;
          // The months on the ward, counted while they run.
          const counted = !item.met && item.id === "tenure" && ward !== null && hasWords(`${own}.japa`);
          const wait = item.met ? null : councilWait(view, own);
          return (
            <Step key={item.id} met={item.met} {...(wait === null ? {} : { way: wait })}>
              {counted ? say(`${own}.japa`, { done: ward.done, need: ward.need }) : words(own)}
            </Step>
          );
        })}
      </ul>
    </div>
  );
}

/** The paper a chapter's step waits on, so Japa says when it comes: the council's months. */
const STEP_PAPERS: Readonly<Record<string, string>> = {
  "chapter.build-the-file-care.item.verification": "document.nmcn-verification",
};

/** "The council answers in 5 months" while the step's paper is on its way, else null. */
function councilWait(view: PlayerView, own: string): string | null {
  const paper = view.documents.find((held) => held.id === STEP_PAPERS[own]);
  if (paper === undefined || paper.onItsWay === null || !hasWords(`${own}.japa.pending`)) return null;
  return say(`${own}.japa.pending`, { when: inMonths(paper.onItsWay, view.month) });
}

/** The first step not done of the chapter ahead, in the story's words. */
function nextStepWords(ahead: NonNullable<ReturnType<typeof chapterAhead>>): string | null {
  const step = ahead.items.find((item) => !item.met);
  return step === undefined ? null : words(`${ahead.id}.item.${step.id}`);
}

/**
 * R-ADVICE-002: the route whose official page can be read now: the plan's route when the page
 * offers it (the plan the chapters follow, R-CHAPTER-009, else the figure's), else the first route
 * the page offers (a route only heard of, before any plan).
 */
export function officialRoute(view: PlayerView): string | null {
  const official = view.activities.find((option) => option.id === OFFICIAL);
  if (official?.allowed !== true || official.params === null || official.params.length === 0) return null;
  const planned = view.plan.route ?? planRoute(view)?.id;
  return planned !== undefined && official.params.includes(planned) ? planned : (official.params[0] ?? null);
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

/** What is coming that Japa's reminders say: the plan's own waits, not an ask, a birthday or an age limit. */
type Reminder = Coming & { kind: "visa" | "paper" | "plan" };

function isReminder(item: Coming): item is Reminder {
  return item.kind === "visa" || item.kind === "paper" || item.kind === "plan";
}

/** A reminder as Japa shows it (R-TEXT-008): the thing in two or three words, and when, said once beside it. */
export interface ReminderRow {
  kind: Reminder["kind"];
  what: string;
  when: string;
}

function reminderWhat(item: Reminder): string {
  switch (item.kind) {
    case "visa":
      return phoneWords("phone.japa.visa");
    case "paper":
      return phoneWords("phone.japa.paper-ready", { paper: item.what });
    case "plan":
      return item.what;
    default: {
      const never: never = item.kind;
      return never;
    }
  }
}

/** Each reminder's icon: the stamp for the visa, the paper on its way, the plan's flag. */
const REMINDER_ICONS: Readonly<Record<Reminder["kind"], LucideIcon>> = { visa: Stamp, paper: FileClock, plan: Flag };

/** What is coming up: the city's one list (`comingOf`), in its order, kept to the plan's waits. */
export function remindersOf(view: PlayerView): ReminderRow[] {
  return comingOf(view)
    .filter(isReminder)
    .map((item) => ({ kind: item.kind, what: reminderWhat(item), when: inMonths(item.month, view.month) }));
}

/** A step, ticked or not; `way`: where an unticked step is taken, or when it comes, on a small line under it. */
function Step({ met, children, way }: { met: boolean; children: string; way?: string }) {
  return (
    <li className="flex items-start gap-2.5 py-1.5" data-met={met ? "true" : "false"}>
      {/* Done is the mark, with its word for a screen reader (R-TEXT-008); a step still to take is an empty ring. */}
      {met ? (
        <div className="mt-0.5 shrink-0">
          <Mark state="done" />
        </div>
      ) : (
        <Circle size={18} className="mt-0.5 shrink-0 text-text-2" aria-hidden />
      )}
      <span className="min-w-0">
        <span className={`block text-[14px] ${met ? "text-text-2" : ""}`}>{children}</span>
        {way === undefined ? null : (
          <span className="block text-[13px] text-text-2" data-step-way>
            {way}
          </span>
        )}
      </span>
    </li>
  );
}

/** Where an unticked step of the route is taken, from the route's words: the licence renewed at the clinic. */
function stepWay(route: Id<"route">, item: { id: string; met: boolean }): { way: string } | Record<string, never> {
  const key = `${route}.item.${item.id}.way`;
  return item.met || !hasWords(key) ? {} : { way: say(key) };
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

/** "Your plan: Care work in the UK", the route's name its own element, with the file its chapters build beneath. */
function PlanHead({ route }: { route: Id<"route"> }) {
  const [before = "", after = ""] = phoneWords("phone.japa.plan", { route: "\u0000" }).split("\u0000");
  return (
    <>
      <div className="title truncate text-[15px]" data-japa-plan={route}>
        {before}
        <span data-japa-route={route}>{nameOf(route)}</span>
        {after}
      </div>
      {hasWords(`${route}.file`) ? (
        <div className="text-[12px] font-bold opacity-85" data-japa-file>
          {say(`${route}.file`)}
        </div>
      ) : null}
    </>
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
  const [page, setPage] = useState<Id<"route"> | null>(null);
  // R-ADVICE-002: the official page can be read from the phone: it goes into the month like the hub's desk would put it.
  const addToPlan = useGame((state) => state.addToPlan);
  const send = useGame((state) => state.send);
  const plan = useGame((state) => state.plan);
  const said = use(PhoneSaid);
  const nav = use(PhoneNav);
  const openPapers = () => nav.openApp("papers");
  if (view.place.where === "abroad") return <Abroad view={view} onPapers={openPapers} />;
  if (page !== null) {
    return (
      <div data-phone-app="japa">
        <RoutePage route={page} onClose={() => setPage(null)} back={phoneWords("phone.app.japa")} onSaid={said} />
      </div>
    );
  }
  const route = planRoute(view);
  // R-CHAPTER-009: the head names the plan the chapters follow; with none, the way the nudge reads.
  const lean = view.plan.route;
  const head = lean === null ? headRoute(view) : (view.routes.find((each) => each.id === lean) ?? null);
  const others = lean === null ? [] : view.plan.ways.filter((way) => way.route !== lean);
  const costs = route === null ? [] : moveCosts(route);
  const lookInto = view.ended ? null : officialRoute(view);
  const planned = lookInto !== null && plan.some((pick) => pick !== null && pick.activity === OFFICIAL && pick.param === lookInto);
  // The plan's own figure while no route's figure counts yet, read as the data page reads it (R-CHAPTER-009).
  const percent = readyPercent(view);
  const coming = remindersOf(view);
  // Once a visa is granted the plan is done but the story is not: the next step, the plane, is named.
  const ahead = view.routes.some((candidate) => candidate.state === "granted") ? chapterAhead(view.chapter) : null;
  const next = ahead === null ? null : nextStepWords(ahead);
  // The page offered may be about another way than the plan's: then it stands under its own heading,
  // after the plan's costs, and names its route, so Canada is never offered under the UK.
  const otherWay = lookInto !== null && route !== null && lookInto !== (lean ?? route.id);
  const officialCard =
    lookInto === null ? null : (
      <button
        type="button"
        disabled={planned}
        // R-ACTIVITY-015: the official page is read at once, and the phone says the page's line.
        onClick={() => void actOnCard({ activity: OFFICIAL, param: lookInto }, { send, addToPlan }).then((acted) => said(acted === "planned" ? say("ui.world.planned", { what: nameOf(OFFICIAL) }) : acted === "full" ? say("ui.world.full") : acted === "answered" ? nowSaid(OFFICIAL, lookInto) : ""))}
        className="press mt-1 flex w-full items-center gap-2.5 rounded-[6px] border border-sheet-line bg-sheet-2 px-3 py-2.5 text-left disabled:opacity-70"
        data-official-page={lookInto}
        data-official-other={otherWay ? "true" : undefined}
      >
        <FileCheck size={18} className="shrink-0 text-text-2" aria-hidden />
        <span className="flex-1">
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 truncate text-[14px] font-bold">{otherWay ? say("ui.japa.official.title-route", { route: runningName(lookInto) }) : nameOf(OFFICIAL)}</span>
            {planned ? null : (
              <span className="shrink-0 rounded-[4px] bg-sheet-muted px-1.5 py-0.5 text-[12px] font-bold text-text-2" data-official-free>
                {phoneWords("phone.japa.official.free")}
              </span>
            )}
          </span>
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
          {lean === null || head === null ? (
            <div className="title truncate text-[15px]" data-japa-route={head?.id ?? ""}>
              {head === null ? phoneWords("phone.japa.none") : nameOf(head.id)}
            </div>
          ) : (
            <PlanHead route={head.id} />
          )}
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
      {ahead === null ? <ChapterSteps view={view} /> : null}
      {others.length === 0 ? null : (
        <div data-japa-others>
          <Head>{phoneWords("phone.japa.others")}</Head>
          <ul className="flex flex-col gap-1.5">
            {others.map((way) => (
              <li key={way.route}>
                <button type="button" onClick={() => setPage(way.route)} className="press flex w-full items-center gap-2.5 rounded-[6px] border border-sheet-line bg-sheet-2 px-3 py-2.5 text-left" data-other-way={way.route}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold">{nameOf(way.route)}</span>
                    <span className="block text-[13px] text-text-2">{say(`ui.route.state.${view.routes.find((held) => held.id === way.route)?.state ?? "heard"}`)}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-text-2" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {coming.length === 0 ? null : (
        <>
          <Head>{phoneWords("phone.japa.reminders")}</Head>
          <ul className="flex flex-col gap-1.5" data-reminders>
            {coming.map((row) => {
              const Icon = REMINDER_ICONS[row.kind];
              return (
                <li key={`${row.kind}-${row.what}`} className="flex items-center gap-2.5 rounded-[6px] bg-sheet-2 px-3 py-2" data-reminder={row.kind}>
                  <Icon size={18} className="shrink-0 text-strong" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-bold">{row.what}</span>
                  <span className="shrink-0 text-[13px] font-semibold text-text-2" data-reminder-when>
                    {row.when}
                  </span>
                </li>
              );
            })}
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
        {route === null || route.state === "heard"
          ? null
          : route.checklist.map((item) => (
              <Step key={item.id} met={item.met} {...stepWay(route.id, item)}>
                {checklistWords(route.id, item.id)}
              </Step>
            ))}
      </ul>
      <PapersButton view={view} onOpen={openPapers} />
    </div>
  );
}
