// The genuineness interview: docs/rules/interview.md. Both partners answer the
// same questions about their shared history, one at a time, and the answers are
// compared with no draw, so both lives reach the same result.
import type { RegisteredKind } from "../engine/kind";
import { emit, ownOf } from "../engine/kind";
import { BP_WHOLE, mulDiv } from "../engine/int";
import { reject } from "../engine/reject";
import type {
  BaseEvent,
  Bond,
  Cause,
  Command,
  Content,
  Ctx,
  Effect,
  Id,
  InterviewEntry,
  InterviewResult,
  InterviewSlice,
  Moment,
  PlayerView,
  ReadCtx,
  Rejection,
  ReportLine,
  State,
  Tuning,
} from "../engine/types";
import type { InterviewEvent } from "./interview.events";

/** The one interview entry in content. */
export const GENUINENESS: Id<"interview"> = "interview.genuineness";
/** The `partner-job` option for a partner with no job (R-INTERVIEW-003). */
export const NO_JOB = "no-job";
const STANDING: Id<"quality"> = "quality.standing";

/**
 * `times-met`: the count of `met` moments each band starts at, highest first.
 * The bands are in the option names on the rule page; content has no field for their edges.
 */
const MET_BANDS: readonly { option: string; from: number }[] = [
  { option: "sixteen-or-more", from: 16 },
  { option: "nine-to-fifteen", from: 9 },
  { option: "four-to-eight", from: 4 },
  { option: "one-to-three", from: 1 },
  { option: "not-yet", from: 0 },
];

type Question = InterviewEntry["questions"][number];
type Open = NonNullable<InterviewSlice["open"]>;
type Asked = Open["questions"][number];
type Numbers = Tuning["interview"];

function entryOf(content: Content): InterviewEntry {
  const entry = content.interview[GENUINENESS];
  if (entry === undefined) throw new Error(`The content has no ${GENUINENESS}.`);
  return entry;
}

function questionOf(entry: InterviewEntry, id: string): Question {
  const question = entry.questions.find((candidate) => candidate.id === id);
  if (question === undefined) throw new Error(`${entry.id} has no question ${id}.`);
  return question;
}

// ---------------------------------------------------------------------------
// The bond and its record
// ---------------------------------------------------------------------------

/** The bond an interview is about. A computer's pair is its bond id; a real player's is the pair record's id. */
function bondFor(state: State, pair: string): { id: string; bond: Bond } | null {
  const direct = state.people.bonds[pair];
  if (direct !== undefined) return { id: pair, bond: direct };
  for (const [id, bond] of Object.entries(state.people.bonds)) {
    if (bond.with.kind === "player" && bond.with.pair === pair) return { id, bond };
  }
  return null;
}

function pairOf(id: string, bond: Bond): string {
  return bond.with.kind === "player" ? bond.with.pair : id;
}

function intact(found: { bond: Bond } | null): found is { id: string; bond: Bond } {
  return found !== null && found.bond.stage !== "ended";
}

function momentsOf(bond: Bond, kind: Moment["kind"], by?: Moment["by"]): Moment[] {
  return bond.moments.filter((moment) => moment.kind === kind && (by === undefined || moment.by === by)).sort((left, right) => left.n - right.n);
}

/** The `what` used most, the earliest-used first on a tie. */
function mostUsed(whats: string[]): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const what of whats) {
    const count = whats.filter((other) => other === what).length;
    if (count > bestCount) {
      best = what;
      bestCount = count;
    }
  }
  return best;
}

function bandOf(count: number): string {
  return MET_BANDS.find((band) => count >= band.from)?.option ?? "not-yet";
}

/** The other's job: from the facts, or a computer's entry while it has no facts yet. */
function theirJob(content: Content, bond: Bond): string | null {
  if (bond.facts !== null) return bond.facts.job;
  return bond.with.kind === "computer" ? (content.person[bond.with.entry]?.profile.job ?? null) : null;
}

function theirHome(content: Content, bond: Bond): string | null {
  if (bond.facts !== null) return bond.facts.home;
  return bond.with.kind === "computer" ? (content.person[bond.with.entry]?.profile.home ?? null) : null;
}

/** A fixed life has no home in its state; the prologue's town stands for it, else the city. */
function myHome(state: State): string {
  return state.prologue.draw?.town ?? "city";
}

