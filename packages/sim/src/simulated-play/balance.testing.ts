// The lives and the plays of scenario:economy-meets-its-targets (docs/design/13-the-economy.md section 2): every fixed life and a
// life built from each archetype's preset, each in the trade it stays in, toward the ways out that fit the trade.
import { divCeil, divFloor, mulDiv } from "../engine/int";
import type { BaseEvent, Content, Id, PlayerView } from "../engine/types";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { applyEffects } from "../testing/route.journey";
import type { RunRecord, TradeName } from "./players";
import { runLife, tradeOfJob } from "./players";

const MASTERS: Id<"route"> = "route.uk-masters";
const CARE: Id<"route"> = "route.uk-care";
const TALENT: Id<"route"> = "route.uk-talent";
const CANADA: Id<"route"> = "route.canada-points";
const GULF: Id<"route"> = "route.gulf-contract";

/** The trades of design page 13 section 2's table, each with its cheap band in months to the first flight. */
export type BandTrade = "nurse" | "teacher" | "support" | "shop" | "fish" | "banker" | "accountant" | "developer" | "graduate";

export const CHEAP_BAND: Record<BandTrade, [number, number]> = {
  nurse: [18, 36],
  teacher: [48, 60],
  support: [24, 36],
  shop: [18, 30],
  fish: [18, 30],
  banker: [36, 48],
  accountant: [36, 54],
  developer: [18, 36],
  graduate: [36, 54],
};

export interface BalanceLife {
  name: string;
  scenario: Id<"scenario">;
  /** The archetype whose preset answers the prologue, for a life built from sixteen. */
  preset: string | null;
  /** The home the door picks for the preset. */
  home: string;
  band: BandTrade;
  /** The trade the life stays in, its ladder and side job. */
  trade: TradeName;
  /** The cheapest ways that fit the trade (design page 13 section 2), the first made the plan: the ways a player who stays in the trade works. */
  routes: Id<"route">[];
  /** The trade's fallback, taken up once the cheap band's months have passed without a flight. */
  fallback?: { route: Id<"route">; after: number };
}

/** Every fixed life and the archetypes' lives (scenario:economy-meets-its-targets), each in its trade with the ways the table gives it. */
export const BALANCE_LIVES: BalanceLife[] = [
  // The Gulf's nursing offers are the nurse's fallback: taken up once the cheap band has passed with no trust's post.
  { name: "nurse", scenario: "scenario.nurse", preset: null, home: "family-house", band: "nurse", trade: "nurse", routes: [CARE], fallback: { route: GULF, after: CHEAP_BAND.nurse[1] } },
  { name: "teacher", scenario: "scenario.teacher", preset: null, home: "family-house", band: "teacher", trade: "teacher", routes: [CANADA] },
  { name: "graduate", scenario: "scenario.graduate", preset: null, home: "family-house", band: "graduate", trade: "support", routes: [CANADA] },
  { name: "banker", scenario: "scenario.banker", preset: null, home: "family-house", band: "banker", trade: "bank", routes: [CANADA] },
  { name: "developer", scenario: "scenario.developer", preset: null, home: "family-house", band: "developer", trade: "developer", routes: [CANADA, TALENT] },
  { name: "accountant", scenario: "scenario.prologue", preset: "accountant", home: "family-house", band: "accountant", trade: "accounting", routes: [CANADA] },
  { name: "writer", scenario: "scenario.prologue", preset: "writer", home: "family-house", band: "teacher", trade: "teacher", routes: [CANADA] },
  { name: "trader", scenario: "scenario.prologue", preset: "trader", home: "family-house", band: "shop", trade: "shop", routes: [GULF] },
  { name: "shop-worker", scenario: "scenario.prologue", preset: "shop-worker", home: "family-house", band: "shop", trade: "shop", routes: [GULF] },
  { name: "water", scenario: "scenario.prologue", preset: "water", home: "makoko", band: "fish", trade: "fish", routes: [GULF] },
  // A graduate who takes the customer service job: the writer's degree from sixteen, on the support ladder.
  { name: "support", scenario: "scenario.prologue", preset: "writer", home: "family-house", band: "support", trade: "support", routes: [GULF, CANADA] },
];

