// Simulated players for the first milestone's test sweep (layer 5 of
// docs/design/02-quality-and-testing.md). A strategy reads only the view and
// the public content and ranks the commands it would like to send; the runner
// sends them in that order and keeps the first one the authority accepts, so a
// strategy never needs to know a hidden figure to stay legal.
import { mulDiv } from "../engine/int";
import { step } from "../engine/step";
import { refusalChanceBp } from "../route/route.logic";
import type { Content, Id, OfferView, PlayerView, SlotPick, State } from "../engine/types";
import { legalCommands } from "../testing/legal";
import type { Game, Loose } from "../testing/play";
import { start } from "../testing/play";

export const UK: Id<"route"> = "route.uk-masters";
const NORTHGATE: Id<"school"> = "school.northgate";

/** Naira, bank and cash together, under which offer.md calls a character broke. */
export const BROKE_BELOW = 15000000;

/** Pence of pounds a careful player buys ahead for the deposit and the visa fees. */
const POUND_TARGET = 600000;

const SAFE_CASH_MOVE = 50000000;

export type StrategyName = "careful" | "borrower" | "risky";

/** Ranks the commands a player would like to send now, best first. */
export type Strategy = (view: PlayerView, content: Content) => Loose[];

interface Habits {
  /** English practice before sitting the test. */
  englishBeforeTest: number;
  /** Interview prep before applying for the visa. */
  prep: number;
  /** Most unexplained share, in basis points, at which the visa is sent. */
  unexplainedMax: number;
  takesLoans: boolean;
  takesAgent: boolean;
  /** Takes the bank's held funds as soon as offered, at the most it allows. */
  heldAtOnce: boolean;
  paysFamily: boolean;
  buysPounds: boolean;
  /** Months of what is due kept back before spending on anything optional. */
  bufferMonths: number;
}

const HABITS: Record<StrategyName, Habits> = {
  careful: {
    englishBeforeTest: 72,
    prep: 40,
    unexplainedMax: 2000,
    takesLoans: false,
    takesAgent: false,
    heldAtOnce: false,
    paysFamily: true,
    buysPounds: true,
    bufferMonths: 2,
  },
  borrower: {
    englishBeforeTest: 66,
    prep: 20,
    unexplainedMax: 10000,
    takesLoans: true,
    takesAgent: true,
    heldAtOnce: true,
    paysFamily: true,
    buysPounds: false,
    bufferMonths: 1,
  },
  risky: {
    englishBeforeTest: 58,
    prep: 0,
    unexplainedMax: 10000,
    takesLoans: false,
    takesAgent: true,
    heldAtOnce: false,
    paysFamily: false,
    buysPounds: false,
    bufferMonths: 1,
  },
};

// ---------------------------------------------------------------------------
// Reading the view
// ---------------------------------------------------------------------------

function quality(view: PlayerView, id: string): number {
  return view.qualities.find((item) => item.id === id)?.value ?? 0;
}

function naira(view: PlayerView): number {
  return view.pockets.NGN.bank + view.pockets.NGN.cash;
}

/** What falls due each month, in naira. */
function monthlyDue(view: PlayerView): number {
  return view.obligations.reduce((sum, item) => sum + item.due, 0);
}

function buffer(view: PlayerView, habits: Habits): number {
  return monthlyDue(view) * habits.bufferMonths;
}

function option(view: PlayerView, id: string) {
  return view.activities.find((item) => item.id === id);
}

function playable(view: PlayerView, id: string): boolean {
  const found = option(view, id);
  return found !== undefined && found.allowed && found.affordable;
}

function nairaCost(view: PlayerView, id: string): number {
  return (option(view, id)?.cost ?? []).reduce((sum, cost) => sum + (cost.currency === "NGN" ? cost.amount : 0), 0);
}

/** Playable, and leaves the buffer standing. Papers the route needs keep back only one month. */
function canSpendOn(view: PlayerView, id: string, habits: Habits, paper = false): boolean {
  const keep = paper ? monthlyDue(view) : buffer(view, habits);
  return playable(view, id) && naira(view) - nairaCost(view, id) >= keep;
}

const VISA_PAPERS = ["document.passport", "document.transcript", "document.english-test", "document.cas"];

/** Every paper the visa needs except the TB certificate is held and good for a few months more. */
function papersReady(view: PlayerView): boolean {
  return VISA_PAPERS.every((id) => {
    const held = documentState(view, id);
    return held?.state === "held" && (held.expiresMonth === null || held.expiresMonth > view.month + 3);
  });
}

