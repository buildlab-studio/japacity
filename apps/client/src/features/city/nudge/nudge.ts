// The nudge line's choice (world:nudge-says-one-thing): one thing to notice, from the view, in
// this order: an open set piece or interview question; an open offer; the chapter's next undone step
// in its own nudge words; a report line waiting on the player; else the month's end.
import { content } from "@japacity/content";
import { type DayPart, type Id, type PlayerView, qualityIn, withinMetres } from "@japacity/sim";

import { everyRouteClosed } from "../../../shared/words/closed";
import { shortfall as costShortfall } from "../../../shared/words/cost";
import { duesGap } from "../../../shared/words/dues";
import { formatMoney } from "../../../shared/words/format";
import { asksAttention, tidyLines } from "../../../shared/words/lines";
import { nextStepOf, ownRouteOf, ownWayOf, RACKS, RACKS_STEP, racksAtHand, wardMonths } from "../../../shared/words/sixteen";
import { routeKeptBy } from "../../../shared/words/keepJob";
import { sealedTillMorning } from "../../../shared/words/morning";
import { testChance } from "../../../shared/words/englishTest";
import { hasWords, inMonths, nameOf, say } from "../../../shared/words/text";
import type { Nudge } from "../../../shared/world/contract";

/** What the nudge points at, so a tap on it can open the matching sheet. `dues`: the month's dues abroad pass the money held; it opens the Bank. */
export type NudgeAbout = "setpiece" | "offer" | "step" | "report" | "dues" | "goal" | "end";

/**
 * Where a chapter's step is done (world:nudge-says-one-thing): the things that move it, as `<place>:<thing>` in
 * the order to prefer when more than one stands in the place, and the stop to ride to when none
 * does. `go` null: the step is done by ending the month.
 */
export interface StepWay {
  go: string | null;
  at: readonly string[];
  /** The step's own card, opened straight from its thing here instead of the thing's list. */
  opens?: string;
  /** The choice that card opens with: the life's own route on the official page. */
  param?: string;
  /**
   * The phone app the step is taken in, with `opens` its card there: Papers, for a paper asked for by a call or a message.
   * No ride: `go` is null and `at` empty.
   */
  app?: string;
}

const HUB_DESK: StepWay = { go: "place.yaba", at: ["place.yaba:desk", "place.ojuelegba:hub"] };
const MONTH_END: StepWay = { go: null, at: [] };
const FIRST_CHAPTER = "chapter.find-your-feet";
const OFFICIAL_PAGE = "activity.look-into-route";

/** A route's name after "the page on": its first letter lowered. */
function lowerFirst(words: string): string {
  return words.charAt(0).toLowerCase() + words.slice(1);
}
const CLINIC_DESK: StepWay = { go: "place.tb-clinic", at: ["place.tb-clinic:desk"] };
/** A paper asked for by a call or a message, from the phone's Papers app with its card open. */
function onThePhone(opens: string): StepWay {
  return { go: null, at: [], app: "papers", opens };
}
/** The passport is a visit to Immigration: the passport office's desk. */
const PASSPORT_DESK: StepWay = { go: "place.passport-office", at: ["place.passport-office:desk"], opens: "activity.get-passport" };
const VISA_DESK: StepWay = { go: "place.visa-centre", at: ["place.visa-centre:desk"] };
const POLICE_NOTICE: StepWay = { go: "place.visa-centre", at: ["place.visa-centre:police-notice"] };
const AGENT_DESK: StepWay = { go: "place.agent-office", at: ["place.agent-office:desk"] };

const STEP_WAYS: Record<string, StepWay> = {
  "chapter.find-your-feet.job": { go: "place.yaba", at: ["place.yaba:jobs", "place.ojuelegba:hub"] },
  "chapter.find-your-feet.pay": MONTH_END,
  // The meetup's own act, one tap, not its thing's chips.
  "chapter.find-your-feet.heard": { go: "place.yaba", at: ["place.yaba:meetup", "place.ojuelegba:hub"], opens: "activity.meetup" },
  "chapter.find-your-feet.known": HUB_DESK,
  "chapter.build-the-file.passport": PASSPORT_DESK,
  "chapter.build-the-file.transcript": onThePhone("activity.get-transcript"),
  "chapter.build-the-file.english": { go: "place.english-test-centre", at: ["place.english-test-centre:desk"] },
  "chapter.build-the-file.offer": { ...HUB_DESK, opens: "activity.apply-to-school" },
  "chapter.decision-day.deposit": { go: "place.olokun-office", at: ["place.olokun-office:counter"] },
  "chapter.decision-day.held": MONTH_END,
  "chapter.decision-day.tb": CLINIC_DESK,
  "chapter.decision-day.applied": VISA_DESK,
  "chapter.decision-day.granted": MONTH_END,
  // chapter:chapters-follow-lean-route: the file and decision day of each way out of the player's own effort.
  "chapter.build-the-file-care.tenure": MONTH_END,
  "chapter.build-the-file-care.verification": onThePhone("activity.request-verification"),
  "chapter.build-the-file-care.sponsor": HUB_DESK,
  // The care file's own detours, not items of the chapter (`careDetour`): the licence renewed, a sponsor at the bar, the window.
  "chapter.build-the-file-care.licence": onThePhone("activity.renew-licence"),
  "chapter.build-the-file-care.salary": HUB_DESK,
  "chapter.build-the-file-care.window": MONTH_END,
  "chapter.build-the-file-care.applied": VISA_DESK,
  "chapter.build-the-file-talent.portfolio": HUB_DESK,
  // The endorsement's own card at the desk, not the fifth thing under "Ask about routes".
  "chapter.build-the-file-talent.endorsement": { ...HUB_DESK, opens: "activity.apply-endorsement" },
  "chapter.build-the-file-talent.applied": VISA_DESK,
  "chapter.build-the-file-points.eca": onThePhone("activity.get-eca"),
  "chapter.build-the-file-points.english": { go: "place.english-test-centre", at: ["place.english-test-centre:desk"] },
  "chapter.build-the-file-points.pool": HUB_DESK,
  "chapter.build-the-file-points.invited": MONTH_END,
  "chapter.build-the-file-gulf.passport": PASSPORT_DESK,
  "chapter.build-the-file-gulf.medical": CLINIC_DESK,
  "chapter.build-the-file-gulf.agent": AGENT_DESK,
  "chapter.build-the-file-gulf.contract": AGENT_DESK,
  "chapter.decision-day-care.tb": CLINIC_DESK,
  "chapter.decision-day-care.police": POLICE_NOTICE,
  "chapter.decision-day-care.applied": VISA_DESK,
  "chapter.decision-day-care.granted": MONTH_END,
  "chapter.decision-day-talent.tb": CLINIC_DESK,
  "chapter.decision-day-talent.applied": VISA_DESK,
  "chapter.decision-day-talent.granted": MONTH_END,
  "chapter.decision-day-points.police": POLICE_NOTICE,
  "chapter.decision-day-points.applied": MONTH_END,
  "chapter.decision-day-points.granted": MONTH_END,
  "chapter.decision-day-gulf.police": POLICE_NOTICE,
  "chapter.decision-day-gulf.applied": AGENT_DESK,
  "chapter.decision-day-gulf.granted": MONTH_END,
  "chapter.send-off.departed": { go: "place.airport-lagos", at: ["place.airport-lagos:gate"] },
  // Abroad the steps are reached through `at` in the place the character stands. In London the job is got at the
  // notice or the agency in Peckham and also at each workplace's own door, desk or clock-in (world:ride-abroad-and-workplace), and
  // money home is sent from the phone or the transfer shop on Rye Lane.
  "chapter.landing.room": { go: "place.the-room", at: ["place.the-room:post"] },
  "chapter.landing.job": {
    go: "place.peckham",
    at: [
      "place.peckham:jobs-notice",
      "place.peckham:agency",
      "place.big-shop-uk:tills",
      "place.rye-lane:kitchen",
      "place.peckham-rye-station:courier",
      "place.care-home-uk:reception",
      "place.ward-uk:station",
      "place.warehouse-uk:clock-in",
      "place.office-uk:desk",
      // Calgary's jobs notice and its workplaces' doors, Dubai's typing centre and the site's post and trolley, the vans at
      // Castel Volturno's roundabout and the gangmaster's table in the fields (world:ride-abroad-and-workplace).
      "place.calgary-north-east:jobs-notice",
      "place.warehouse-canada:clock-in",
      "place.care-home-canada:reception",
      "place.office-canada:desk",
      "place.deira:agency",
      "place.site-uae:guard-post",
      "place.site-uae:cleaner-trolley",
      "place.castel-volturno:roundabout",
      "place.farm-italy:table",
    ],
  },
  // Money home from the country's counter (the room's phone only calls home, city:places-stage-their-acts): Rye Lane's transfer shop,
  // the strip mall's transfer counter, Deira's exchange house, Castel Volturno's call shop.
  "chapter.landing.request": { go: "place.rye-lane", at: ["place.rye-lane:transfer", "place.calgary-north-east:transfer", "place.deira:exchange", "place.castel-volturno:call-shop"] },
  "chapter.landing.file": MONTH_END,
  "chapter.landing.status": MONTH_END,
  "chapter.secure.secure": MONTH_END,
};

