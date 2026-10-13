// Japa (docs/rules/world.md R-WORLD-018, 019): the plan as steps with how ready you are, the japacity
// figure as a bar that fills (never a percentage on screen), the road's log of briefs handed by the shell (the plan 16),
// the route's steps, the papers as a step with their state, and what is coming up (the visa
// decision, a paper's ready month). The Papers screen inside shows what is in the box under the
// bed; the papers themselves are a thing at home. Once a visa is granted it names the next step;
// after the flight it shows the visa held, what it lets you do, and the landing's steps. The head names
// the plan the chapters follow with its file, and each other way heard of opens its page with the switch
// (docs/rules/chapter.md R-CHAPTER-009).
import { content } from "@japacity/content";
import type { Currency, Id, PlayerView, RouteView } from "@japacity/sim";
import { Check, ChevronRight, Circle, FileClock, Flag, Stamp, type LucideIcon } from "lucide-react";
import { type ReactNode, use, useState } from "react";

import { useGame, useView } from "../../../authority/GameProvider";
import { PhoneNav } from "../../../shared/phone/nav";
import { Mark } from "../../../shared/ui/Mark";
import { actOnCard, nowSaid } from "../../../shared/words/acts";
import { formatMoney } from "../../../shared/words/format";
import { type Coming, comingOf } from "../../../shared/words/coming";
import { everyRouteClosed } from "../../../shared/words/closed";
import { checklistWords } from "../../../shared/words/requirement";
import { readyPercent } from "../../../shared/words/ready";
import { planRoute } from "../../../shared/words/savings";
import { wardMonths } from "../../../shared/words/sixteen";
import { blurbOf, hasWords, inMonths, nameOf, runningName, say, sayCount, words } from "../../../shared/words/text";
import { Head, PhoneSaid } from "../act";
import { phoneWords } from "../phone.words";
import { PicCard, PicTile, WordChip } from "../ui";
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
  const entry = current === null ? undefined : content.chapter[current];
  if (current === null || entry?.variantOf === undefined) return null;
  const ward = wardMonths(view);
  const route = entry.route === undefined ? undefined : view.routes.find((held) => held.id === entry.route);
  const papers = FILE_PAPERS[current] ?? [];
  return (
    <div data-chapter-steps={current}>
      <Head>{nameOf(current)}</Head>
      <ul className="lively-card flex flex-col divide-y divide-sheet-line py-1">
        {chapter.items.flatMap((item) => {
          const own = `${current}.item.${item.id}`;
          // The months on the ward, counted while they run.
          const counted = !item.met && item.id === "tenure" && ward !== null && hasWords(`${own}.japa`);
          const wait = item.met ? null : councilWait(view, own);
          // The papers the file needs before this step, ticked as the route's checklist ticks them.
          const before = route === undefined ? [] : papers.filter((paper) => paper.before === item.id).flatMap((paper) => route.checklist.filter((one) => one.id === paper.item));
          return [
            ...before.map((paper) => (
              <Step key={paper.id} met={paper.met} {...stepWay(route!.id, paper)}>
                {words(`${current}.item.${paper.id}`)}
              </Step>
            )),
            <Step key={item.id} met={item.met} {...(wait === null ? {} : { way: wait })}>
              {counted ? say(`${own}.japa`, { done: ward.done, need: ward.need }) : words(own)}
            </Step>,
          ];
        })}
      </ul>
    </div>
  );
}

/**
 * The papers a way's file needs that are not steps of its chapter, each listed before the step it must come before, in
 * the order they are got: the passport first, the TB test last, just before the application.
 */
const FILE_PAPERS: Readonly<Record<string, readonly { item: string; before: string }[]>> = {
  "chapter.build-the-file-talent": [
    { item: "passport", before: "endorsement" },
    { item: "tb", before: "applied" },
  ],
};