// ---------------------------------------------------------------------------
// The plays
// ---------------------------------------------------------------------------

/** The styles the balance test plays: the strategies' own and the three of scenario:economy-meets-its-targets. */
export type BalanceStyle = "trade-loyal" | "free-pivot" | "paid-pivot" | "careful" | "borrower" | "risky" | "canada";

export const BALANCE_STYLES: BalanceStyle[] = ["trade-loyal", "free-pivot", "paid-pivot", "careful", "borrower", "risky", "canada"];

/** The golden world, and the world whose pound runs away (scenario:economy-meets-its-targets). */
export const GOLDEN_WORLD = "golden-world";
export const CRASH_WORLD = "world-b";

const SEEDS = 20;
const MONTHS = 96;
/** The months a student flown late plays on past the 96, so a course begun in them can be passed (status:graduate-visa-applied-for: course month 13). */
const STUDENT_MONTHS = 18;
/** The months a careful life plays on abroad, so the month's keep is read in a settled job. */
const MONTHS_TO_KEEP = 6;
/** The month the crash measure reads (the tenth measure). */
const CRASH_MONTH = 36;
/** Naira, in kobo, under which offer.md calls a character broke at home. */
const BROKE_BELOW = 15000000;

const STUDY_ACTS: Id<"activity">[] = ["activity.learn-free", "activity.online-course", "activity.tech-diploma", "activity.bootcamp", "activity.free-internship", "activity.learn-tech"];
const GRADUATE: Id<"status"> = "status.uk-graduate";
/** A formal employer's job the review is read on. */
const REVIEWED_JOB: Id<"activity"> = "activity.job-customer-service";

export interface Withdrawal {
  /** The month of the first missed payment of the run of misses. */
  firstMiss: number;
  month: number;
  /** A reminder, the cut with the plan offered, the final warning, then the withdrawal, in that order. */
  followed: boolean;
}

export interface BalanceRun {
  life: string;
  band: BandTrade;
  style: BalanceStyle;
  world: string;
  seed: string;
  startedDeveloper: boolean;
  departed: number | null;
  flown: Id<"route"> | null;
  /** The trade of the job held at home in the last month before the flight. */
  flightTrade: TradeName | null;
  /** For a master's student: whether the Graduate status was reached, and each withdrawal. */
  student: { graduate: boolean; withdrawals: Withdrawal[] } | null;
  /** For a life that starts under tech 30: the first study path, the month it began and the month tech reached 30, if it did. */
  tech: { path: Id<"activity">; from: number; ready: number | null } | null;
  /** The longest run of month ends under the broke line. */
  brokeRun: number;
  /** For a careful life abroad on a work status: what a month keeps and the fees it meets, in the local currency's smallest unit. */
  sinks: { keep: number; settle: number | null; renew: number | null; citizen: number | null } | null;
}

/** Answers a prologue card as an archetype's preset does, from content (prologue:archetype-presets-answers). */
export type PresetAnswer = (preset: string, home: string, step: string, answers: readonly { id: string; allowed: boolean }[]) => string | null;

function isBroke(view: PlayerView, content: Content): boolean {
  if (view.place.where !== "abroad") return view.pockets.NGN.bank + view.pockets.NGN.cash < BROKE_BELOW;
  const country = view.place.country;
  const currency = country === null ? undefined : content.country[country]?.currency;
  if (currency === undefined || currency === "NGN") return false;
  const pocket = view.pockets[currency];
  const due = view.obligations.reduce((sum, item) => sum + (content.obligation[item.entry]?.currency === currency ? item.due : 0), 0);
  return pocket.bank + pocket.cash < due;
}