/** Where the money is when a step is short of it: the hub's jobs board. The funds step keeps its own way. */
export const BOARD_WAY: StepWay = { go: "place.yaba", at: ["place.yaba:jobs", "place.ojuelegba:hub"] };

/** The way to the chapter's next undone step, or null when the step has no place in the world (life abroad). */
export function stepWayOf(view: StepView & Partial<Pick<PlayerView, "obligations">>): StepWay | null {
  const step = stepOf(view);
  if (view.chapter.current === null || step === null) return null;
  // A life's own way to its first steps, where its archetype has one the table does not name.
  // While a life in Makoko's room has no job, the racks beside it come first (activity:fish-racks-at-makoko).
  if (racksAtHand(view)) return RACKS_WAY;
  // The first chapter's "Look into it" reads the page of the life's own way out, so a nurse leans to health care and not to the master's she read of first (chapter:chapters-follow-lean-route).
  // It comes before the life's own way to its first steps: that way names the hub's desk with no act, so a tap on the
  // nudge would offer the desk's chips (the course, the adviser's fee) in place of the free page.
  const route = ownRoute(view);
  // With no own route heard yet, the page still opens: its picker offers the routes heard (the developer's master's, Canada).
  if (view.chapter.current === FIRST_CHAPTER && step === "known") return { ...HUB_DESK, opens: OFFICIAL_PAGE, ...(route === null ? {} : { param: route }) };
  const own = ownWay(view);
  if (own !== null) return { go: own.place, at: [`${own.place}:${own.thing}`] };
  // The plane blocked by held funds: the way is the bank's counter that takes them back.
  if (view.chapter.current === "chapter.send-off" && step === "departed" && heldFundsOpen({ ...view, setpiece: null, interview: null, offers: [], report: null })) return HELD_FUNDS_WAY;
  // The file's detour, where the nudge names one.
  const detour = fileDetour(view, step);
  // The sponsor step while the care window is shut goes to what the file can still take.
  const shut = detour === null ? sponsorShutWay(view, step, []) : null;
  if (shut !== null) return shut;
  const key = detour ?? `${view.chapter.current}.${step}`;
  return inCountry(key, STEP_WAYS[key] ?? null, view.place);
}

/**
 * The stop the chapter's first undone step is taken at, from the tables, so the map never keeps shut the place the
 * nudge sends the player to (world:map-is-painted-lagos). Null when the step is the month's end.
 */
export function stepStopOf(chapter: Pick<PlayerView["chapter"], "current" | "items">): string | null {
  const step = chapter.items.find((item) => !item.met)?.id;
  return chapter.current === null || step === undefined ? null : (STEP_WAYS[`${chapter.current}.${step}`]?.go ?? null);
}

/** Where one item of a chapter is done, from the tables: the mission card names its place under it (the brief, docs/design/09-the-games-look.md section 4). */
export function itemWayOf(chapter: string, item: string): StepWay | null {
  return STEP_WAYS[`${chapter}.${item}`] ?? null;
}

/** The fish racks beside the room in Makoko, else the board in town that lists them too (activity:fish-racks-at-makoko). */
const RACKS_WAY: StepWay = { go: "place.makoko", at: ["place.makoko:racks", "place.yaba:jobs", "place.ojuelegba:hub"] };

/** Where held funds go back: the bank's counter (route:departure-pays-flight). */
const HELD_FUNDS_WAY: StepWay = { go: "place.olokun-office", at: ["place.olokun-office:clerk"] };

type StepView = Pick<PlayerView, "chapter"> & Partial<Pick<PlayerView, "scenario" | "qualities" | "pockets" | "routes" | "documents" | "job" | "activities" | "place">>;

/**
 * Where the landing chapter's steps are taken in each country abroad, so the nudge's way goes to the country's own stop
 * and not London's (world:ride-abroad-and-workplace): the job at Peckham's notice, Calgary's strip mall, Dubai's site (the
 * contract's job is held there from the first morning) or the roundabout at Castel Volturno where the vans come; money
 * home at Rye Lane, the strip mall, Deira or the roundabout's call shop.
 */
const LANDING_STOPS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "chapter.landing.job": { "country.uk": "place.peckham", "country.canada": "place.calgary-north-east", "country.uae": "place.site-uae", "country.italy": "place.castel-volturno" },
  "chapter.landing.request": { "country.uk": "place.rye-lane", "country.canada": "place.calgary-north-east", "country.uae": "place.deira", "country.italy": "place.castel-volturno" },
};

/** A step's way in the country the life is in: the landing's stops are the country's own; every other way as the table gives it. */
function inCountry(key: string, way: StepWay | null, place: StepView["place"]): StepWay | null {
  const stops = LANDING_STOPS[key];
  if (way === null || stops === undefined || place?.where !== "abroad" || place.country === null) return way;
  const go = stops[place.country];
  return go === undefined ? way : { ...way, go };
}

/** The chapter's next undone step: for a trader from sixteen with a shop's capital, the meetup and the page before the board. */
function stepOf(view: StepView): string | null {
  const { scenario, qualities, pockets } = view;
  if (scenario !== undefined && qualities !== undefined && pockets !== undefined) return nextStepOf({ chapter: view.chapter, scenario, qualities, pockets });
  return view.chapter.items.find((item) => !item.met)?.id ?? null;
}

/** The life's own way to a first step (the nurse's clinic, the trade's motor park), when the view carries enough to tell. */
function ownRoute(view: StepView): ReturnType<typeof ownRouteOf> {
  const { scenario, qualities, pockets } = view;
  if (scenario === undefined || qualities === undefined || pockets === undefined) return null;
  return ownRouteOf({ scenario, qualities, pockets, ...(view.routes === undefined ? {} : { routes: view.routes }) });
}

function ownWay(view: StepView): ReturnType<typeof ownWayOf> {
  const { scenario, qualities, pockets } = view;
  if (scenario === undefined || qualities === undefined || pockets === undefined) return null;
  return ownWayOf({ chapter: view.chapter, scenario, qualities, pockets, ...(view.routes === undefined ? {} : { routes: view.routes }), ...(view.documents === undefined ? {} : { documents: view.documents }), ...(view.job === undefined ? {} : { job: view.job }) });
}

/** The thing in `here` that the step's way names, the first of its order that stands among `things`. */
export function stepThingHere(way: StepWay, here: string | null, things: readonly { id: string }[]): string | null {
  for (const entry of way.at) {
    const [place, thing] = entry.split(":");
    if (place === here && things.some((candidate) => candidate.id === thing)) return thing ?? null;
  }
  return null;
}