/**
 * R-INTERVIEW-003: a question's truth from the record and the facts. `about`
 * says whose truth an `other` question asks for: the other's ("them"), as
 * this side must answer it, or this side's own ("me"), as the other must.
 */
export function truthOf(read: ReadCtx, bond: Bond, truth: Question["truth"], about: "them" | "me"): string | null {
  switch (truth) {
    case null:
      return null;
    case "first-spot":
      return momentsOf(bond, "met")[0]?.spot ?? null;
    case "first-what":
      return momentsOf(bond, "met")[0]?.what ?? null;
    case "last-spot":
      return momentsOf(bond, "met").at(-1)?.spot ?? null;
    case "times-met":
      return bandOf(momentsOf(bond, "met").length);
    case "wedding-spot":
      return momentsOf(bond, "wedding").at(-1)?.spot ?? null;
    case "calls":
      return mostUsed(momentsOf(bond, "call").map((moment) => moment.what));
    case "job":
      return (about === "me" ? read.state.activity.job : theirJob(read.content, bond)) ?? NO_JOB;
    case "home":
      return about === "me" ? myHome(read.state) : theirHome(read.content, bond);
    case "last-said":
      return momentsOf(bond, "said", about).at(-1)?.what ?? null;
    default: {
      const never: never = truth;
      throw new Error(`Unknown truth ${String(never)}.`);
    }
  }
}

/** R-INTERVIEW-003: whether the record meets what a question needs. */
export function needsMet(question: Question, bond: Bond): boolean {
  const { needs } = question;
  if (needs.met !== undefined && momentsOf(bond, "met").length < needs.met) return false;
  if (needs.calls !== undefined && momentsOf(bond, "call").length < needs.calls) return false;
  if (needs.saidEach !== undefined && (momentsOf(bond, "said", "me").length < needs.saidEach || momentsOf(bond, "said", "them").length < needs.saidEach)) return false;
  if (needs.married === true && (bond.stage !== "married" || momentsOf(bond, "wedding").length === 0)) return false;
  return true;
}

/** Every `what` the computer partners use for this list, in content order, once each. */
function sharedList(content: Content, list: "whats" | "calls"): string[] {
  return [...new Set(Object.values(content.person).flatMap((person) => (person.role === "partner" ? person[list] : [])))];
}

/**
 * The list a question's options are drawn from. A computer's lists are its
 * entry's; a real pair's spots are the shared spots (R-PEOPLE-014).
 * Content holds no shared list of whats or calls for a real pair, so a real
 * pair draws from every computer partner's lists.
 */
export function listOf(content: Content, bond: Bond, question: Question): string[] {
  const { options } = question;
  if (Array.isArray(options)) return [...options];
  const person = bond.with.kind === "computer" ? content.person[bond.with.entry] : undefined;
  switch (options) {
    case "spots":
      return [...(person?.spots ?? content.people.spots)];
    case "whats":
      return person === undefined ? sharedList(content, "whats") : [...person.whats];
    case "calls":
      return person === undefined ? sharedList(content, "calls") : [...person.calls];
    case "wedding-spots":
      // Content has no list of wedding spots; the entry lists them itself, so this offers only the truth.
      return [];
    case "jobs":
      return [
        ...Object.values(content.activity)
          .filter((activity) => activity.slot === "main")
          .map((activity) => activity.id),
        NO_JOB,
      ];
    case "phrases":
      return Object.keys(content.phrase);
    default: {
      const never: never = options;
      throw new Error(`Unknown option list ${String(never)}.`);
    }
  }
}

/**
 * R-INTERVIEW-002 and 006: the record is thin with fewer moments than
 * `thinMoments`, or fewer than `thinMonths` of this life's months at
 * `partner` or `married`.
 * Measured once, in the applicant's life at opening, and carried to the other (R-INTERVIEW-012).
 */
export function isThin(state: State, bond: Bond, numbers: Numbers): boolean {
  const since = [bond.partnerMonth, bond.marriedMonth].filter((month): month is number => month !== null);
  const months = since.length === 0 ? 0 : state.turn.month - Math.min(...since);
  return bond.moments.length < numbers.thinMoments || months < numbers.thinMonths;
}

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