/** The fees a settled life abroad meets, read from the world's variables by country. */
function feesOf(view: PlayerView, game: Game): { settle: number | null; citizen: number | null } {
  const vars = game.world().vars as Record<string, number | undefined>;
  if (view.place.country === "country.uk") return { settle: vars["var.uk-settle-fee"] ?? null, citizen: vars["var.uk-citizen-fee"] ?? null };
  if (view.place.country === "country.canada") return { settle: null, citizen: vars["var.canada-citizen-fee"] ?? null };
  return { settle: null, citizen: null };
}

/** What a month abroad keeps: the job's pay as the wallet books it, less the month's dues in the local currency. */
function keepOf(view: PlayerView, content: Content): number | null {
  const country = view.place.country;
  const currency = country === null ? undefined : content.country[country]?.currency;
  if (currency === undefined || currency === "NGN") return null;
  const pay = [view.job.pay, view.job.sidePay].reduce((sum, item) => sum + (item !== null && item.currency === currency ? item.amount : 0), 0);
  const due = view.obligations.reduce((sum, item) => sum + (content.obligation[item.entry]?.currency === currency ? item.due : 0), 0);
  return pay - due;
}

/** One life under one style in one world on one seed, read into what the measures need. */
export function playBalance(content: Content, preset: PresetAnswer, life: BalanceLife, style: BalanceStyle, world: string, n: number): BalanceRun {
  const seed = `balance-${life.name}-${String(n)}`;
  const pivot = style === "free-pivot" || style === "paid-pivot";
  const tradeStyle = style === "trade-loyal" || pivot;
  // A pivot works toward the developer's ways out as well as its trade's.
  const routes = pivot ? [...new Set([...life.routes, CANADA, TALENT])] : life.routes;
  const run: BalanceRun = {
    life: life.name,
    band: life.band,
    style,
    world,
    seed,
    startedDeveloper: life.trade === "developer",
    departed: null,
    flown: null,
    flightTrade: null,
    student: null,
    tech: null,
    brokeRun: 0,
    sinks: null,
  };
  let homeJob: string | null = null;
  let broke = 0;
  let startTech: number | null = null;
  let played: Record<string, number> = {};
  let firstMiss: number | null = null;
  let stages: string[] = [];
  const crash = world === CRASH_WORLD;
  const stopAt = (game: Game, record: RunRecord): boolean => {
    const view = game.view();
    const month = game.state.turn.month;
    broke = isBroke(view, content) ? broke + 1 : 0;
    run.brokeRun = Math.max(run.brokeRun, broke);
    if (game.state.place.where === "home" && record.departed === null) homeJob = game.state.activity.job;
    // The tech pace (the eighth measure): from the first month of study to the month tech reaches 30.
    const tech = game.state.quality["quality.tech"] ?? 0;
    if (startTech === null && !game.state.prologue.open) startTech = tech;
    const now = game.state.activity.played;
    const studied = STUDY_ACTS.find((id) => (now[id] ?? 0) > (played[id] ?? 0));
    played = { ...now };
    if (startTech !== null && startTech < 30 && run.tech === null && studied !== undefined) run.tech = { path: studied, from: month, ready: null };
    if (run.tech !== null && run.tech.ready === null && tech >= 30) run.tech.ready = month;
    if (crash) return record.departed !== null || month >= CRASH_MONTH;
    if (record.departed === null) return month >= MONTHS;
    if (record.flown === MASTERS && (style === "careful" || style === "risky" || style === "borrower")) {
      const held = game.state.status.current?.entry ?? null;
      run.student ??= { graduate: false, withdrawals: [] };
      if (held === GRADUATE) run.student.graduate = true;
      return held === GRADUATE || game.state.place.where !== "abroad" || month >= record.departed + STUDENT_MONTHS;
    }
    if (style === "careful" && month >= record.departed + MONTHS_TO_KEEP) {
      const keep = keepOf(view, content);
      const status = view.status;
      if (keep !== null && status !== null && status.work !== "cash" && game.state.place.where === "abroad") {
        run.sinks = { keep, ...feesOf(view, game), renew: status.renew === null ? null : status.renew.fee + status.renew.surcharge };
      }
      return true;
    }
    return style !== "careful";
  };
  const { record } = runLife(style, life.scenario, seed, content, {
    months: crash ? CRASH_MONTH : MONTHS + STUDENT_MONTHS,
    worldSeed: world,
    ...(tradeStyle ? { play: { trade: life.trade, routes, plan: life.routes[0]!, ...(life.fallback === undefined ? {} : { fallback: life.fallback }) } } : {}),
    ...(life.preset === null ? {} : { prologue: (step: string, answers: readonly { id: string; allowed: boolean }[]) => preset(life.preset!, life.home, step, answers) }),
    onEvents: (events, game) => {
      for (const event of events as (BaseEvent & { stage?: string; entry?: string; item?: { entry?: string } })[]) {
        if (event.type === "obligation/staged" && event.entry === "obligation.tuition") {
          if (event.stage === "reminder" && firstMiss === null) firstMiss = game.state.turn.month;
          stages.push(event.stage ?? "");
        }
        if (event.type === "offer/opened" && event.item?.entry === "offer.fee-payment-plan") stages.push("plan");
        if (event.type === "status/withdrawn") {
          // abroad-money:missed-tuition-runs-in-stages: the reminder, then the cut with the plan offered, then the final warning.
          const reminder = stages.indexOf("reminder");
          const cut = stages.indexOf("cut");
          const warning = stages.lastIndexOf("warning");
          const followed = reminder >= 0 && cut > reminder && stages.includes("plan") && warning > cut;
          run.student ??= { graduate: false, withdrawals: [] };
          run.student.withdrawals.push({ firstMiss: firstMiss ?? game.state.turn.month, month: game.state.turn.month, followed });
          firstMiss = null;
          stages = [];
        }
      }
    },
    stopWhen: stopAt,
  });
  run.departed = record.departed;
  run.flown = record.flown;
  run.flightTrade = record.departed === null ? null : tradeOfJob(homeJob);
  return run;
}