/** The paper a step waits on, so a started step can name the wait (world:nudge-says-one-thing). */
const STEP_PAPER: Record<string, string> = {
  "chapter.build-the-file.passport": "document.passport",
  "chapter.build-the-file.transcript": "document.transcript",
  // The English result is a paper too: once sat, the nudge says when it comes.
  "chapter.build-the-file.english": "document.english-test",
  "chapter.decision-day.tb": "document.tb-certificate",
  // chapter:chapters-follow-lean-route: the papers of the other files.
  "chapter.build-the-file-care.verification": "document.nmcn-verification",
  "chapter.build-the-file-care.licence": "document.nursing-licence",
  "chapter.build-the-file-talent.endorsement": "document.endorsement",
  "chapter.build-the-file-points.eca": "document.eca",
  "chapter.build-the-file-points.english": "document.english-test",
  "chapter.build-the-file-gulf.passport": "document.passport",
  "chapter.build-the-file-gulf.medical": "document.medical",
  "chapter.decision-day-care.tb": "document.tb-certificate",
  "chapter.decision-day-care.police": "document.police-certificate",
  "chapter.decision-day-talent.tb": "document.tb-certificate",
  "chapter.decision-day-points.police": "document.police-certificate",
  "chapter.decision-day-gulf.police": "document.police-certificate",
};

/**
 * A step whose route can refuse it and make the player wait before asking again (route-gates:endorsement-decided-by-draw): the endorsement. While
 * the wait runs the step names when it opens again, never the act it shuts.
 */
const STEP_REFUSAL: Record<string, string> = {
  "chapter.build-the-file-talent.endorsement": "route.uk-talent",
};

/** The month a refused step can be asked for again, from the route's refusal in the view, or null when no wait runs. */
function refusalWait(view: NudgeView, stepKey: string): number | null {
  const route = STEP_REFUSAL[stepKey];
  const gate = route === undefined ? undefined : view.routes?.find((candidate) => candidate.id === route)?.gate;
  if (gate?.gate !== "endorsement" || gate.refusedMonth === null || gate.cooledFromMonth === null) return null;
  return gate.cooledFromMonth > (view.month ?? 0) ? gate.cooledFromMonth : null;
}

/**
 * The act that moves each quality a shut step needs, and where it is taken: the coding course
 * at the hub's desk for tech, the portfolio's work there for the pieces, the hub's meetup for the people who will write.
 */
const NEED_WAYS: Readonly<Record<string, StepWay>> = {
  "quality.tech": { go: "place.yaba", at: ["place.yaba:desk"], opens: "activity.learn-tech" },
  "quality.portfolio": { go: "place.yaba", at: ["place.yaba:desk"], opens: "activity.build-portfolio" },
  "quality.network": { go: "place.yaba", at: ["place.yaba:meetup"], opens: "activity.meetup" },
};

/** The act that builds a track record of months in a trade's jobs: the hunt for one, at the jobs board. */
const TENURE_WAY: StepWay = { go: "place.yaba", at: ["place.yaba:jobs", "place.ojuelegba:hub"], opens: "activity.job-hunt" };

/**
 * The first need a shut step's act is missing that has its own words and way (`<own>.needs.<quality>`), or null. A need
 * whose act is already in the month's plan, or carries on in it ("Ongoing", world:month-acts-carry-on), is passed over for the next
 * (so "Take the coding course at the hub" never stands while the course runs); with every need's act
 * planned, the plan is set and the step says to end the month (`<own>.needs.planned`).
 */
function needOf(
  missing: NonNullable<NudgeView["activities"]>[number]["missing"],
  own: string,
  has: (key: string) => boolean,
  planned: readonly string[] = [],
  job: string | null = null,
): { key: string; way?: StepWay } | null {
  let running = false;
  for (const requirement of missing) {
    // route-gates:applying-for-endorsement: the track record is months in the jobs it names: the hunt for one, or the months while one is held.
    if (requirement.type === "activity/tenure") {
      const key = `${own}.needs.tenure`;
      if (!has(key)) continue;
      if (job !== null && (requirement.activities as readonly string[]).includes(job)) return { key, way: MONTH_END };
      if (planned.includes(TENURE_WAY.opens!)) {
        running = true;
        continue;
      }
      return { key, way: TENURE_WAY };
    }
    if (requirement.type !== "quality/min") continue;
    const key = `${own}.needs.${requirement.quality}`;
    const way = NEED_WAYS[requirement.quality];
    if (way === undefined || !has(key)) continue;
    if (way.opens !== undefined && planned.includes(way.opens)) {
      running = true;
      continue;
    }
    return { key, way };
  }
  return running && has(`${own}.needs.planned`) ? { key: `${own}.needs.planned`, way: MONTH_END } : null;
}

/** The route the chapters follow, for the school's answer and the funds (chapter.md). */
const STORY_ROUTE = "route.uk-masters";

/** The activity that does a step, so a step planned this month or short of money can say so. */
export const STEP_ACTIVITY: Readonly<Record<string, string>> = {
  "chapter.find-your-feet.known": "activity.look-into-route",
  "chapter.find-your-feet.heard": "activity.meetup",
  "chapter.build-the-file.passport": "activity.get-passport",
  "chapter.build-the-file.transcript": "activity.get-transcript",
  "chapter.build-the-file.english": "activity.sit-english-test",
  "chapter.build-the-file.offer": "activity.apply-to-school",
  "chapter.decision-day.tb": "activity.tb-test",
  "chapter.decision-day.applied": "activity.apply-for-visa",
  "chapter.landing.job": "activity.job-hunt",
  // chapter:chapters-follow-lean-route: the acts of the other files.
  "chapter.build-the-file-care.verification": "activity.request-verification",
  "chapter.build-the-file-care.sponsor": "activity.find-sponsor",
  "chapter.build-the-file-care.licence": "activity.renew-licence",
  "chapter.build-the-file-care.salary": "activity.find-sponsor",
  "chapter.build-the-file-care.applied": "activity.apply-uk-care",
  "chapter.build-the-file-talent.portfolio": "activity.build-portfolio",
  "chapter.build-the-file-talent.endorsement": "activity.apply-endorsement",
  "chapter.build-the-file-talent.applied": "activity.apply-uk-talent",
  "chapter.build-the-file-points.eca": "activity.get-eca",
  "chapter.build-the-file-points.english": "activity.sit-english-test",
  "chapter.build-the-file-points.pool": "activity.enter-pool",
  "chapter.build-the-file-gulf.passport": "activity.get-passport",
  "chapter.build-the-file-gulf.medical": "activity.gulf-medical",
  "chapter.build-the-file-gulf.contract": "activity.apply-gulf-contract",
  "chapter.decision-day-care.tb": "activity.tb-test",
  "chapter.decision-day-care.police": "activity.get-police-certificate",
  "chapter.decision-day-care.applied": "activity.apply-uk-care",
  "chapter.decision-day-talent.tb": "activity.tb-test",
  "chapter.decision-day-talent.applied": "activity.apply-uk-talent",
  "chapter.decision-day-points.police": "activity.get-police-certificate",
  "chapter.decision-day-gulf.police": "activity.get-police-certificate",
  "chapter.decision-day-gulf.applied": "activity.apply-gulf-contract",
};

/** Other activities that also take a step when planned: the adviser's visit looks into the route. */
const STEP_ACTIVITY_ALSO: Record<string, readonly string[]> = {
  "chapter.find-your-feet.known": ["activity.see-adviser"],
  // A trade hears of its way out at the motor park.
  "chapter.find-your-feet.heard": ["activity.ask-around"],
};

type NudgeView = Pick<PlayerView, "setpiece" | "interview" | "offers" | "chapter" | "report"> & Partial<Pick<PlayerView, "documents" | "routes" | "month" | "activities" | "pockets" | "place" | "obligations" | "job" | "scenario" | "qualities" | "goals" | "plan" | "rates">>;