/** R-INTERVIEW-006: the result from the matches, with no draw. */
export function resultOf(matched: number, asked: number, thin: boolean, numbers: Numbers): InterviewResult {
  const matchBp = asked === 0 ? 0 : mulDiv(matched, BP_WHOLE, asked);
  if (matchBp < numbers.caughtBelowBp) return "caught";
  const plain: InterviewResult = matchBp >= numbers.passBp ? "pass" : matchBp >= numbers.failBp ? "doubt" : "fail";
  return thin && plain !== "pass" ? "caught" : plain;
}

/**
 * R-INTERVIEW-006: a question about the couple matches when both answers are
 * the same; one about the other person when each answer is the truth about the
 * other. The truths about each person are read at the comparison, from
 * this life's own state and its facts of the other, which the authority makes
 * fresh before it (R-PEOPLE-003), so both lives read the same truths.
 */
function matchedCount(read: ReadCtx, open: Open, bond: Bond, theirs: readonly string[]): number {
  const entry = entryOf(read.content);
  let matched = 0;
  open.questions.forEach((asked, index) => {
    const question = questionOf(entry, asked.id);
    const mine = open.answers[index];
    const their = theirs[index];
    if (mine === undefined || their === undefined) return;
    if (question.about === "couple") {
      if (mine === their) matched += 1;
      return;
    }
    const aboutThem = truthOf(read, bond, question.truth, "them");
    const aboutMe = truthOf(read, bond, question.truth, "me");
    if (aboutThem !== null && aboutMe !== null && mine === aboutThem && their === aboutMe) matched += 1;
  });
  return matched;
}

// ---------------------------------------------------------------------------
// Opening
// ---------------------------------------------------------------------------

function readOf(ctx: Ctx): ReadCtx {
  return { state: ctx.state, world: ctx.world, content: ctx.content };
}

/** Up to `count` of `pool` drawn on `visa` without repeats, in the order drawn. */
function drawSome(ctx: Ctx, pool: readonly string[], count: number): string[] {
  const left = [...pool];
  const drawn: string[] = [];
  while (drawn.length < count && left.length > 0) {
    const [picked] = left.splice(ctx.random.int("visa", left.length), 1);
    if (picked !== undefined) drawn.push(picked);
  }
  return drawn;
}

/**
 * R-INTERVIEW-003: the questions whose needs the record meets, `ask` of them
 * drawn on `visa`; each with its truth and its options: the truth and
 * `decoys` others in an order drawn on `visa`, or a `plans` question's whole list.
 * A question about the other person has two truths, one for each
 * side to give, and both sides see the same options; the options hold both.
 */
function drawQuestions(ctx: Ctx, bond: Bond): { questions: Asked[]; truths: (string | null)[] } {
  const read = readOf(ctx);
  const numbers = ctx.content.tuning.interview;
  const entry = entryOf(ctx.content);
  const pool = entry.questions.filter((question) => needsMet(question, bond)).map((question) => question.id);
  const questions: Asked[] = [];
  const truths: (string | null)[] = [];
  for (const id of drawSome(ctx, pool, numbers.ask)) {
    const question = questionOf(entry, id);
    const list = listOf(ctx.content, bond, question);
    const truth = truthOf(read, bond, question.truth, "them");
    let options = list;
    if (question.truth !== null) {
      const theirs = question.about === "other" ? truthOf(read, bond, question.truth, "me") : null;
      const right = [...new Set([truth, theirs].filter((option): option is string => option !== null))];
      const decoys = drawSome(
        ctx,
        list.filter((option) => !right.includes(option)),
        numbers.decoys,
      );
      options = drawSome(ctx, [...right, ...decoys], right.length + decoys.length);
    }
    // A question with nothing to choose would leave the player stuck (R-ENGINE-011).
    if (options.length === 0) continue;
    questions.push({ id, options });
    truths.push(truth);
  }
  return { questions, truths };
}

/**
 * R-INTERVIEW-001 and 002: the application just sent on the `partner` gate
 * opens the interview in the applicant's life; one on the `dependant` gate only
 * over a thin record. The gate applies this as the application goes in, naming
 * the bond it rests on. The record is measured here once and carried (R-INTERVIEW-012).
 */