/** The way the plan follows closed by the news, said once under the head: every route, or this one. */
function ClosedLine({ view, route }: { view: PlayerView; route: RouteView | null }) {
  if (route === null || route.window !== "closed") return null;
  const every = everyRouteClosed(view);
  return (
    <p className="lively-card mt-2 px-3.5 py-2.5 text-[15px] font-bold text-out" data-japa-closed={every ? "every" : route.id}>
      {phoneWords(every ? "phone.japa.closed.every" : "phone.japa.closed")}
    </p>
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
    .map((item) => ({ kind: item.kind, what: reminderWhat(item), when: item.when ?? inMonths(item.month, view.month) }));
}

/** A step, ticked or not; `way`: where an unticked step is taken, or when it comes, on a small line under it. */
function Step({ met, children, way }: { met: boolean; children: string; way?: string }) {
  return (
    <li className="flex items-start gap-2.5 px-3 py-2" data-met={met ? "true" : "false"}>
      {/* Done is the mark, with its word for a screen reader (R-TEXT-008); a step still to take is an empty ring. */}
      {met ? (
        <div className="mt-0.5 shrink-0">
          <Mark state="done" />
        </div>
      ) : (
        <Circle size={18} className="mt-0.5 shrink-0 text-text-2" aria-hidden />
      )}
      <span className="min-w-0">
        <span className={`block text-[15px] font-semibold ${met ? "text-text-2" : ""}`}>{children}</span>
        {way === undefined ? null : (
          <span className="block text-[13px] text-text-2" data-step-way>
            {way}
          </span>
        )}
      </span>
    </li>
  );
}

/**
 * Where an unticked step of the route is taken, from the route's words: the licence renewed at the clinic (the eleventh
 * review), each need of the endorsement's own act and place. A paper that runs out says
 * for how long it holds, from its entry (`{months}`: the TB certificate's six).
 */
export function stepWay(route: Id<"route">, item: { id: string; met: boolean }): { way: string } | Record<string, never> {
  const key = `${route}.item.${item.id}.way`;
  if (item.met || !hasWords(key)) return {};
  const requirement = content.route[route]?.checklist.find((one) => one.id === item.id)?.requirement;
  const months = requirement?.type === "document/held" ? (content.document[requirement.document]?.validMonths ?? null) : null;
  return { way: say(key, months === null ? {} : { months }) };
}

function NextStep({ step }: { step: string }) {
  return (
    <p className="lively-card phone-picked mt-2 flex items-center gap-2 px-3.5 py-2.5 text-[15px] font-bold" data-japa-next>
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
      <PicCard
        pic="place.airport-lagos"
        tint="money"
        over={afterWords("phone.japa.visa.label")}
        title={held === null ? afterWords("phone.japa.visa.none") : nameOf(held.entry)}
        chips={held === null ? null : <WordChip tone="study">{held.monthsLeft === null ? say("ui.status.no-end") : sayCount("ui.status.months-left", held.monthsLeft, { months: held.monthsLeft })}</WordChip>}
        data-japa-visa={held?.entry ?? ""}
      />
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
          <ul className="lively-card flex flex-col divide-y divide-sheet-line py-1">
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
      <div className="text-[20px] leading-tight font-bold" data-japa-plan={route}>
        {before}
        <span data-japa-route={route}>{nameOf(route)}</span>
        {after}
      </div>
      {hasWords(`${route}.file`) ? (
        <div className="mt-0.5 text-[13px] font-semibold text-text-2" data-japa-file>
          {say(`${route}.file`)}
        </div>
      ) : null}
    </>
  );
}

function PapersButton({ view, onOpen }: { view: PlayerView; onOpen: () => void }) {
  const held = view.documents.filter((paper) => paper.state === "held").length;
  return (
    <button type="button" onClick={onOpen} className="lively-card press mt-3 flex w-full items-center gap-3 p-3 text-left" data-open-papers>
      <PicTile of="thing.papers-box" size={48} tint="plain" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[16px] font-bold">
          {phoneWords("phone.japa.papers")}
          {view.documents.length > 0 && held === view.documents.length ? <Check size={18} className="shrink-0 text-in" aria-hidden /> : null}
        </span>
        <span className="block text-[14px] text-text-2">{view.documents.length === 0 ? phoneWords("phone.japa.papers.none") : phoneWords("phone.japa.papers.line", { held, count: view.documents.length })}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-text-2" aria-hidden />
    </button>
  );
}

/** How ready the character is to go, as a bar that fills (the japacity figure; R-WORLD-019): never a percentage on screen. */
function ReadyMeter({ percent }: { percent: number }) {
  return (
    <div className="mt-2" data-japa-percent={percent}>
      <p className="text-[14px] text-text-2" data-japa-gloss>
        {phoneWords("phone.japa.gloss")}
      </p>
      <div className="phone-meter mt-1 h-3 w-full overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={phoneWords("phone.japa.gloss")}>
        <span style={{ width: `${String(Math.max(4, Math.min(100, percent)))}%` }} />
      </div>
    </div>
  );
}

export function Japa({ briefs = null }: { briefs?: ReactNode }) {
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
        className="lively-card press mt-3 flex w-full items-center gap-3 p-3 text-left disabled:opacity-70"
        data-official-page={lookInto}
        data-official-other={otherWay ? "true" : undefined}
      >
        <PicTile of={OFFICIAL} size={48} tint="study" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="min-w-0 text-[16px] font-bold">{otherWay ? say("ui.japa.official.title-route", { route: runningName(lookInto) }) : nameOf(OFFICIAL)}</span>
            {planned ? null : (
              <span className="sticker-chip shrink-0 bg-tint-money" style={{ rotate: "-2deg", color: "var(--money-ink)" }} data-official-free>
                {phoneWords("phone.japa.official.free")}
              </span>
            )}
          </span>
          <span className="block text-[14px] text-text-2">{phoneWords(planned ? "phone.japa.official-planned" : "phone.japa.official", { route: runningName(lookInto) })}</span>
        </span>
        {planned ? <Check size={18} className="shrink-0 text-in" aria-hidden /> : <ChevronRight size={18} className="shrink-0 text-text-2" aria-hidden />}
      </button>
    );
  return (
    <div data-phone-app="japa">
      {/* The way out as a card: its picture, "Your way out", the way's name and its file, and how
          ready the character is to go as a bar that fills, never a percentage. */}
      <div className="lively-card p-3.5" data-japa-head>
        <div className="flex items-start gap-3">
          <PicTile of={head === null ? "place.airport-lagos" : head.id} size={60} tint="money" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-text-2" data-japa-label>
                {phoneWords("phone.japa.label")}
              </span>
              <span className="sticker-chip shrink-0 bg-tint-money" style={{ rotate: "3deg", color: "var(--money-ink)" }}>
                {say("ui.brief.road")}
              </span>
            </div>
            {lean === null || head === null ? (
              <div className="text-[20px] leading-tight font-bold" data-japa-route={head?.id ?? ""}>
                {head === null ? phoneWords("phone.japa.none") : nameOf(head.id)}
              </div>
            ) : (
              <PlanHead route={head.id} />
            )}
          </div>
        </div>
        {/* The figure's one name says once what it means, where the figure shows. */}
        {percent === null ? null : <ReadyMeter percent={percent} />}
      </div>
      {/* The header names the route; the figure's route is said again only when it is another. */}
      {view.japacity.route === null || view.japacity.route === head?.id ? null : <p className="mt-1 text-[12px] text-text-2">{say("ui.japacity.of", { route: runningName(view.japacity.route) })}</p>}
      {next === null ? null : <NextStep step={next} />}
      <ClosedLine view={view} route={head} />
      {briefs}
      {ahead === null ? <ChapterSteps view={view} /> : null}
      {others.length === 0 ? null : (
        <div data-japa-others>
          <Head>{phoneWords("phone.japa.others")}</Head>
          <ul className="grid grid-cols-2 gap-2.5">
            {others.map((way) => (
              <li key={way.route}>
                <button type="button" onClick={() => setPage(way.route)} className="lively-card press flex h-full w-full flex-col items-start gap-2 p-2.5 text-left" data-other-way={way.route}>
                  <PicTile of={way.route} size={52} tint="study" />
                  <span className="text-[15px] leading-tight font-bold">{nameOf(way.route)}</span>
                  <span className="sticker-chip bg-tint-study" style={{ rotate: "-1.5deg" }}>
                    {say(`ui.route.state.${view.routes.find((held) => held.id === way.route)?.state ?? "heard"}`)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {coming.length === 0 ? null : (
        <>
          <Head>{phoneWords("phone.japa.reminders")}</Head>
          <ul className="flex flex-col gap-2" data-reminders>
            {coming.map((row) => {
              const Icon = REMINDER_ICONS[row.kind];
              return (
                <li key={`${row.kind}-${row.what}`} className="lively-card flex items-center gap-3 px-3 py-2.5" data-reminder={row.kind}>
                  <span className="phone-pic flex size-10 shrink-0 items-center justify-center bg-tint-study" aria-hidden>
                    <Icon size={20} className="text-text" />
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] font-bold">{row.what}</span>
                  <span className="sticker-chip shrink-0 bg-[var(--soft)]" style={{ rotate: "2deg", color: "var(--soft-ink)" }} data-reminder-when>
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
          <dl className="lively-card flex flex-col px-3.5 py-1.5" data-move-costs>
            {costs.map((cost) => (
              <div key={cost.key} className={`flex items-baseline justify-between gap-3 py-1.5 text-[15px] ${cost.key === "ui.japa.cost.funds" ? "border-t border-sheet-line font-bold" : ""}`} data-cost={cost.key}>
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
      <ul className={`flex flex-col ${route === null || route.state === "heard" ? "" : "lively-card divide-y divide-sheet-line py-1"}`} data-steps>
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