/** A result sealed until the world's next morning (clock:envelopes-show-real-waits, decision 0011): "Comes in the morning". */
export const MORNING = "ui.wait.morning";

/** The nudge that sends a waiting life to the board for better pay. */
export const BETTER_JOB = "ui.nudge.better-job";
/** Held funds still open block the plane. */
const HELD_FUNDS = "held-funds";

const NURSE_JOB = "activity.job-nurse";
/** The nurse's certification as a waiting-month act (activity:waiting-months-build-profile). */
const CERTIFICATION = "nurse-certification";

/**
 * The waiting months' acts by profile (activity:waiting-months-build-profile): the act a life with nothing else to do is pointed at, where it is
 * offered and not yet planned. The nurse's certification is one: the care file counts the certificate (route-gates:care-route-needs-verification
 *), so the waiting months name it while she can pay it, and its gap while she cannot (world:nudge-says-one-thing).
 */
/** What a waiting-month act reads of the view. */
type MeanwhileView = Partial<Pick<PlayerView, "activities" | "qualities" | "documents" | "job">>;

const MEANWHILE: readonly { act: string; fits: (view: MeanwhileView) => boolean }[] = [
  { act: CERTIFICATION, fits: (view) => qualityIn(view, "quality.care") >= 50 && (view.documents ?? []).some((paper) => paper.id === "document.nursing-licence" && paper.state === "held") },
  { act: "open-source", fits: (view) => qualityIn(view, "quality.tech") >= 40 },
  { act: "tech-posts", fits: (view) => qualityIn(view, "quality.tech") >= 30 },
  // Not for the staff nurse: getting noticed counts toward the study visa and Canada's points, never health care, and her
  // ward is the clinic, never the hub's board. The act stays on the hub's board alone (city:places-stage-their-acts).
  { act: "be-noticed", fits: (view) => (view.job?.months ?? 0) >= 6 && view.job?.id !== NURSE_JOB },
];

/** Where each waiting-month act is taken. */
export const MEANWHILE_WAYS: Readonly<Record<string, StepWay>> = {
  // The certification's own card on the clinic's notice, one tap (as the meetup's).
  [CERTIFICATION]: { go: "place.tb-clinic", at: ["place.tb-clinic:jobs-notice"], opens: "activity.nurse-certification" },
  "open-source": { go: "place.yaba", at: ["place.yaba:desk"] },
  "tech-posts": { go: "place.yaba-hub", at: ["place.yaba-hub:laptops"] },
  "be-noticed": { go: "place.yaba", at: ["place.yaba:jobs"] },
};


/** The short id of the waiting-month act that fits this life and stands open this month, or null. */
function meanwhileOf(view: MeanwhileView, planned: readonly string[]): string | null {
  for (const { act, fits } of MEANWHILE) {
    const id = `activity.${act}`;
    const option = view.activities?.find((candidate) => candidate.id === id);
    if (option !== undefined && option.allowed && !planned.includes(id) && fits(view)) return act;
  }
  return null;
}

type Said = { key: string; params?: Record<string, string | number>; way?: StepWay };

/**
 * The waiting-month act's nudge: its own words while the naira held pays it, else its gap and a way to the money, never the
 * act (world:nudge-says-one-thing: a step the player cannot pay says the shortfall). Null: no act fits, or no words.
 */
function meanwhileSaid(view: NudgeView, planned: readonly string[], has: (key: string) => boolean): Said | null {
  const act = meanwhileOf(view, planned);
  if (act === null) return null;
  const key = `ui.nudge.meanwhile.${act}`;
  const option = view.activities?.find((candidate) => candidate.id === `activity.${act}`);
  if (option !== undefined && !option.affordable) return shortfall(view, option, key, planned, has, MONTH_END);
  return has(key) ? { key } : null;
}

/**
 * An act the naira held cannot pay: the gap and a way to it, instead of the act: once a hunt for
 * better pay is planned it says so, and once the job's pay covers the gap within a month it says to work and save,
 * with `saving` as its way when given. Null when the naira held covers the act or content has no words for the gap.
 */
function shortfall(view: NudgeView, option: NonNullable<NudgeView["activities"]>[number], own: string, planned: readonly string[], has: (key: string) => boolean, saving?: StepWay): Said | null {
  const naira = option.cost.filter((cost) => cost.currency === "NGN").reduce((sum, cost) => sum + cost.amount, 0);
  const held = (view.pockets?.NGN.bank ?? 0) + (view.pockets?.NGN.cash ?? 0);
  if (option.affordable || naira <= held) return null;
  if (planned.includes("activity.job-hunt")) return { key: "ui.nudge.hunt-planned" };
  // What next month leaves: the pay less the month's bills. Only when that closes the gap is "work and save" true.
  const pay = view.job?.id === null || view.job?.id === undefined ? 0 : monthlyNaira(view.job.id);
  if (pay - nairaDues(view) >= naira - held && has(`${own}.saving`)) return { key: `${own}.saving`, ...(saving === undefined ? {} : { way: saving }) };
  // The gap's way is the jobs board, where the money is: the City reads it from the `.short` words.
  if (has(`${own}.short`)) return { key: `${own}.short`, params: { amount: formatMoney(naira - held, "NGN") } };
  return null;
}

const CARE_ROUTE = "route.uk-care";
/** The care file and its decision day (chapter:chapters-follow-lean-route). */
const CARE_CHAPTERS: ReadonlySet<string> = new Set(["chapter.build-the-file-care", "chapter.decision-day-care"]);
const TENURE = "tenure";
const LICENCE_STEP = "chapter.build-the-file-care.licence";
const WINDOW_STEP = "chapter.build-the-file-care.window";
const PASSPORT_STEP = "chapter.build-the-file.passport";
const ENGLISH_STEP = "chapter.build-the-file.english";
const VERIFICATION_STEP = "chapter.build-the-file-care.verification";
const CARE_TB_STEP = "chapter.decision-day-care.tb";
/**
 * What the care visa needs before it is sent, in the route's checklist order (route.data.ts), each as the tables' step
 * that gets it. The TB certificate is not among them: it lasts six months, so it is taken last, once nothing else is
 * missing and the window is open.
 */
const CARE_PAPERS: readonly { item: string; step: string }[] = [
  { item: "passport", step: PASSPORT_STEP },
  { item: "english", step: ENGLISH_STEP },
  { item: "police", step: "chapter.decision-day-care.police" },
  { item: "salary", step: "chapter.build-the-file-care.salary" },
];

type CareView = Pick<PlayerView, "chapter"> & Partial<Pick<PlayerView, "routes" | "documents" | "activities">>;

/** The words of a tables' step: `chapter.x.step` reads `chapter.x.item.step`. */
function wordsOf(stepKey: string): string {
  const cut = stepKey.lastIndexOf(".");
  return `${stepKey.slice(0, cut)}.item.${stepKey.slice(cut + 1)}`;
}

/**
 * The step the nudge names in place of the chapter's own, as the tables' step key, or null for the chapter's own: the
 * care file's (`careDetour`), and the talent file's passport before its TB test, which the test needs (the TB test is
 * never pointed at before the file's other steps are met).
 */
function fileDetour(view: CareView, step: string): string | null {
  if (view.chapter.current === TALENT_DAY && step === "tb") {
    const talent = view.routes?.find((route) => route.id === TALENT_ROUTE);
    return talent?.checklist.find((item) => item.id === "passport")?.met === false ? PASSPORT_STEP : null;
  }
  return talentDetour(view, step) ?? careDetour(view, step);
}