function openEffect(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "interview/open") throw new Error(`interview/open cannot carry out ${effect.type}.`);
  const route = ctx.content.route[effect.route];
  if (route === undefined) throw new Error(`There is no route ${effect.route}.`);
  if (ctx.state.interview.open !== null) return [];
  const bond = ctx.state.people.bonds[effect.bond];
  const found = bond === undefined ? null : { id: effect.bond, bond };
  if (!intact(found)) return [];
  const thin = isThin(ctx.state, found.bond, ctx.content.tuning.interview);
  if (route.gate === "dependant" && !thin) return [];
  const { questions, truths } = drawQuestions(ctx, found.bond);
  if (questions.length === 0) return [];
  const opened: InterviewEvent = { type: "interview/opened", pair: pairOf(found.id, found.bond), route: route.id, questions, standIn: false, thin, truths };
  return emit(ctx, "interview", [opened]);
}

/** R-PEOPLE-036: the application withdrawn takes its open interview with it, unscored. */
function closeEffect(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "interview/close") throw new Error(`interview/close cannot carry out ${effect.type}.`);
  const open = ctx.state.interview.open;
  if (open === null || open.route !== effect.route) return [];
  const withdrawn: InterviewEvent = { type: "interview/withdrawn", pair: open.pair, route: open.route };
  return emit(ctx, "interview", [withdrawn]);
}

/** R-INTERVIEW-011: a bond that ended while the interview was open closes it unscored. */
function withdrawIfEnded(ctx: Ctx): BaseEvent[] {
  const open = ctx.state.interview.open;
  if (open === null || intact(bondFor(ctx.state, open.pair))) return [];
  const withdrawn: InterviewEvent = { type: "interview/withdrawn", pair: open.pair, route: open.route };
  return emit(ctx, "interview", [withdrawn]);
}

function slotsPhase(ctx: Ctx): BaseEvent[] {
  return withdrawIfEnded(ctx);
}

/** R-INTERVIEW-001: the authority opens the same questions in the sponsor's life. */
function openCommand(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "interview/open") throw new Error(`interview/open cannot handle ${command.type}.`);
  if (ctx.state.interview.open !== null) return reject("not-legal", "An interview is already open.");
  if (ownOf(ctx.content.route, command.route) === undefined) return reject("unknown-id", `${command.route} is not a route.`);
  const found = bondFor(ctx.state, command.pair);
  if (!intact(found)) return reject("not-legal", `No bond with ${command.pair} stands.`);
  const entry = entryOf(ctx.content);
  const ids = command.questions.map((asked) => asked.id);
  if (ids.length === 0 || new Set(ids).size !== ids.length) return reject("not-legal", "The questions must be one or more, each once.");
  for (const asked of command.questions) {
    if (!entry.questions.some((question) => question.id === asked.id)) return reject("not-legal", `${asked.id} is not a question of ${entry.id}.`);
    if (asked.options.length === 0 || new Set(asked.options).size !== asked.options.length) return reject("not-legal", `${asked.id} needs options, each once.`);
  }
  const read = readOf(ctx);
  const questions = command.questions.map((asked) => ({ id: asked.id, options: [...asked.options] }));
  const truths = questions.map((asked) => truthOf(read, found.bond, questionOf(entry, asked.id).truth, "them"));
  const thin = command.thin ?? isThin(ctx.state, found.bond, ctx.content.tuning.interview);
  const opened: InterviewEvent = { type: "interview/opened", pair: command.pair, route: command.route, questions, standIn: false, thin, truths };
  return emit(ctx, "interview", [opened]);
}

// ---------------------------------------------------------------------------
// Answering
// ---------------------------------------------------------------------------

/** Whether the command came from the stand-in (decision 0005). */
function byStandIn(ctx: Ctx): boolean {
  return ctx.sender === "stand-in";
}

/** One of `options` other than `truth`, drawn on `people`; the truth itself when there is no other. */
function decoyOf(ctx: Ctx, options: readonly string[], truth: string | null): string {
  const decoys = options.filter((option) => option !== truth);
  const picked = decoys[ctx.random.int("people", Math.max(decoys.length, 1))];
  return picked ?? truth ?? options[0] ?? "";
}