function holdingFunds(view: PlayerView): boolean {
  return view.obligations.some((item) => item.entry.includes("held-funds"));
}

function route(view: PlayerView) {
  return view.routes.find((item) => item.id === UK);
}

function documentState(view: PlayerView, id: string) {
  return view.documents.find((item) => item.id === id);
}

/** A job's monthly pay in kobo, valued at the official rate. */
export function payOf(view: PlayerView, content: Content, job: string | null): number {
  if (job === null) return 0;
  const pay = content.activity[job as Id<"activity">]?.pay;
  if (pay === null || pay === undefined || typeof pay.amount !== "number") return 0;
  if (pay.currency === "NGN") return pay.amount;
  const rate = view.rates[pay.currency as "GBP" | "USD"].official;
  return mulDiv(pay.amount, rate, 100);
}

/** Pence a pound pocket set needs before the deposit and fees can be paid in pounds. */
function poundsToKobo(view: PlayerView, pence: number): number {
  return mulDiv(pence, view.rates.GBP.official, 100);
}

/**
 * The gap between funds required and funds shown, in pence. Zero when covered.
 * The checklist's `funds` item is worked out every time the view is asked for;
 * the route's own figures only after a month-end check with a deposit paid.
 */
function fundsGap(view: PlayerView): number {
  const item = route(view)?.checklist.find((entry) => entry.id === "funds");
  if (item === undefined || item.have === null || item.need === null) return 0;
  return Math.max(0, item.need - item.have);
}

function varStart(content: Content, id: string): number {
  return content.var[id as Id<"var">]?.start ?? 0;
}