/** One style on every life over the seeds in the golden world. A developer has nothing to pivot to, so the pivots leave it out. */
export function stylePlays(content: Content, preset: PresetAnswer, style: BalanceStyle): BalanceRun[] {
  const runs: BalanceRun[] = [];
  for (const life of BALANCE_LIVES) {
    if ((style === "free-pivot" || style === "paid-pivot") && life.trade === "developer") continue;
    for (let n = 0; n < SEEDS; n += 1) runs.push(playBalance(content, preset, life, style, GOLDEN_WORLD, n));
  }
  return runs;
}

/** The trade-loyal lives the crash measure reads (the shop, the racks and the nurse) in the crash world. */
export function crashPlays(content: Content, preset: PresetAnswer): BalanceRun[] {
  const runs: BalanceRun[] = [];
  for (const life of BALANCE_LIVES.filter((entry) => entry.band === "shop" || entry.band === "fish" || entry.band === "nurse")) {
    for (let n = 0; n < SEEDS; n += 1) runs.push(playBalance(content, preset, life, "trade-loyal", CRASH_WORLD, n));
  }
  return runs;
}

/** Every play the measures read. */
export function balancePlays(content: Content, preset: PresetAnswer): BalanceRun[] {
  return [...BALANCE_STYLES.flatMap((style) => stylePlays(content, preset, style)), ...crashPlays(content, preset)];
}

// ---------------------------------------------------------------------------
// The ten measures
// ---------------------------------------------------------------------------

export interface Measure {
  /** The measure's number and what it holds, as the rule's table names it. */
  name: string;
  /** The figures read, for the failure message and the report. */
  figures: string;
  pass: boolean;
}

/** "About 1.21 times" (the tenth measure), in basis points: within half a tenth either way. */
const REVIEW_ABOUT: [number, number] = [11600, 12600];

/** Months for a life that never flew, so it sorts after every flight. */
const NEVER = 999;

function monthsOf(runs: BalanceRun[]): number[] {
  return runs.map((run) => run.departed ?? NEVER).sort((left, right) => left - right);
}

/** The lower median, a never-flown life counting as never. */
function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[(sorted.length - 1) >> 1] ?? NEVER;
}