/**
 * R-INTERVIEW-008: the stand-in gives the truth at `standInRecallBp` on
 * `people`, otherwise a decoy. On a `plans` question it gives the waiting
 * side's answer at the same chance, otherwise the first option.
 * On `plans` the authority sends the waiting side's answer as the
 * option when it is in, and the first option when it is not.
 */
function standInOption(ctx: Ctx, asked: Asked, truth: string | null, sent: string): string {
  const recalled = ctx.random.chance("people", ctx.content.tuning.interview.standInRecallBp);
  const first = asked.options[0] ?? sent;
  if (questionOf(entryOf(ctx.content), asked.id).truth === null) return recalled && asked.options.includes(sent) ? sent : first;
  if (recalled && truth !== null) return truth;
  return decoyOf(ctx, asked.options, truth);
}

/**
 * R-INTERVIEW-007: a computer's answers: the truth at its `recallBp` on
 * `people`, otherwise a decoy; its `plan` on `plans`.
 * The interview slice has no field to keep them from the opening and
 * nothing writes `people.secret.computerAnswers`, so they are drawn at the
 * comparison, in the same step as the player's last answer, and never kept.
 */
function computerAnswers(ctx: Ctx, open: Open, bond: Bond): string[] {
  if (bond.with.kind !== "computer") throw new Error("Only a computer partner answers itself.");
  const person = ctx.content.person[bond.with.entry];
  if (person === undefined) throw new Error(`The content has no ${bond.with.entry}.`);
  const read = readOf(ctx);
  const entry = entryOf(ctx.content);
  return open.questions.map((asked) => {
    const question = questionOf(entry, asked.id);
    if (question.truth === null) return person.behaviour.plan;
    const truth = truthOf(read, bond, question.truth, question.about === "other" ? "me" : "them");
    const recalled = ctx.random.chance("people", person.behaviour.recallBp);
    if (recalled && truth !== null) return truth;
    return decoyOf(ctx, asked.options, truth);
  });
}

/**
 * R-INTERVIEW-008: whose answers were a stand-in's. This side's from its own
 * answers; the other side's when the stand-in is on for it as the result comes,
 * since a command from the absent player turns it off (R-PEOPLE-043).
 * The life does not know its side of the pair record and
 * `interview/scored` carries no marks, so `a` holds this life's mark and `b`
 * the other side's; the record's `standIn` on the command would make both exact.
 */
function standInMarks(open: Open, bond: Bond): { a: boolean; b: boolean } {
  return { a: open.standIn, b: bond.with.kind === "player" && bond.standIn === "on" };
}

/**
 * R-INTERVIEW-006 and 009: compare, record the result, and on `caught` take
 * the standing. The refusal, the ban and the doubt are the route's, read from `last`.
 */
function score(ctx: Ctx, open: Open, bond: Bond, theirs: readonly string[]): BaseEvent[] {
  const numbers = ctx.content.tuning.interview;
  const matched = matchedCount(readOf(ctx), open, bond, theirs);
  const asked = open.questions.length;
  const result = resultOf(matched, asked, open.thin, numbers);
  const scored: InterviewEvent = { type: "interview/scored", pair: open.pair, route: open.route, result, matched, asked, month: ctx.state.turn.month, standIn: standInMarks(open, bond) };
  const events = emit(ctx, "interview", [scored]);
  if (result === "caught") {
    const cause: Cause = { source: GENUINENESS, param: null, terms: {} };
    ctx.apply([{ type: "quality/add", quality: STANDING, amount: -numbers.caughtStanding }], cause);
  }
  return events;
}