const TALENT_ROUTE = "route.uk-talent";
const TALENT_DAY = "chapter.decision-day-talent";
const TALENT_FILE = "chapter.build-the-file-talent";
const TALENT_TB_STEP = "chapter.decision-day-talent.tb";
const ENDORSEMENT_STEP = "chapter.build-the-file-talent.endorsement";
const TALENT_APPLIED_STEP = "chapter.build-the-file-talent.applied";
const ENDORSE = "activity.apply-endorsement";
const TB_TEST = "activity.tb-test";
const APPLY_TALENT = "activity.apply-uk-talent";

/**
 * The talent file's papers in the order they must be met and paid for: the passport first, at its
 * office, whenever it can be got; the endorsement only once the passport is held (its own step, `talentShort` and the
 * closed words keep it until the rest can follow within its three months); then the TB test, and the application last.
 * While the passport is on its way the file's own work goes on (the portfolio, the endorsement's needs), and the step
 * waits on the passport only when nothing else of the file can be done. Null: the chapter's own step.
 */
function talentDetour(view: CareView, step: string): string | null {
  if (view.chapter.current !== TALENT_FILE) return null;
  const talent = view.routes?.find((route) => route.id === TALENT_ROUTE);
  if (talent === undefined) return null;
  const unmet = (item: string): boolean => talent.checklist.find((one) => one.id === item)?.met === false;
  if (unmet("passport")) {
    const pending = (view.documents?.find((held) => held.id === "document.passport")?.onItsWay ?? null) !== null;
    if (!pending) return PASSPORT_STEP;
    if (step === "portfolio") return null;
    const endorse = view.activities?.find((option) => option.id === ENDORSE);
    const working = endorse !== undefined && !endorse.allowed && endorse.missing.some((requirement) => requirement.type === "quality/min");
    return step === "endorsement" && working ? null : PASSPORT_STEP;
  }
  if (step === "applied" && unmet("tb") && talent.window !== "closed") return TALENT_TB_STEP;
  return null;
}

/** True when the route's window is what shuts the act: the news has closed the way (route:closed-window-blocks-applying). */
function closedBy(option: NonNullable<NudgeView["activities"]>[number]): boolean {
  return option.missing.some((requirement) => requirement.type === "var/min" && WINDOW_VARS.has(requirement.var));
}

/** The routes' window variables, from content (route:closed-window-blocks-applying): the road has none. */
const WINDOW_VARS: ReadonlySet<string> = new Set(Object.values(content.route).flatMap((route) => (route?.window === null || route?.window === undefined ? [] : [route.window])));

/** A closed way says so plainly and opens Japa, where the same is said: no desk is offered an act it cannot take. */
const CLOSED_WAY: StepWay = { go: null, at: [], app: "japa" };
export const EVERY_ROUTE_CLOSED = "ui.nudge.closed.every";

/** The closed words for a step whose act the window shuts: every route closed, else this way's own words. Null: no words. */
function closedSaid(view: NudgeView, own: string, has: (key: string) => boolean): Said | null {
  if (everyRouteClosed(view) && has(EVERY_ROUTE_CLOSED)) return { key: EVERY_ROUTE_CLOSED, way: CLOSED_WAY };
  return has(`${own}.closed`) ? { key: `${own}.closed`, way: CLOSED_WAY } : null;
}

/**
 * What the talent file still has to pay once a step is taken: the endorsement is asked for only when the
 * TB test and the application can follow within its three months, so its step counts all three; the application its
 * own fee. A paper already held is not paid again.
 */
const TALENT_COSTS: Readonly<Record<string, readonly string[]>> = {
  [ENDORSEMENT_STEP]: [ENDORSE, TB_TEST, APPLY_TALENT],
  [TALENT_APPLIED_STEP]: [APPLY_TALENT],
};

/**
 * The talent step's gap: the naira the file's costs from here need at the bank now, with its charge, against what is
 * held (cost.ts, wallet:foreign-fee-payment-order). The hunt planned says so; else the gap, whose way is the jobs board. Null: no gap.
 */
function talentShort(view: NudgeView, own: string, stepKey: string, planned: readonly string[], has: (key: string) => boolean): Said | null {
  const acts = TALENT_COSTS[stepKey];
  if (acts === undefined || view.pockets === undefined || view.rates === undefined || view.activities === undefined) return null;
  const tbHeld = view.routes?.find((route) => route.id === TALENT_ROUTE)?.checklist.find((item) => item.id === "tb")?.met === true;
  const costs = acts.filter((act) => !(act === TB_TEST && tbHeld)).flatMap((act) => view.activities?.find((option) => option.id === act)?.cost ?? []);
  const gap = costShortfall({ pockets: view.pockets, rates: view.rates }, costs);
  if (gap.short === 0) return null;
  if (planned.includes("activity.job-hunt")) return { key: "ui.nudge.hunt-planned" };
  return has(`${own}.short`) ? { key: `${own}.short`, params: { amount: formatMoney(gap.short, "NGN") } } : null;
}

/**
 * The care file's step the nudge names in place of the chapter's own, as the tables'
 * step key, or null for the chapter's own. A lapsed licence's renewal comes first in any month of the file. In the months
 * on the ward, the passport. While the council works, the passport, then the English test. At the application, and at
 * the decision day's TB step, each thing the visa needs in the route's order: the first that can be got now, else the
 * first on its way, else the window's wait, and only then the TB test.
 */
function careDetour(view: CareView, step: string): string | null {
  if (!CARE_CHAPTERS.has(view.chapter.current ?? "")) return null;
  const care = view.routes?.find((route) => route.id === CARE_ROUTE);
  if (care === undefined) return null;
  const { unmet, pending, now } = carePapers(view, care);
  if (unmet("licence")) return LICENCE_STEP;
  if (step === TENURE) return now("passport", PASSPORT_STEP) ? PASSPORT_STEP : null;
  if (step === "verification" && pending(VERIFICATION_STEP)) return [{ item: "passport", step: PASSPORT_STEP }, { item: "english", step: ENGLISH_STEP }].find((paper) => now(paper.item, paper.step))?.step ?? null;
  if (step !== "applied" && step !== "tb") return null;
  const missing = CARE_PAPERS.filter((paper) => unmet(paper.item));
  const first = missing.find((paper) => now(paper.item, paper.step)) ?? missing.find((paper) => pending(paper.step)) ?? missing[0];
  if (first !== undefined) return first.step;
  if (care.window === "closed") return WINDOW_STEP;
  return step === "applied" && unmet("tb") ? CARE_TB_STEP : null;
}

/** How the care file's papers stand: an item unmet, a step's paper on its way, an item that can be got now. */
function carePapers(view: CareView, care: PlayerView["routes"][number]): { unmet: (item: string) => boolean; pending: (stepKey: string) => boolean; now: (item: string, stepKey: string) => boolean } {
  const unmet = (item: string): boolean => care.checklist.find((one) => one.id === item)?.met === false;
  const pending = (stepKey: string): boolean => {
    const paper = STEP_PAPER[stepKey];
    return paper !== undefined && (view.documents?.find((held) => held.id === paper)?.onItsWay ?? null) !== null;
  };
  const open = (stepKey: string): boolean => view.activities?.find((option) => option.id === STEP_ACTIVITY[stepKey])?.allowed === true;
  return { unmet, pending, now: (item, stepKey) => unmet(item) && !pending(stepKey) && open(stepKey) };
}

const SPONSOR = "sponsor";
/** The care file's own papers, in the route's order: what the shut sponsor step can still send her to. */
const FILE_PAPERS: readonly { item: string; step: string }[] = [
  { item: "passport", step: PASSPORT_STEP },
  { item: "english", step: ENGLISH_STEP },
];
/** The sponsor step's words while the care window is shut (world:nudge-says-one-thing). */
const SPONSOR_SHUT = "chapter.build-the-file-care.item.sponsor.shut";