/** The 75th percentile by rank, a never-flown life counting as never. */
function percentile75(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[divCeil(sorted.length * 3, 4) - 1] ?? NEVER;
}

/** A whole number of tenths as words: 125 is "12.5". */
function tenths(value: number): string {
  return `${String(divFloor(value, 10))}.${String(value - divFloor(value, 10) * 10)}`;
}

/** A share in tenths of a percent, as words. */
function share(part: number, whole: number): string {
  return tenths(whole === 0 ? 0 : mulDiv(part, 1000, whole));
}

const BAND_TRADES = Object.keys(CHEAP_BAND) as BandTrade[];

function byBand(runs: BalanceRun[], style: BalanceStyle, band: BandTrade): BalanceRun[] {
  return runs.filter((run) => run.style === style && run.band === band && run.world === GOLDEN_WORLD);
}

/** Naira pay under the review after 36 months in one formal job (the tenth measure), against its start: the ratio, and in pounds. */
export interface ReviewRead {
  /** The pay at month 36 over the pay at the start, in basis points. */
  ratioBp: number;
  /** The same, both in pounds at the month's official rate. */
  poundBp: number;
}

export function measures(runs: BalanceRun[], review: Record<string, ReviewRead>): Measure[] {
  const golden = runs.filter((run) => run.world === GOLDEN_WORLD);
  const out: Measure[] = [];

  // 1 to 3: the trade-loyal lives against each trade's cheap band.
  const loyal = BAND_TRADES.map((band) => ({ band, months: monthsOf(byBand(runs, "trade-loyal", band)) }));
  out.push({
    name: "1. the median first flight of each trade, trade-loyal, inside the trade's cheap band",
    figures: loyal.map(({ band, months }) => `${band} ${String(median(months))} (${CHEAP_BAND[band].join(" to ")})`).join("; "),
    pass: loyal.every(({ band, months }) => median(months) >= CHEAP_BAND[band][0] && median(months) <= CHEAP_BAND[band][1]),
  });
  out.push({
    name: "2. the 75th percentile of the first flight, trade-loyal, at most the cheap band's top plus 12",
    figures: loyal.map(({ band, months }) => `${band} ${String(percentile75(months))} (${String(CHEAP_BAND[band][1] + 12)})`).join("; "),
    pass: loyal.every(({ band, months }) => percentile75(months) <= CHEAP_BAND[band][1] + 12),
  });
  out.push({
    name: "3. the share flown by month 72, trade-loyal, 80% or more for every trade",
    figures: loyal.map(({ band, months }) => `${band} ${String(share(months.filter((month) => month <= 72).length, months.length))}%`).join("; "),
    pass: loyal.every(({ months }) => months.filter((month) => month <= 72).length * 5 >= months.length * 4),
  });

  // 4: flights from a developer rung among lives that did not start as developers.
  const flights = golden.filter((run) => run.departed !== null && !run.startedDeveloper);
  const fromDeveloper = flights.filter((run) => run.flightTrade === "developer").length;
  out.push({
    name: "4. flights leaving from a developer rung, among lives that did not start as developers, every style: 35% or less",
    figures: `${String(fromDeveloper)} of ${String(flights.length)}, ${String(share(fromDeveloper, flights.length))}%`,
    pass: fromDeveloper * 100 <= flights.length * 35,
  });

  // 5: the pivots' pace against trade-loyal's.
  const paces = BAND_TRADES.filter((band) => band !== "developer").map((band) => {
    const base = median(monthsOf(byBand(runs, "trade-loyal", band)));
    return { band, base, free: median(monthsOf(byBand(runs, "free-pivot", band))), paid: median(monthsOf(byBand(runs, "paid-pivot", band))) };
  });
  out.push({
    name: "5. the pivot's median first flight never sooner than 0.8 times trade-loyal's, and for the teacher no later than 1.5 times",
    figures: paces.map(({ band, base, free, paid }) => `${band} loyal ${String(base)}, free ${String(free)}, paid ${String(paid)}`).join("; "),
    pass: paces.every(({ band, base, free, paid }) => [free, paid].every((pivot) => pivot * 10 >= base * 8 && (band !== "teacher" || pivot * 10 <= base * 15))),
  });

  // 6: the mix of routes over every style's formal flights.
  const formal = golden.filter((run) => run.flown !== null && run.flown !== "route.road");
  const counts = new Map<string, number>();
  for (const run of formal) counts.set(run.flown!, (counts.get(run.flown!) ?? 0) + 1);
  const needed: Id<"route">[] = [MASTERS, "route.uk-skilled", CANADA, CARE, GULF];
  out.push({
    name: "6. no route over 50% of formal flights; the master's, the skilled worker, Canada's points, care and the Gulf each 5% or more",
    figures: [...counts.entries()].sort().map(([route, count]) => `${route.replace("route.", "")} ${String(share(count, formal.length))}%`).join("; "),
    pass: [...counts.values()].every((count) => count * 2 <= formal.length) && needed.every((route) => (counts.get(route) ?? 0) * 20 >= formal.length),
  });

  // 7: the students.
  const students = (style: BalanceStyle) => golden.filter((run) => run.style === style && run.student !== null);
  const graduated = (style: BalanceStyle) => students(style).filter((run) => run.student!.graduate).length;
  const withdrawals = golden.flatMap((run) => run.student?.withdrawals ?? []);
  const gaps = withdrawals.map((entry) => entry.month - entry.firstMiss);
  const careful = students("careful");
  const risky = students("risky");
  out.push({
    name: "7. students: careful 90% or more reach the Graduate status, risky 70% or more; every withdrawal after every warning; 3 months or more from the first miss",
    figures: `careful ${String(graduated("careful"))} of ${String(careful.length)}, risky ${String(graduated("risky"))} of ${String(risky.length)}, borrower ${String(graduated("borrower"))} of ${String(students("borrower").length)}; withdrawals ${String(withdrawals.length)}, after every warning ${String(withdrawals.filter((entry) => entry.followed).length)}, median months from the first miss ${String(withdrawals.length === 0 ? "none" : median(gaps))}`,
    pass:
      careful.length > 0 &&
      risky.length > 0 &&
      graduated("careful") * 10 >= careful.length * 9 &&
      graduated("risky") * 10 >= risky.length * 7 &&
      withdrawals.every((entry) => entry.followed) &&
      (withdrawals.length === 0 || median(gaps) >= 3),
  });

  // 8: tech's pace to junior-ready by path.
  const PACE: Record<string, [number, number]> = { "activity.learn-free": [8, 12], "activity.online-course": [6, 8], "activity.tech-diploma": [7, 9], "activity.bootcamp": [4, 6] };
  const learners = golden.filter((run) => (run.style === "free-pivot" || run.style === "paid-pivot") && run.tech !== null);
  const pace = Object.entries(PACE).map(([path, band]) => {
    const ready = learners.filter((run) => run.tech!.path === path && run.tech!.ready !== null).map((run) => run.tech!.ready! - run.tech!.from + 1);
    return { path, band, ready, median: ready.length === 0 ? null : median(ready) };
  });
  const early = learners.filter((run) => run.tech!.ready !== null && run.tech!.ready < 4).length;
  out.push({
    name: "8. tech's pace to junior-ready: the free path 8 to 12 months, the short course 6 to 8, the diploma 7 to 9, the bootcamp 4 to 6; none by study before month 4",
    figures: `${pace.map(({ path, median: middle, ready }) => `${path.replace("activity.", "")} ${middle === null ? "none" : String(middle)} (${String(ready.length)} lives)`).join("; ")}; before month 4: ${String(early)}`,
    pass: pace.every(({ band, median: middle }) => middle !== null && middle >= band[0] && middle <= band[1]) && early === 0,
  });

  // 9: the money floor and the sinks for the careful lives.
  const carefulRuns = golden.filter((run) => run.style === "careful");
  const longest = Math.max(0, ...carefulRuns.map((run) => run.brokeRun));
  const sinks = carefulRuns.flatMap((run) => (run.sinks === null || run.sinks.keep <= 0 ? [] : [{ run, sinks: run.sinks }]));
  const ratios = sinks.flatMap(({ sinks: held }) =>
    (["settle", "renew", "citizen"] as const).flatMap((fee) => {
      const charged = held[fee];
      return charged === null ? [] : [{ fee, tenths: mulDiv(charged, 10, held.keep) }];
    }),
  );
  const outside = ratios.filter((entry) => entry.tenths < 5 || entry.tenths > 60);
  const sinkFigures = (["settle", "renew", "citizen"] as const).map((fee) => {
    const months = ratios.filter((entry) => entry.fee === fee).map((entry) => entry.tenths);
    return `${fee} ${months.length === 0 ? "none" : `${tenths(Math.min(...months))} to ${tenths(Math.max(...months))}`}`;
  });
  out.push({
    name: "9. no careful life under the broke line more than 2 months in a row; settlement, renewal and citizenship each 0.5 to 6 months of what the month keeps",
    figures: `longest broke run ${String(longest)}; months of keep: ${sinkFigures.join(", ")} over ${String(sinks.length)} lives; outside ${String(outside.length)}`,
    pass: longest <= 2 && ratios.length > 0 && outside.length === 0,
  });

  // 10: the crash.
  const crash = runs.filter((run) => run.world === CRASH_WORLD);
  const gulfLives = crash.filter((run) => run.band === "shop" || run.band === "fish");
  const nurses = crash.filter((run) => run.band === "nurse");
  const gulfBy = gulfLives.filter((run) => run.flown === GULF && run.departed !== null && run.departed <= CRASH_MONTH).length;
  const careBy = nurses.filter((run) => run.flown === CARE && run.departed !== null && run.departed <= CRASH_MONTH).length;
  const calm = review[GOLDEN_WORLD];
  const fall = review[CRASH_WORLD];
  out.push({
    name: "10. the crash: the Gulf from the shop and the racks, and the nurse's route from the nurse, by month 36 for 60% or more; naira pay at 36 about 1.21 times its start in the golden world and lower in pounds in world-b",
    figures: `Gulf ${String(gulfBy)} of ${String(gulfLives.length)}, care ${String(careBy)} of ${String(nurses.length)}; pay at 36 ${calm === undefined ? "none" : `${String(calm.ratioBp)} bp`} of its start in the golden world, ${fall === undefined ? "none" : `${String(fall.poundBp)} bp`} in pounds in world-b`,
    pass:
      gulfBy * 10 >= gulfLives.length * 6 &&
      careBy * 10 >= nurses.length * 6 &&
      calm !== undefined &&
      calm.ratioBp >= REVIEW_ABOUT[0] &&
      calm.ratioBp <= REVIEW_ABOUT[1] &&
      fall !== undefined &&
      fall.poundBp < 10000,
  });
  return out;
}

/** The review's figure (the tenth measure): a graduate holds the customer service job, a formal employer's, for 36 months and is reviewed each year. */
export function reviewRead(content: Content, world: string): ReviewRead {
  const game = start({ scenario: "scenario.graduate", seed: "balance-review", worldSeed: world, content });
  applyEffects(game, [{ type: "activity/start-job", job: REVIEWED_JOB }]);
  const startPay = game.state.activity.pay ?? 0;
  const startRate = game.world().rates.GBP.official;
  for (let month = 0; month < CRASH_MONTH; month += 1) {
    if (game.state.turn.banked < 1) game.grant(1);
    game.endTurn([]);
  }
  if (game.state.activity.job !== REVIEWED_JOB || startPay === 0) throw new Error(`The reviewed job is not held at month ${String(CRASH_MONTH)}.`);
  const pay = game.state.activity.pay ?? 0;
  const ratioBp = mulDiv(pay, 10000, startPay);
  return { ratioBp, poundBp: mulDiv(ratioBp, startRate, game.world().rates.GBP.official) };
}