/** R-INTERVIEW-004: answer the first question not yet answered with one of its options. */
function answer(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "interview/answer") throw new Error(`interview/answer cannot handle ${command.type}.`);
  const open = ctx.state.interview.open;
  if (open === null) return reject("not-legal", "No interview is open.");
  const found = bondFor(ctx.state, open.pair);
  if (!intact(found)) return reject("not-legal", "The bond this interview is about has ended.");
  const index = open.answers.length;
  const asked = open.questions[index];
  if (asked === undefined) return reject("not-legal", "Every question is answered. The interview waits for the other side.");
  if (command.question !== asked.id) return reject("not-legal", `The question to answer now is ${asked.id}.`);
  const standIn = byStandIn(ctx);
  if (!standIn && !asked.options.includes(command.option)) return reject("not-legal", `${command.option} is not an option for ${asked.id}.`);
  const option = standIn ? standInOption(ctx, asked, ctx.state.interview.secret.truths?.[index] ?? null, command.option) : command.option;
  const answered: InterviewEvent = { type: "interview/answered", question: asked.id, option, standIn };
  const events = emit(ctx, "interview", [answered]);
  const now = ctx.state.interview.open;
  if (now === null || now.answers.length < now.questions.length) return events;
  const closed: InterviewEvent = { type: "interview/closed", pair: now.pair };
  events.push(...emit(ctx, "interview", [closed]));
  // R-INTERVIEW-007: with a computer the comparison runs at once.
  if (found.bond.with.kind === "computer") events.push(...score(ctx, now, found.bond, computerAnswers(ctx, now, found.bond)));
  return events;
}

/** R-INTERVIEW-006: the authority brings the other side's answers once both are in. */
function scoredCommand(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "interview/scored") throw new Error(`interview/scored cannot handle ${command.type}.`);
  const open = ctx.state.interview.open;
  if (open === null || open.pair !== command.pair) return reject("not-legal", `No interview with ${command.pair} is open.`);
  const found = bondFor(ctx.state, open.pair);
  if (!intact(found)) return reject("not-legal", "The bond this interview is about has ended.");
  if (open.answers.length < open.questions.length) return reject("not-legal", "This side has not answered every question.");
  if (command.theirs.length !== open.questions.length) return reject("not-legal", `The other side's answers must be ${String(open.questions.length)}.`);
  const unknown = open.questions.find((asked, index) => !asked.options.includes(command.theirs[index] ?? ""));
  if (unknown !== undefined) return reject("not-legal", `The other side's answer to ${unknown.id} is not one of its options.`);
  return score(ctx, open, found.bond, command.theirs);
}

/** R-INTERVIEW-004: `turn/end` waits while this life has a question to answer. */
function turnEnd(ctx: Ctx): BaseEvent[] | Rejection {
  const open = ctx.state.interview.open;
  if (open === null || open.answers.length >= open.questions.length) return [];
  // An ended bond withdraws the interview in the next turn, so it never holds the turn up (R-ENGINE-011).
  if (!intact(bondFor(ctx.state, open.pair))) return [];
  return reject("setpiece-open", "The interview is open: answer its questions before the month can end.");
}

// ---------------------------------------------------------------------------
// The slice, the lines and the view
// ---------------------------------------------------------------------------

function evolve(slice: InterviewSlice, event: InterviewEvent): InterviewSlice {
  switch (event.type) {
    case "interview/opened":
      return { ...slice, open: { pair: event.pair, route: event.route, questions: event.questions, answers: [], standIn: event.standIn, thin: event.thin }, secret: { truths: event.truths } };
    case "interview/answered": {
      if (slice.open === null) throw new Error(`${event.question} was answered with no interview open.`);
      return { ...slice, open: { ...slice.open, answers: [...slice.open.answers, event.option], standIn: slice.open.standIn || event.standIn } };
    }
    case "interview/closed":
      // The answers stay in `open` until the result comes; the authority copies them into the record.
      return slice;
    case "interview/scored":
      return { open: null, last: { route: event.route, result: event.result, matched: event.matched, asked: event.asked, month: event.month, standIn: event.standIn }, secret: { truths: null } };
    case "interview/withdrawn":
      return { ...slice, open: null, secret: { truths: null } };
    default: {
      const never: never = event;
      throw new Error(`Unknown interview event ${JSON.stringify(never)}.`);
    }
  }
}

function scoredLine(event: Extract<InterviewEvent, { type: "interview/scored" }>): ReportLine {
  const params = { route: event.route, matched: event.matched, asked: event.asked };
  switch (event.result) {
    case "pass":
      return { key: "line.interview.passed", params, tone: "good", attention: true, counts: [] };
    case "doubt":
      return { key: "line.interview.doubted", params, tone: "plain", attention: true, counts: [] };
    case "fail":
      return { key: "line.interview.failed", params, tone: "bad", attention: true, counts: [] };
    case "caught":
      return { key: "line.interview.caught", params, tone: "bad", attention: true, counts: [] };
    default: {
      const never: never = event.result;
      throw new Error(`Unknown interview result ${String(never)}.`);
    }
  }
}