/**
 * The way the shut sponsor step's nudge opens: no sponsor takes a nurse from abroad while the care
 * window is shut, so the tap goes to the file's own next paper that can be got now, the passport, then the English test;
 * never the decision day's papers, which run out (the TB test lasts six months, the police paper twelve: taken last)
 * and wait at the visa centre the map opens with that chapter (world:map-is-painted-lagos); else the waiting-month act she can pay, else
 * the month's end. Null: the sponsor step is not shut, or this is not the care file.
 */
function sponsorShutWay(view: CareView & MeanwhileView & Partial<Pick<PlayerView, "pockets">>, step: string, planned: readonly string[]): StepWay | null {
  if (view.chapter.current !== "chapter.build-the-file-care" || step !== SPONSOR) return null;
  const care = view.routes?.find((route) => route.id === CARE_ROUTE);
  if (care === undefined || care.window !== "closed") return null;
  const { now } = carePapers(view, care);
  const paper = FILE_PAPERS.find((one) => now(one.item, one.step) && !planned.includes(STEP_ACTIVITY[one.step] ?? ""));
  if (paper !== undefined) return STEP_WAYS[paper.step] ?? MONTH_END;
  const act = meanwhileOf(view, planned);
  const affordable = view.activities?.find((option) => option.id === `activity.${act ?? ""}`)?.affordable === true;
  return act !== null && affordable ? (MEANWHILE_WAYS[act] ?? MONTH_END) : MONTH_END;
}

/** True while funds held for the visa are still to be given back. */
function heldFundsOpen(view: NudgeView): boolean {
  return (view.obligations ?? []).some((owed) => content.obligation[owed.entry]?.type === HELD_FUNDS);
}

/** True when the jobs board holds a job that pays more a month than the one held, and the one held is not one a way out counts the months of. */
function betterJobOnBoard(view: NudgeView): boolean {
  const held = view.job?.id ?? null;
  if (held === null) return false;
  if (view.job !== undefined && routeKeptBy({ job: view.job, ...(view.routes === undefined ? {} : { routes: view.routes }) }) !== null) return false;
  const pay = monthlyNaira(held);
  const listed = view.activities?.find((option) => option.id === "activity.job-hunt")?.params ?? [];
  return listed.some((job) => monthlyNaira(job) > pay);
}

/** A job's pay a month in naira, as the hunt's card says it; nothing for pay in another money. */
function monthlyNaira(job: string): number {
  const pay = content.activity[job as Id<"activity">]?.pay ?? null;
  return pay === null || pay.currency !== "NGN" || typeof pay.amount !== "number" ? 0 : pay.amount;
}

/** The month's naira bills at its end: the upkeep, a savings circle's share, a loan's instalment. */
function nairaDues(view: NudgeView): number {
  return (view.obligations ?? []).reduce((sum, owed) => (owed.due > 0 && content.obligation[owed.entry]?.currency === "NGN" ? sum + owed.due : sum), 0);
}

/**
 * A step whose act is planned or done this month, or whose paper or school's answer is on its way, is taken: it waits on the month's end, so
 * its way is the month's (world:nudge-says-one-thing). No marker or chip stands on the thing that took it, and the nudge's tap opens the Calendar, until a
 * month in which it is not taken: a hunt that missed brings the marker back the month after.
 */
function taken(key: string): { key: string; way: StepWay } {
  return { key, way: MONTH_END };
}

/**
 * A step already started names the wait instead of the thing to do again:
 * a paper on its way says when, a school applied to says when it answers, a hunt or a test planned
 * says to end the month, funds short of the line say how much more to show, and a step refused says when it can be
 * asked for again. Null: not started.
 */
function startedKey(view: NudgeView, own: string, stepKey: string, plannedOnly: readonly string[], has: (key: string) => boolean): { key: string; params?: Record<string, string | number>; way?: StepWay } | null {
  const month = view.month ?? 0;
  // An act done at once this month (activity:now-acts-and-month-acts) waits on the month's end as a planned one does; the view marks it `done`.
  const done: readonly string[] = (view.activities ?? []).filter((option) => option.done).map((option) => option.id);
  const planned: readonly string[] = [...plannedOnly, ...done];
  // A now-act's "planned" words would read wrong once it is done: its own done words first, then the generic line.
  const doneKey = (key: string): string | null => (has(`${key}.done`) ? `${key}.done` : has("ui.nudge.done-now") ? "ui.nudge.done-now" : null);
  // A refusal's wait comes first: the step cannot be taken again until it is out (route-gates:endorsement-decided-by-draw).
  const wait = refusalWait(view, stepKey);
  if (wait !== null && has(`${own}.wait`)) return { key: `${own}.wait`, params: { when: inMonths(wait, month) } };
  const paper = STEP_PAPER[stepKey];
  // A result sealed until the morning (clock:envelopes-show-real-waits) says when it comes, and nothing else to do for it.
  if (paper !== undefined && sealedTillMorning(view, paper) && has(MORNING)) return { key: MORNING };
  if (paper !== undefined) {
    const held = view.documents?.find((document) => document.id === paper);
    if (held !== undefined && held.onItsWay !== null) {
      // A hunt planned while working says so; a wait is a saving month: the board's better job
      // comes before "work and save"; else the archetype's own act for the wait (activity:waiting-months-build-profile).
      if (planned.includes("activity.job-hunt") && (view.job?.id ?? null) !== null) return { key: "ui.nudge.hunt-planned" };
      if (betterJobOnBoard(view) && has(BETTER_JOB)) return { key: BETTER_JOB };
      const meanwhile = meanwhileSaid(view, planned, has);
      if (meanwhile !== null) return meanwhile;
      if (has(`${own}.started`)) return { ...taken(`${own}.started`), params: { when: inMonths(held.onItsWay, month) } };
    }
  }
  // The trader's shop planned at her stall (activity:trader-opens-own-shop): the job step has no hunt to name, so its own planned words say it.
  if (stepKey === "chapter.find-your-feet.job" && planned.includes("activity.open-shop") && has(`${own}.planned.open-shop`)) return taken(`${own}.planned.open-shop`);
  const activity = STEP_ACTIVITY[stepKey];
  if (activity !== undefined) {
    // Planned this month: the step waits on the month's end, not on another tap.
    if (done.includes(activity)) {
      if (has(`${own}.started`)) return taken(`${own}.started`);
      const key = doneKey(own);
      if (key !== null) return taken(key);
    }
    if (planned.includes(activity)) {
      if (has(`${own}.planned`)) return taken(`${own}.planned`);
      if (has(`${own}.started`)) return taken(`${own}.started`);
    }
    // Another act that takes the step is planned or done: its own words where content has them.
    const also = (STEP_ACTIVITY_ALSO[stepKey] ?? []).find((other) => planned.includes(other));
    if (also !== undefined) {
      const short = also.replace(/^activity\./, "");
      if (done.includes(also)) {
        const key = doneKey(`${own}.${short}`) ?? doneKey(own);
        if (key !== null) return taken(key);
      }
      if (has(`${own}.planned.${short}`)) return taken(`${own}.planned.${short}`);
      if (has(`${own}.planned`)) return taken(`${own}.planned`);
    }
    // The act is shut by what it needs (the endorsement before the portfolio and the people who will write): its own
    // needs words, so the nudge never points at an act the player cannot see.
    const shutOption = view.activities?.find((candidate) => candidate.id === activity);
    if (shutOption !== undefined && !shutOption.allowed) {
      // The first unmet need names its own act and opens it: never "needs more" with no act.
      const need = needOf(shutOption.missing, own, has, planned, view.job?.id ?? null);
      if (need !== null) return need;
      // The news has closed the way: said plainly, never "needs more" over a list with every need done.
      const closed = closedBy(shutOption) ? closedSaid(view, own, has) : null;
      if (closed !== null) return closed;
      if (has(`${own}.needs`)) return { key: `${own}.needs` };
    }
    // The talent file's step is taken only when what must follow it can be paid.
    const fileShort = talentShort(view, own, stepKey, planned, has);
    if (fileShort !== null) return fileShort;
    // Short of money: the nudge names the gap and a way to it, instead of the thing again.
    const option = view.activities?.find((candidate) => candidate.id === activity);
    const short = option === undefined ? null : shortfall(view, option, own, planned, has);
    if (short !== null) return short;
  }
  const route = view.routes?.find((candidate) => candidate.id === STORY_ROUTE);
  if (stepKey === "chapter.build-the-file.offer") {
    const applied = route?.schools.find((school) => school.state === "pending") ?? null;
    if (applied !== null && has(`${own}.started`)) return { ...taken(`${own}.started`), params: { when: inMonths(applied.readyMonth, month) } };
    return null;
  }
  if (stepKey === "chapter.decision-day.held" && route !== undefined && !route.funds.covered && route.funds.required > route.funds.shown && has(`${own}.short`)) {
    return { key: `${own}.short`, params: { amount: formatMoney(route.funds.required - route.funds.shown, "GBP") } };
  }
  if (stepKey === "chapter.find-your-feet.job" && planned.includes("activity.job-hunt") && has(`${own}.started`)) return taken(`${own}.started`);
  // The plane waits on the held funds: the nudge says what blocks it.
  if (stepKey === "chapter.send-off.departed" && heldFundsOpen(view) && has(`${own}.blocked`)) return { key: `${own}.blocked` };
  if (stepKey === "chapter.build-the-file.english" && planned.includes("activity.sit-english-test") && has(`${own}.started`)) return taken(`${own}.started`);
  // A long shot at the band: the nudge says to study first, as the test's sheet does, instead of sending the player to pay
  // for a sitting they will most likely fail, sitting after sitting at the fee.
  if ((stepKey === "chapter.build-the-file.english" || stepKey === "chapter.build-the-file-points.english") && view.qualities !== undefined && !planned.includes("activity.sit-english-test")) {
    const study = view.activities?.find((candidate) => candidate.id === "activity.study-english");
    if (study?.allowed === true && testChance({ qualities: view.qualities, plan: view.plan }).band === "long") {
      if (planned.includes("activity.study-english") && has(`${own}.study.planned`)) return { key: `${own}.study.planned` };
      if (has(`${own}.study`)) return { key: `${own}.study` };
    }
  }
  return null;
}