/** Naira the next big payment will take, by the stage the route is at. */
function nextBigPayment(view: PlayerView, content: Content): number {
  const uk = route(view);
  if (uk === undefined) return 0;
  if (uk.state === "granted") {
    const flight = content.tuning.route.flight;
    return typeof flight.amount === "number" ? flight.amount : 0;
  }
  const pounds = view.pockets.GBP.bank + view.pockets.GBP.cash;
  let pence = 0;
  if (uk.state === "known" && uk.school === null) {
    const offers = uk.schools.filter((school) => school.state === "offer");
    const school = offers.find((item) => item.id === NORTHGATE) ?? offers[0];
    if (school !== undefined) pence = content.school[school.id]?.deposit ?? 0;
  } else if (uk.state === "known") pence = varStart(content, "var.uk-visa-fee") + varStart(content, "var.uk-surcharge");
  const owed = poundsToKobo(view, Math.max(0, pence - pounds));
  return owed + mulDiv(owed, 150, 10000);
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

function choose(offer: OfferView, choice: string, amount?: number): Loose | null {
  const found = offer.choices.find((item) => item.id === choice);
  if (found === undefined || !found.allowed) return null;
  if (found.pick === null) return { type: "offer/choose", offer: offer.id, choice };
  const picked = Math.min(found.pick.max, Math.max(found.pick.min, amount ?? found.pick.min));
  return { type: "offer/choose", offer: offer.id, choice, amount: picked };
}

/** The naira a choice would pay out, from the content's effects, when plain. */
function choiceCost(content: Content, offer: OfferView, choice: string): number {
  const entry = content.offer[offer.entry];
  const found = entry?.choices.find((item) => item.id === choice);
  let cost = 0;
  for (const effect of found?.effects ?? []) {
    if (effect.type === "money/take" && typeof effect.amount === "number" && effect.currency === "NGN") cost += effect.amount;
  }
  return cost;
}

const FAMILY_ORDER: Record<string, string[]> = {
  "offer.nepa-bill": ["pay", "leave"],
  "offer.brother-fees": ["pay", "half", "no"],
  "offer.mum-shop": ["give", "half", "no"],
  "offer.aso-ebi": ["buy", "plain", "absent"],
  "offer.roof": ["pay", "half", "no"],
  "offer.harvest": ["give", "no"],
  "offer.uncle-burial": ["send", "token", "nothing"],
  "offer.send-off-party": ["go", "message"],
  "offer.laptop-fault": ["repair", "manage"],
  "offer.fuel-scarcity": ["pay", "trek"],
  "offer.recruiter-message": ["do-it", "ignore"],
};

function offerCommands(view: PlayerView, content: Content, habits: Habits): Loose[] {
  const commands: Loose[] = [];
  const spare = naira(view) - buffer(view, habits);
  const gapKobo = poundsToKobo(view, fundsGap(view));
  const current = payOf(view, content, view.job.id);
  for (const offer of view.offers) {
    const order = FAMILY_ORDER[offer.entry];
    if (order !== undefined) {
      const choices = habits.paysFamily ? order : order.slice(-1);
      for (const choice of choices) {
        const cost = choiceCost(content, offer, choice);
        if (cost > 0 && cost > spare) continue;
        const command = choose(offer, choice);
        if (command !== null) {
          commands.push(command);
          break;
        }
      }
      continue;
    }
    let command: Loose | null = null;
    switch (offer.entry) {
      case "offer.job": {
        const job = offer.terms.job;
        command = choose(offer, typeof job === "string" && payOf(view, content, job) > current ? "accept" : "decline");
        break;
      }
      case "offer.family-pledge":
      case "offer.family-pledge-small":
        command = choose(offer, "accept");
        break;
      case "offer.land-buyer":
        command = choose(offer, gapKobo > 0 ? "sell" : "hold");
        break;
      case "offer.salary-loan":
        command = habits.takesLoans ? choose(offer, "take", Number.MAX_SAFE_INTEGER) : choose(offer, "no");
        break;
      case "offer.quick-loan":
        command = habits.takesLoans ? choose(offer, "take", Number.MAX_SAFE_INTEGER) : choose(offer, "ignore");
        break;
      case "offer.held-funds": {
        if (habits.heldAtOnce) command = choose(offer, "take", Number.MAX_SAFE_INTEGER);
        else if (gapKobo > 0 && !holdingFunds(view) && papersReady(view) && quality(view, "quality.interview-prep") >= habits.prep) {
          // A little over the gap, since the naira keeps falling; and only with three months of interest in hand.
          const amount = gapKobo + mulDiv(gapKobo, 1000, 10000);
          const interest = mulDiv(amount, 1500, 10000);
          command = spare >= interest ? choose(offer, "take", amount) : null;
        }
        command ??= choose(offer, "no");
        break;
      }
      case "offer.held-funds-agent":
        command = habits.takesAgent && gapKobo > 0 ? choose(offer, "take", gapKobo + mulDiv(gapKobo, 1000, 10000)) : choose(offer, "walk-away");
        break;
      default:
        break;
    }
    if (command !== null) commands.push(command);
  }
  return commands;
}

// ---------------------------------------------------------------------------
// The month's slots
// ---------------------------------------------------------------------------

function bestJobParam(view: PlayerView, content: Content): string | null {
  const hunt = option(view, "activity.job-hunt");
  if (hunt === undefined || !hunt.allowed || hunt.params === null) return null;
  const current = payOf(view, content, view.job.id);
  let best: string | null = null;
  let bestPay = current;
  for (const job of hunt.params) {
    const pay = payOf(view, content, job);
    if (pay > bestPay) {
      best = job;
      bestPay = pay;
    }
  }
  return best;
}

function englishHeld(view: PlayerView): number | null {
  const held = documentState(view, "document.english-test");
  if (held === undefined) return null;
  if (held.state === "pending") return Number.MAX_SAFE_INTEGER;
  // A result about to run out is as good as none: the visa needs it in date.
  if (held.expiresMonth !== null && held.expiresMonth <= view.month + 3) return null;
  return held.state === "held" ? held.value : null;
}

function slotPlan(view: PlayerView, content: Content, habits: Habits): SlotPick[] {
  const picks: SlotPick[] = [];
  const room = view.freeSlots;
  const add = (activity: string, param: string | null = null): void => {
    if (picks.length < room) picks.push({ activity: activity as Id<"activity">, param });
  };
  const uk = route(view);
  const known = uk !== undefined && uk.state !== "unknown" && uk.state !== "heard";
  const prep = quality(view, "quality.interview-prep");
  const english = quality(view, "quality.english");
  const tech = quality(view, "quality.tech");
  const portfolio = quality(view, "quality.portfolio");
  const wellbeing = quality(view, "quality.wellbeing");
  const band = englishHeld(view);

  // The application is the point of it all.
  if (uk !== undefined && playable(view, "activity.apply-for-visa") && prep >= habits.prep && uk.unexplainedBp <= habits.unexplainedMax) {
    add("activity.apply-for-visa");
  }
  if (wellbeing < 30) add("activity.rest");
  if (uk?.state === "heard" && playable(view, "activity.look-into-route")) add("activity.look-into-route", UK);

  const job = bestJobParam(view, content);
  if (job !== null) add("activity.job-hunt", job);

  if (known) {
    if (canSpendOn(view, "activity.get-passport", habits, true)) add("activity.get-passport");
    if (canSpendOn(view, "activity.get-transcript", habits, true)) add("activity.get-transcript");
    if ((band === null || band < 60) && english >= habits.englishBeforeTest && canSpendOn(view, "activity.sit-english-test", habits, true)) {
      add("activity.sit-english-test");
    }
    if (playable(view, "activity.apply-to-school")) {
      const params = option(view, "activity.apply-to-school")?.params ?? [];
      if (params.includes(NORTHGATE)) add("activity.apply-to-school", NORTHGATE);
      else if (params[0] !== undefined) add("activity.apply-to-school", params[0]);
    }
    if (playable(view, "activity.family-meeting")) add("activity.family-meeting");
    const offered = uk.schools.some((school) => school.state === "offer");
    if (uk.state === "known" && uk.school !== null && fundsGap(view) === 0 && canSpendOn(view, "activity.tb-test", habits, true)) add("activity.tb-test");
    if (offered && prep < habits.prep && playable(view, "activity.interview-prep")) add("activity.interview-prep");
    if ((band === null || band < 60) && english < habits.englishBeforeTest && canSpendOn(view, "activity.study-english", habits)) {
      add("activity.study-english");
    }
  }

  // What fills the rest: wellbeing first, then the skills that lead to better pay.
  for (let guard = 0; guard < 3 && picks.length < room; guard += 1) {
    if (wellbeing < 45) add("activity.rest");
    else if (tech >= 40 && portfolio < 3 && playable(view, "activity.build-portfolio")) add("activity.build-portfolio");
    else if (tech < 75 && canSpendOn(view, "activity.learn-tech", habits)) add("activity.learn-tech");
    else if (playable(view, "activity.side-gig")) add("activity.side-gig");
    else add("activity.family-time");
  }
  return picks;
}

// ---------------------------------------------------------------------------
// Money and the route's commands
// ---------------------------------------------------------------------------

function moneyCommands(view: PlayerView, content: Content, habits: Habits): Loose[] {
  const commands: Loose[] = [];
  const uk = route(view);
  const cash = view.pockets.NGN.cash;
  const due = monthlyDue(view);
  if (cash > due * 2 + 10000000) {
    commands.push({ type: "wallet/move", currency: "NGN", amount: Math.min(SAFE_CASH_MOVE, cash - due * 2), to: "bank" });
  }
  // Paying ahead on a loan whose next charge is more than the pockets hold.
  for (const owed of view.obligations) {
    if (owed.entry === "obligation.quick-loan" && naira(view) >= owed.outstanding + due && !habits.takesLoans) {
      commands.push({ type: "obligation/pay", obligation: owed.id, amount: owed.outstanding });
    }
  }
  if (uk === undefined) return commands;

  const big = nextBigPayment(view, content);
  // Dollars are sold for naira when the next big payment needs them: the fee rules never reach a dollar pocket.
  const short = big + buffer(view, habits) - view.pockets.NGN.bank;
  if (short > 0 && view.pockets.USD.bank > 0) {
    const cents = Math.min(view.pockets.USD.bank, mulDiv(short, 102, view.rates.USD.official) + 100);
    commands.push({ type: "wallet/convert", from: "USD", to: "NGN", amount: cents, via: "bank" });
  }
  if (uk.state === "granted") {
    for (const owed of view.obligations) {
      if (owed.entry.includes("held-funds") && view.pockets.NGN.locked >= owed.outstanding) {
        commands.push({ type: "obligation/pay", obligation: owed.id, amount: owed.outstanding });
      }
    }
    commands.push({ type: "route/depart", route: UK });
    return commands;
  }

  if (uk.school === null && uk.state === "known") {
    const offers = uk.schools.filter((school) => school.state === "offer");
    const school = offers.find((item) => item.id === NORTHGATE) ?? offers[0];
    if (school !== undefined && view.pockets.NGN.bank - big >= buffer(view, habits)) {
      commands.push({ type: "route/pay-deposit", route: UK, school: school.id });
    }
  }

  // Buying pounds ahead, within the month's bank allowance.
  const knownish = uk.state === "known" || uk.state === "applying";
  if (habits.buysPounds && knownish && view.pockets.GBP.bank < POUND_TARGET && view.bankAllowanceLeft > 0 && view.queued.length === 0) {
    const most = mulDiv(view.bankAllowanceLeft, view.rates.USD.official, 100) - 100;
    const amount = Math.min(most, view.pockets.NGN.bank - buffer(view, habits) - due * 3);
    if (amount >= 1000000) commands.push({ type: "wallet/convert", from: "NGN", to: "GBP", amount, via: "bank" });
  }
  return commands;
}

function answer(view: PlayerView, habits: Habits): Loose[] {
  const question = view.setpiece?.question;
  if (question === undefined || question === null) return [];
  const careful = habits.prep > 0;
  const ranked = careful ? [...question.answers.filter((item) => !question.weak.includes(item)), ...question.answers] : question.answers;
  return ranked.map((answer) => ({ type: "setpiece/answer", question: question.id, answer }));
}

/** A strategy from a set of habits: answer, settle offers, handle money, then end the month. */
export function strategyOf(name: StrategyName): Strategy {
  const habits = HABITS[name];
  return (view, content) => {
    if (view.ended) return [];
    if (view.setpiece !== null) return answer(view, habits);
    const commands = [...offerCommands(view, content, habits), ...moneyCommands(view, content, habits)];
    if (view.turns.banked > 0) {
      commands.push({ type: "turn/end", slots: slotPlan(view, content, habits) });
      commands.push({ type: "turn/end", slots: [] });
    }
    return commands;
  };
}

export const strategies: Record<StrategyName, Strategy> = {
  careful: strategyOf("careful"),
  borrower: strategyOf("borrower"),
  risky: strategyOf("risky"),
};

// ---------------------------------------------------------------------------
// The runner
// ---------------------------------------------------------------------------

export interface Decision {
  month: number;
  granted: boolean;
  reasons: string[];
  unexplainedBp: number;
  interviewScore: number;
  earlierRefusals: number;
  /** The chance of refusal the decision drew against, in basis points (R-ROUTE-016). */
  chanceBp: number;
}

export interface RunRecord {
  strategy: StrategyName;
  life: Id<"scenario">;
  seed: string;
  months: number;
  heard: number | null;
  known: number | null;
  offer: number | null;
  deposit: number | null;
  applied: number | null;
  decisions: Decision[];
  granted: number | null;
  departed: number | null;
  /** The job held when the visa was granted. */
  jobAtGrant: string | null;
  /** The first month the remote developer job was held. */
  remote: number | null;
  japacity: number | null;
  /** Month ends with less naira than offer.md's "broke". */
  broke: number;
  /** Months whose report carried at least one good line. */
  goodMonths: number;
  /** The longest run of months without a good line. */
  longestDry: number;
  /** Months whose report carried a good line beyond pay, gig money and skill gains. */
  winMonths: number;
  /** The longest run of months without such a line. */
  longestNoWin: number;
  /** Turns the authority had to grant because the bank ran dry. */
  grantedTurns: number;
  /** Times a turn was banked, no set piece was open, and neither a resting turn nor the legal list was there. */
  stuck: number;
  /** Turns built only from options the view called allowed and affordable that step rejected. */
  rejectedTurns: { month: number; code: string; detail: string }[];
}

/** Good lines that come with every ordinary month: pay, gig money and practice. */
export const ROUTINE_LINES = ["line.wallet.salary", "line.activity.salary", "line.quality.gain", "line.activity.gig", "line.wallet.gig"];

export interface RunOptions {
  months?: number;
  worldSeed?: string;
  /** Keeps the save, for the goldens. */
  keepSave?: boolean;
}

function restingTurnAccepted(game: Game): boolean {
  const result = step(game.state, { type: "turn/end", slots: [], basedOn: game.state.v }, game.world(), game.content);
  return result.ok;
}

interface FileOnDay {
  unexplainedBp: number;
  interviewScore: number;
  chanceBp: number;
}

/** The visa file as the decision will weigh it, read from the authority's state. */
function fileOf(state: State, content: Content): FileOnDay {
  const held = state.route[UK];
  const visa = held?.visa;
  const file = {
    strictness: visa?.rules.strictness ?? 0,
    unexplainedBp: visa?.unexplainedBp ?? 0,
    refusals: held?.refusals ?? 0,
    interviewScore: visa?.interviewScore ?? 0,
    grade: state.quality["quality.edu-grade"] ?? 0,
  };
  return { unexplainedBp: file.unexplainedBp, interviewScore: file.interviewScore, chanceBp: refusalChanceBp(content.tuning.route, content.route[UK]?.refusalBaseBp ?? 0, file) };
}

/** Plays one life with one strategy until it departs or the months run out. */
export function runLife(
  name: StrategyName,
  life: Id<"scenario">,
  seed: string,
  content: Content,
  options: RunOptions = {},
): { record: RunRecord; game: Game } {
  const months = options.months ?? 60;
  const game = start({ scenario: life, seed, worldSeed: options.worldSeed ?? `world-${seed}`, content });
  const strategy = strategies[name];
  const record: RunRecord = {
    strategy: name,
    life,
    seed,
    months: 0,
    heard: null,
    known: null,
    offer: null,
    deposit: null,
    applied: null,
    decisions: [],
    granted: null,
    departed: null,
    jobAtGrant: null,
    remote: null,
    japacity: null,
    broke: 0,
    goodMonths: 0,
    longestDry: 0,
    winMonths: 0,
    longestNoWin: 0,
    grantedTurns: 0,
    stuck: 0,
    rejectedTurns: [],
  };
  let dry = 0;
  let noWin = 0;
  let sentThisMonth = 0;
  let lastFile: FileOnDay = { unexplainedBp: 0, interviewScore: 0, chanceBp: 0 };
  while (!game.state.turn.ended && game.state.turn.month < months) {
    let view = game.view();
    if (view.turns.banked === 0 && view.setpiece === null) {
      game.grant(1);
      record.grantedTurns += 1;
      view = game.view();
    }
    if (view.setpiece === null && (!restingTurnAccepted(game) || legalCommands(view).length === 0)) record.stuck += 1;
    const before = game.state;
    const wanted = sentThisMonth > 12 ? [{ type: "turn/end", slots: [] } as Loose] : strategy(view, content);
    let sent: Loose | null = null;
    for (const command of wanted) {
      const result = game.send(command);
      if (result.ok) {
        sent = command;
        break;
      }
      if (command.type === "turn/end" && command.slots.length > 0) {
        record.rejectedTurns.push({ month: view.month, code: result.code, detail: result.detail });
      }
    }
    if (sent === null) {
      record.stuck += 1;
      game.accept({ type: "turn/end", slots: [] });
      sent = { type: "turn/end", slots: [] };
    }
    const after = game.state;
    const was = before.route[UK];
    const now = after.route[UK];
    if (now?.visa !== null && now?.visa !== undefined) lastFile = fileOf(after, content);
    if (was !== undefined && now !== undefined) {
      if (record.heard === null && now.state !== "unknown") record.heard = after.turn.month;
      if (record.known === null && now.knownMonth !== null) record.known = after.turn.month;
      if (record.offer === null && Object.values(now.schools).some((school) => school.state === "offer")) record.offer = after.turn.month;
      if (record.deposit === null && now.school !== null) record.deposit = after.turn.month;
      if (record.applied === null && now.state === "applying") record.applied = after.turn.month;
      if (was.state === "applying" && now.state !== "applying") {
        const granted = now.state === "granted";
        record.decisions.push({
          month: after.turn.month,
          granted,
          reasons: granted ? [] : (now.lastRefusal?.reasons ?? []),
          ...lastFile,
          earlierRefusals: was.refusals,
        });
        if (granted) {
          record.granted = after.turn.month;
          record.jobAtGrant = after.activity.job;
        }
      }
      if (now.state === "departed" && record.departed === null) record.departed = after.turn.month;
      if (record.remote === null && after.activity.job === "activity.job-remote-dev") record.remote = after.turn.month;
    }
    if (sent.type === "turn/end") {
      sentThisMonth = 0;
      const shown = game.view();
      const good = shown.report?.lines.some((line) => line.tone === "good") ?? false;
      if (good) {
        record.goodMonths += 1;
        dry = 0;
      } else {
        dry += 1;
        record.longestDry = Math.max(record.longestDry, dry);
      }
      const win = shown.report?.lines.some((line) => line.tone === "good" && !ROUTINE_LINES.includes(line.key)) ?? false;
      if (win) {
        record.winMonths += 1;
        noWin = 0;
      } else {
        noWin += 1;
        record.longestNoWin = Math.max(record.longestNoWin, noWin);
      }
      if (shown.pockets.NGN.bank + shown.pockets.NGN.cash < BROKE_BELOW) record.broke += 1;
    } else sentThisMonth += 1;
  }
  record.months = game.state.turn.month;
  record.japacity = game.state.turn.ended ? 100 : game.view().japacity.percent;
  return { record, game };
}