function lines(event: InterviewEvent, state: State): ReportLine[] {
  switch (event.type) {
    case "interview/opened":
      // It blocks the next turn, so the player must look.
      return [{ key: "line.interview.opened", params: { route: event.route, questions: event.questions.length }, tone: "plain", attention: true, counts: [] }];
    case "interview/answered":
      return [];
    case "interview/closed":
      // A computer's comparison follows at once; only a real partner keeps this side waiting (R-INTERVIEW-011).
      return bondFor(state, event.pair)?.bond.with.kind === "player" ? [{ key: "line.interview.waiting", params: {}, tone: "plain", attention: false, counts: [] }] : [];
    case "interview/scored":
      // R-INTERVIEW-008: the report says when a stand-in answered for either side.
      return event.standIn.a || event.standIn.b ? [scoredLine(event), { key: "line.interview.stood-in", params: {}, tone: "plain", attention: false, counts: [] }] : [scoredLine(event)];
    case "interview/withdrawn":
      return [{ key: "line.interview.withdrawn", params: { route: event.route }, tone: "plain", attention: true, counts: [] }];
    default: {
      const never: never = event;
      throw new Error(`Unknown interview event ${JSON.stringify(never)}.`);
    }
  }
}

/**
 * R-INTERVIEW-005: one question at a time and its options, never a score, a
 * truth or the other side's answers; after the result, the result and the
 * count matched. R-INTERVIEW-008: a stand-in on either side is marked.
 */
function view(read: ReadCtx): Pick<PlayerView, "interview"> {
  const { open, last } = read.state.interview;
  if (open !== null) {
    const found = bondFor(read.state, open.pair);
    const waiting = open.answers.length >= open.questions.length;
    const question = intact(found) ? (open.questions[open.answers.length] ?? null) : null;
    const standIn = open.standIn || (waiting && found?.bond.standIn === "on");
    return { interview: { route: open.route, question, asked: open.answers.length, total: open.questions.length, waiting, standIn, result: null, matched: null } };
  }
  if (last === null) return { interview: null };
  return { interview: { route: last.route, question: null, asked: last.asked, total: last.asked, waiting: false, standIn: last.standIn.a || last.standIn.b, result: last.result, matched: last.matched } };
}

function invariants(state: State, content: Content): string[] {
  const { open, last, secret } = state.interview;
  const problems: string[] = [];
  if (last !== null && (!Number.isSafeInteger(last.matched) || last.matched < 0 || last.matched > last.asked)) problems.push(`The last interview matched ${String(last.matched)} of ${String(last.asked)}.`);
  if (open === null) {
    if (secret.truths !== null) problems.push("Truths are kept with no interview open.");
    return problems;
  }
  const entry = content.interview[GENUINENESS];
  if (entry === undefined) return [...problems, `An interview is open but the content has no ${GENUINENESS}.`];
  if (open.questions.length === 0) problems.push("The interview is open with no questions.");
  if (new Set(open.questions.map((asked) => asked.id)).size !== open.questions.length) problems.push("The interview asks a question twice.");
  if (open.answers.length > open.questions.length) problems.push("The interview holds more answers than questions.");
  if (secret.truths === null || secret.truths.length !== open.questions.length) problems.push("The interview's truths do not match its questions.");
  open.questions.forEach((asked, index) => {
    if (!entry.questions.some((question) => question.id === asked.id)) problems.push(`The interview asks ${asked.id}, which ${GENUINENESS} does not have.`);
    const given = open.answers[index];
    if (given !== undefined && !asked.options.includes(given)) problems.push(`${asked.id} was answered with ${given}, not one of its options.`);
  });
  return problems;
}

export const interviewKind: RegisteredKind<InterviewSlice, InterviewEvent> = {
  kind: "interview",
  initial: () => ({ open: null, last: null, secret: { truths: null } }),
  commands: { "interview/answer": answer, "interview/open": openCommand, "interview/scored": scoredCommand, "turn/end": turnEnd },
  effects: { "interview/open": openEffect, "interview/close": closeEffect },
  phases: { slots: slotsPhase },
  evolve,
  lines,
  invariants,
  view,
};