/**
 * Where the character stands and the stops the map shows, each with its position, so the nudge can tell a stop on foot
 * from one that needs a fare. `home` is the home stop of the city.
 */
export interface Reach {
  here: string;
  home: string | null;
  stops: readonly { id: string; position: { latE3: number; lonE3: number } }[];
}

const MAKOKO = "place.makoko";
/** The stops whose jobs board takes a hunt (BOARD_WAY's places). */
const BOARD_STOPS: readonly string[] = BOARD_WAY.at.map((entry) => entry.split(":")[0] ?? "");

/** The country a life abroad is in, or null at home and on the road. */
function abroadIn(view: NudgeView): string | null {
  return view.place?.where === "abroad" ? (view.place.country ?? null) : null;
}

/**
 * The metres a thousandth of a degree of longitude is worth where the character is (place:rides-between-city-places): the country's
 * own abroad, as the ride sheet and the simulation read it, else Lagos's.
 */
function lonMetresHere(view: NudgeView): number {
  const { ride } = content.tuning.city;
  const country = abroadIn(view);
  return (country === null ? undefined : ride.abroad[country as keyof typeof ride.abroad]?.lonMetresPerE3) ?? ride.lonMetresPerE3;
}

/** True when the stop is where the character stands, or close enough to walk to (world:ride-sheet-shows-fares's walking distance). */
function onFoot(view: NudgeView, reach: Reach, to: string): boolean {
  if (to === reach.here) return true;
  const from = reach.stops.find((stop) => stop.id === reach.here)?.position;
  const there = reach.stops.find((stop) => stop.id === to)?.position;
  return from !== undefined && there !== undefined && withinMetres(from, there, content.tuning.city.ride.walkMetres, lonMetresHere(view));
}

/** The money a fare is paid from where the character is, cash and bank together: the country's own abroad, naira at home. */
function heldForFare(view: NudgeView): number {
  const country = abroadIn(view);
  const currency = country === null ? "NGN" : (content.country[country as keyof typeof content.country]?.currency ?? "NGN");
  const pocket = view.pockets?.[currency];
  return (pocket?.cash ?? 0) + (pocket?.bank ?? 0);
}

/** The offers answered in a place of the city: the send-off at home, the parcel at the cargo office (streets:parcels-shipped-home). */
export const OFFER_PLACES: Readonly<Record<string, string>> = { "offer.family-send-off": "place.family-house", "offer.parcel-shipped": "place.bode-thomas" };

/** True when every open offer waits in a place that is a ride away and the money held pays no fare. */
function offersOutOfReach(view: NudgeView, reach: Reach): boolean {
  if (heldForFare(view) >= cheapestFare(view, reach)) return false;
  return view.offers.every((offer) => {
    const at = OFFER_PLACES[offer.entry];
    return at !== undefined && at !== reach.here && !onFoot(view, reach, at);
  });
}

/**
 * The cheapest ride this month from where the character stands, in the smallest unit of the money it is paid in
 * (place:rides-between-city-places): at home the ways' flat fare under the month's fares; abroad the country's ways' flat fare,
 * nothing for a way the month's pass covers (place:country-pass-covers-ways) or from a stop the employer's shuttle serves
 * (place:employer-shuttle-rides-free), the scarcity being Lagos's alone.
 */
function cheapestFare(view: NudgeView, reach: Reach): number {
  const { ride } = content.tuning.city;
  const country = abroadIn(view);
  if (country !== null) {
    if ((view.place?.shuttles ?? []).some((stop) => stop === reach.here)) return 0;
    const listed = (view.place?.ways ?? []).filter((way) => way.way !== "walk");
    const ways = listed.length > 0 ? listed.map((way) => (way.passed ? 0 : way.fare)) : Object.values(ride.abroad[country as keyof typeof ride.abroad]?.ways ?? {}).map((way) => way.fare);
    return Math.min(...ways);
  }
  const fares = Object.entries(ride.fareKobo).filter(([way, fare]) => way !== "walk" && fare > 0).map(([, fare]) => fare);
  const bp = view.place?.fareBp ?? 10_000;
  return Math.floor((Math.min(...fares) * bp) / 10_000);
}

/**
 * When nothing can be paid, a free step: the step's stop needs a fare the money held (naira at home, the country's money
 * abroad) cannot pay and is too far to walk, so the nudge names what can be done on foot instead: walking home whenever home
 * is not here, however far (with no fare in hand a life may walk home, world:ride-sheet-shows-fares), then the racks for a
 * life in Makoko with no job, a job on a board within reach, and with no home the month's end. Null when the step can be
 * reached, at home by the long walk out (with no fare in hand a life may walk out of home however far).
 */
export function freeStep(view: NudgeView & StepView, reach: Reach, has: (key: string) => boolean = hasWords): (Nudge & { about: NudgeAbout; way: StepWay }) | null {
  if (heldForFare(view) >= cheapestFare(view, reach)) return null;
  const way = stepWayOf(view);
  if (way === null || way.go === null) return null;
  if (way.at.some((entry) => entry.startsWith(`${reach.here}:`)) || onFoot(view, reach, way.go)) return null;
  const jobless = (view.job?.id ?? null) === null;
  const board = view.activities?.find((option) => option.id === "activity.job-hunt")?.params ?? [];
  if (reach.home !== null && reach.home !== reach.here && has("ui.nudge.broke.home")) return { key: "ui.nudge.broke.home", about: "step", way: { go: reach.home, at: [] } };
  if (jobless && board.includes(RACKS) && onFoot(view, reach, MAKOKO) && has("ui.nudge.broke.racks")) return { key: "ui.nudge.broke.racks", about: "step", way: RACKS_WAY };
  if (jobless && board.length > 0 && BOARD_STOPS.some((stop) => onFoot(view, reach, stop)) && has("ui.nudge.broke.job")) return { key: "ui.nudge.broke.job", about: "step", way: BOARD_WAY };
  // At home with nothing free near, the step itself: with no fare the long walk out of home reaches it, as the long walk
  // home does (place:rides-between-city-places). Away from home the walk home comes first, above; with no home, the month's end.
  if (reach.home !== null && reach.home === reach.here) return null;
  if (has("ui.nudge.broke.wait")) return { key: "ui.nudge.broke.wait", about: "end", way: { go: null, at: [] } };
  return null;
}

/**
 * `has`: whether words exist for a key; content's and the interface's tables unless a test says otherwise. `planned`: the
 * activities in this month's plan. `reach`: where the character stands, for the free step when nothing can be paid.
 */
export function nudgeOf(view: NudgeView, has: (key: string) => boolean = hasWords, planned: readonly string[] = [], newsRead = false, reach?: Reach): Nudge & { about: NudgeAbout; way?: StepWay } {
  if (view.setpiece !== null || (view.interview?.question ?? null) !== null) return { key: "ui.nudge.setpiece", about: "setpiece" };
  // Abroad, whenever the month's dues pass the country's money held, the gap comes before the step;
  // and before any ask when one more missed instalment ends the visa.
  const { place, pockets, obligations } = view;
  const gap = place === undefined || pockets === undefined || obligations === undefined ? null : duesGap({ place, pockets, obligations, ...(view.job === undefined ? {} : { job: view.job }) });
  const visaAtStake = gap !== null && (obligations ?? []).some((owed) => owed.entry === "obligation.tuition" && owed.missed >= 1 && owed.due > 0);
  if (visaAtStake && has("ui.nudge.dues-visa")) return { key: "ui.nudge.dues-visa", params: { due: formatMoney(gap.due, gap.currency), held: formatMoney(gap.held, gap.currency) }, about: "dues" };
  // An offer answered in a place of the city (the parcel at the cargo office) does not lead while nothing can be paid and
  // that place is a ride away: the nudge would send a broke life to a fare it cannot pay, every month (world:nudge-says-one-thing).
  if (view.offers.length > 0 && !(reach !== undefined && offersOutOfReach(view, reach))) return { key: "ui.nudge.offer", about: "offer" };
  if (gap !== null) return { key: "ui.nudge.dues", params: { due: formatMoney(gap.due, gap.currency), held: formatMoney(gap.held, gap.currency) }, about: "dues" };
  // Nothing can be paid and the step's stop is a ride away: a free step on foot comes first.
  const free = reach === undefined ? null : freeStep(view, reach, has);
  if (free !== null) return free;
  // While a life in Makoko's room has no job, the racks beside it come before any other step (activity:fish-racks-at-makoko).
  // A hunt applied for at once (activity:now-acts-and-month-acts) or planned takes the step as any job's does: the wait, not the racks again.
  if (racksAtHand(view)) return { ...(startedKey(view, `${FIRST_CHAPTER}.item.job`, `${FIRST_CHAPTER}.job`, planned, has) ?? { key: RACKS_STEP }), about: "step" };
  const step = stepOf(view);
  if (view.chapter.current !== null && step !== null) {
    const care = CARE_CHAPTERS.has(view.chapter.current);
    // In the months on the ward, the certification comes first while she can sit it: the care file counts it
    // (route-gates:care-route-needs-verification). Short of its fee, the gap.
    if (care && step === TENURE && meanwhileOf(view, planned) === CERTIFICATION) {
      const said = meanwhileSaid(view, planned, has);
      if (said !== null) return { ...said, about: "step" };
    }
    // The care file's detour names its own step in its own words.
    const detour = fileDetour(view, step);
    // While the care window is shut no sponsor takes her: the sponsor step says so and its tap goes to what the file can still take.
    const shut = detour === null && has(SPONSOR_SHUT) ? sponsorShutWay(view, step, planned) : null;
    if (shut !== null) return { key: SPONSOR_SHUT, about: "step", way: shut };
    // The story's own nudge words for the step when content has them (at most eight words), else the step's words.
    const own = detour === null ? `${view.chapter.current}.item.${step}` : wordsOf(detour);
    const started = startedKey(view, own, detour ?? `${view.chapter.current}.${step}`, planned, has);
    if (started !== null) return { ...started, about: "step" };
    // The months on the ward, counted, when there is nothing else of hers to do.
    const count = care && step === TENURE && detour === null ? wardMonths(view) : null;
    if (count !== null && has(`${own}.count`)) return { key: `${own}.count`, params: { done: count.done, need: count.need }, about: "step" };
    // A hunt missed last month: the nudge names another job on the board too.
    if (step === "job" && (view.report?.lines ?? []).some((line) => line.key === "line.activity.hunt-missed") && (view.activities?.find((option) => option.id === "activity.job-hunt")?.params?.length ?? 0) > 1 && has(`${own}.nudge.again`)) return { key: `${own}.nudge.again`, about: "step" };
    // The life's own way to the step has its own words (the nurse's clinic, the trade's motor park).
    const way = ownWay(view);
    if (way !== null && has(`${own}.nudge.${way.key}`)) return { key: `${own}.nudge.${way.key}`, about: "step" };
    // "Look into it" names the page of the life's own way out (chapter:chapters-follow-lean-route), read in Japa, one tap away wherever she
    // stands, never a ride to the hub: `.needs` words open Japa, as the needs do.
    const route = view.chapter.current === FIRST_CHAPTER && step === "known" ? ownRoute(view) : null;
    if (route !== null && has(`${own}.own.needs`)) return { key: `${own}.own.needs`, params: { route: has(`${route}.short`) ? say(`${route}.short`) : lowerFirst(nameOf(route)) }, about: "step" };
    if (route !== null && has(`${own}.nudge.own`)) return { key: `${own}.nudge.own`, params: { route: lowerFirst(nameOf(route)) }, about: "step" };
    return { key: has(`${own}.nudge`) ? `${own}.nudge` : own, about: "step" };
  }
  // A report line waits when one of last month's lines asks for the player. Abroad, when the month's
  // dues pass the country's money held, that line says the gap.
  // Once News has been read for this month's report, the line waits no more.
  if (!newsRead && view.report !== null && tidyLines(view.report.lines).some(asksAttention)) return { key: "ui.nudge.report", about: "report" };
  // A chapter with every item met closes when the month ends: say that, never a goal's act over it.
  if (view.chapter.current !== null && has("ui.nudge.chapter-done")) return { key: "ui.nudge.chapter-done", about: "end" };
  // With no chapter step left, the nearest open goal names its first act (goal:view-shows-goal-items).
  const goal = view.goals?.open.find((open) => open.items.some((item) => !item.met) && has(`${open.id}.first`));
  if (goal !== undefined) return { key: `${goal.id}.first`, about: "goal" };
  return { key: "ui.nudge.end", about: "end" };
}

/** The night's nudge (clock:game-day-on-real-time; world:sleep-ends-the-month; decision 0011). */
export const NIGHT = "ui.nudge.night";

/**
 * The nudge as the world's part of the day reads it: at night, when the body is tired, "Night. Go to bed", unless something
 * more pressing waits on the player (a question asked, a person asking), which the night never covers. A night the body can
 * still take is the player's (nobody is forced to bed; the night has its own things open), so the
 * nudge stands as it was. By day nothing changes.
 */
export function atNight<N extends Nudge & { about: NudgeAbout }>(nudge: N | null, part: DayPart, tired: boolean): N | (Nudge & { about: NudgeAbout }) | null {
  if (part !== "night" || !tired || nudge === null || nudge.about === "setpiece" || nudge.about === "offer") return nudge;
  return { key: NIGHT, about: "end" };
}
