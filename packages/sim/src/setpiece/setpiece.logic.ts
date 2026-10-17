// Set pieces: docs/rules/route.md, R-SETPIECE-001 to 008. A set piece is a
// short run of questions that blocks the next turn until it is answered: the
// credibility interview a visa application opens, the road's scenes and the
// December visit.
import { cardOf, cardsAllowed, reportLines } from "../chapter/chapter.card";
import { check } from "../engine/check";
import type { RegisteredKind } from "../engine/kind";
import { emit } from "../engine/kind";
import { reject } from "../engine/reject";
import type {
  BaseEvent,
  Command,
  Content,
  Ctx,
  Id,
  PlayerView,
  ReadCtx,
  Rejection,
  ReportLine,
  SetpieceAnswer,
  SetpieceEntry,
  SetpieceQuestion,
  SetpieceSlice,
  State,
} from "../engine/types";
import type { SetpieceEvent } from "./setpiece.events";
import type { Judge } from "../japacity/japacity.logic";

const PREP: Id<"quality"> = "quality.interview-prep";
const DECEMBER: Id<"setpiece"> = "setpiece.december";
const GO = "go";

type Open = NonNullable<SetpieceSlice["open"]>;

function entryOf(content: Content, id: Id<"setpiece">): SetpieceEntry {
  const entry = content.setpiece[id];
  if (entry === undefined) throw new Error(`The content has no set piece ${id}.`);
  return entry;
}

/** A question drawn or asked as a follow-up, or undefined when the entry has neither. */
function findQuestion(entry: SetpieceEntry, id: string): SetpieceQuestion | undefined {
  return entry.questions.find((candidate) => candidate.id === id) ?? entry.followUps?.find((candidate) => candidate.id === id);
}

function questionOf(entry: SetpieceEntry, id: string): SetpieceQuestion {
  const question = findQuestion(entry, id);
  if (question === undefined) throw new Error(`${entry.id} has no question ${id}.`);
  return question;
}

/** R-SETPIECE-008: a question asked only after an answer that names it. */
function isFollowUp(entry: SetpieceEntry, id: string): boolean {
  return entry.followUps?.some((candidate) => candidate.id === id) ?? false;
}

/** The first question not yet answered, or null when all are. Answers come in the order asked. */
function nextQuestion(open: Open): string | null {
  return open.questions.find((id) => open.answers[id] === undefined) ?? null;
}

/** R-SETPIECE-004: the other score when its conditions hold, else the plain one. */
export function answerScore(answer: SetpieceAnswer, judge: Judge): number {
  if (answer.thenScore !== null && answer.when.every((requirement) => judge(requirement).met)) return answer.thenScore;
  return answer.score;
}

/** R-SETPIECE-003: an answer may be given only while every one of its `requires` holds. */
export function answerAllowed(answer: SetpieceAnswer, judge: Judge): boolean {
  return (answer.requires ?? []).every((requirement) => judge(requirement).met);
}

/**
 * R-SETPIECE-001: the questions whose conditions hold, the first `ask` of them
 * in the order written for a fixed entry, else `ask` drawn on `visa` without
 * repeats and kept in the order drawn.
 */
function askedQuestions(ctx: Ctx, entry: SetpieceEntry): string[] {
  const pool = entry.questions.filter((question) => question.when.every((requirement) => ctx.check(requirement).met)).map((question) => question.id);
  if (entry.order === "fixed") return pool.slice(0, entry.ask);
  const questions: string[] = [];
  while (questions.length < entry.ask && pool.length > 0) {
    const [drawn] = pool.splice(ctx.random.int("visa", pool.length), 1);
    if (drawn !== undefined) questions.push(drawn);
  }
  return questions;
}

/**
 * R-SETPIECE-001: opens the set piece with the questions it asks. It runs
 * for the effect `setpiece/open`, which the route sends when an application
 * goes in (R-ROUTE-015). A set piece already open is left as it
 * is, and with no question to ask the interview scores 0 at once rather than
 * open with nothing to answer, which would leave the player stuck (R-ENGINE-011).
 */
function openSetpiece(ctx: Ctx, id: Id<"setpiece">, route: Id<"route"> | null): BaseEvent[] {
  if (ctx.state.setpiece.open !== null) return [];
  const questions = askedQuestions(ctx, entryOf(ctx.content, id));
  if (questions.length === 0) {
    if (route !== null) ctx.apply([{ type: "route/interview-scored", route, score: 0 }], { source: id, param: null, terms: {} });
    return [];
  }
  const opened: SetpieceEvent = { type: "setpiece/opened", entry: id, route, questions };
  return emit(ctx, "setpiece", [opened]);
}

/**
 * R-SETPIECE-003 and 004. An answer whose requirements fail now is refused.
 * Each answer is scored the moment it is given, before its own effects
 * apply, and the score is added to the open set piece's running sum. The
 * close records that sum, so a lot made between two answers moves only the
 * answers given after it. A set piece with no route records no score anywhere
 * (R-SETPIECE-006), so its answers score 0. The set piece closes on its last
 * question or on an answer marked `closes`.
 */
function answer(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "setpiece/answer") throw new Error(`setpiece/answer cannot handle ${command.type}.`);
  const open = ctx.state.setpiece.open;
  if (open === null) return reject("not-legal", "No set piece is open.");
  const entry = entryOf(ctx.content, open.entry);
  const next = nextQuestion(open);
  if (next === null || command.question !== next) return reject("not-legal", `The question to answer now is ${String(next)}.`);
  const chosen = questionOf(entry, next).answers.find((candidate) => candidate.id === command.answer);
  if (chosen === undefined) return reject("not-legal", `${String(command.answer)} is not an answer to ${next}.`);
  if (!answerAllowed(chosen, (requirement) => ctx.check(requirement))) return reject("not-legal", `${chosen.id} cannot be given now: what it needs does not hold.`);
  const score = open.route === null ? 0 : answerScore(chosen, (requirement) => ctx.check(requirement));
  const answered: SetpieceEvent = { type: "setpiece/answered", question: next, answer: chosen.id, score };
  const events = emit(ctx, "setpiece", [answered]);
  // R-SETPIECE-006: an answer's effects apply the moment it is given.
  if (chosen.effects.length > 0) ctx.apply(chosen.effects, { source: open.entry, param: null, terms: {} });
  if (chosen.closes !== true) events.push(...followUp(ctx, entry, next, chosen));
  const now = ctx.state.setpiece.open;
  if (now === null || (chosen.closes !== true && nextQuestion(now) !== null)) return events;
  const closed: SetpieceEvent = { type: "setpiece/closed", entry: now.entry, route: now.route };
  events.push(...emit(ctx, "setpiece", [closed]));
  if (now.route !== null) ctx.apply([{ type: "route/interview-scored", route: now.route, score: now.score }], { source: now.entry, param: null, terms: {} });
  return events;
}

/**
 * R-SETPIECE-008: the follow-up the answer names is asked next, once its
 * conditions hold. It follows the answer given, never its score. A follow-up
 * leads to no other, and one already asked is not asked again, so a question
 * has at most one.
 */
// Follow-ups sit in the entry's own `followUps`, so the draw never sees them; one is asked
// only while its own `when` holds, and an answer marked `closes` asks none.
function followUp(ctx: Ctx, entry: SetpieceEntry, after: string, chosen: SetpieceAnswer): BaseEvent[] {
  const open = ctx.state.setpiece.open;
  const id = chosen.followUp;
  if (open === null || id === undefined || isFollowUp(entry, after) || open.questions.includes(id)) return [];
  const question = entry.followUps?.find((candidate) => candidate.id === id);
  if (question === undefined || !question.when.every((requirement) => ctx.check(requirement).met)) return [];
  const followed: SetpieceEvent = { type: "setpiece/followed-up", question: id, after };
  return emit(ctx, "setpiece", [followed]);
}

/**
 * The effect `setpiece/close`: the open set piece, when it is the one named,
 * closes unscored. No score reaches a route and `answered` does not count it,
 * since nothing was answered (a flight during a road scene, R-ROAD-004).
 */
function closeSetpiece(ctx: Ctx, id: Id<"setpiece">): BaseEvent[] {
  const open = ctx.state.setpiece.open;
  if (open === null || open.entry !== id) return [];
  const dropped: SetpieceEvent = { type: "setpiece/dropped", entry: open.entry, route: open.route };
  return emit(ctx, "setpiece", [dropped]);
}

function evolve(slice: SetpieceSlice, event: SetpieceEvent): SetpieceSlice {
  switch (event.type) {
    case "setpiece/opened":
      return { ...slice, open: { entry: event.entry, route: event.route, questions: event.questions, answers: {}, score: 0 } };
    case "setpiece/answered": {
      if (slice.open === null) throw new Error(`${event.question} was answered with no set piece open.`);
      return {
        ...slice,
        open: { ...slice.open, answers: { ...slice.open.answers, [event.question]: event.answer }, score: slice.open.score + event.score },
        given: { ...slice.given, [slice.open.entry]: { ...slice.given[slice.open.entry], [event.question]: event.answer } },
      };
    }
    case "setpiece/followed-up": {
      if (slice.open === null) throw new Error(`${event.question} was asked with no set piece open.`);
      const at = slice.open.questions.indexOf(event.after);
      const questions = [...slice.open.questions.slice(0, at + 1), event.question, ...slice.open.questions.slice(at + 1)];
      return { ...slice, open: { ...slice.open, questions } };
    }
    case "setpiece/closed":
      return { ...slice, open: null, answered: { ...slice.answered, [event.entry]: (slice.answered[event.entry] ?? 0) + 1 } };
    case "setpiece/dropped":
      return { ...slice, open: null };
    default: {
      const never: never = event;
      throw new Error(`Unknown set piece event ${JSON.stringify(never)}.`);
    }
  }
}

function lines(event: SetpieceEvent, state: State): ReportLine[] {
  switch (event.type) {
    case "setpiece/opened":
      // It blocks the next turn, so the player must look.
      return [{ key: "line.setpiece.opened", params: { setpiece: event.entry, questions: event.questions.length }, tone: "plain", attention: true, counts: [] }];
    case "setpiece/answered":
      // R-LUCK-008: going home for December is staged. The set piece is still open when its answer is told.
      if (state.setpiece.open?.entry === DECEMBER && event.answer === GO) {
        return [{ key: "line.setpiece.december-go", params: { setpiece: DECEMBER }, tone: "good", attention: true, big: true, counts: [] }];
      }
      return [];
    case "setpiece/followed-up":
      return [];
    case "setpiece/closed":
      return [{ key: "line.setpiece.closed", params: { setpiece: event.entry }, tone: "plain", attention: false, counts: [] }];
    case "setpiece/dropped":
      return [{ key: "line.setpiece.dropped", params: { setpiece: event.entry }, tone: "plain", attention: false, counts: [] }];
    default: {
      const never: never = event;
      throw new Error(`Unknown set piece event ${JSON.stringify(never)}.`);
    }
  }
}

/**
 * R-SHARE-001: the December card, once the visit opened at the last turn's end
 * has closed with the going answer given (R-LUCK-008), through the rest of that month.
 * The going question is the one this scene asks where the character is now.
 */
export function decemberCard(read: ReadCtx): PlayerView["card"] {
  if (!cardsAllowed(read) || read.state.setpiece.open?.entry === DECEMBER) return null;
  const opened = reportLines(read, "line.setpiece.opened").some((line) => line.params.setpiece === DECEMBER);
  const entry = read.content.setpiece[DECEMBER];
  if (!opened || entry === undefined) return null;
  const given = read.state.setpiece.given[DECEMBER] ?? {};
  const asked = entry.questions.filter((question) => question.when.every((requirement) => check(read, requirement).met));
  return asked.some((question) => given[question.id] === GO) ? cardOf(read, "december") : null;
}

/**
 * R-SETPIECE-005: one question at a time and never a score. With enough
 * interview prep, the answers that would score below zero now are marked.
 * R-SETPIECE-003: `allowed` lists the answers whose requirements hold now.
 */
function view(read: ReadCtx): Pick<PlayerView, "setpiece"> {
  const open = read.state.setpiece.open;
  if (open === null) return { setpiece: null };
  const entry = entryOf(read.content, open.entry);
  const next = nextQuestion(open);
  const hinted = (read.state.quality[PREP] ?? 0) >= read.content.tuning.route.hintPrep;
  const judge: Judge = (requirement) => check(read, requirement);
  const question = next === null ? null : questionOf(entry, next);
  const allowed = question === null ? [] : question.answers.filter((candidate) => answerAllowed(candidate, judge));
  return {
    setpiece: {
      entry: open.entry,
      asked: Object.keys(open.answers).length,
      total: open.questions.length,
      question:
        question === null
          ? null
          : {
              id: question.id,
              answers: question.answers.map((candidate) => candidate.id),
              allowed: allowed.map((candidate) => candidate.id),
              weak: hinted ? allowed.filter((candidate) => answerScore(candidate, judge) < 0).map((candidate) => candidate.id) : [],
              followUp: isFollowUp(entry, question.id),
            },
    },
  };
}

export const setpieceKind: RegisteredKind<SetpieceSlice, SetpieceEvent> = {
  kind: "setpiece",
  initial: () => ({ open: null, answered: {}, given: {} }),
  commands: { "setpiece/answer": answer },
  requirements: {
    // R-SETPIECE-006.
    "setpiece/answered": (read, requirement) => {
      if (requirement.type !== "setpiece/answered") throw new Error(`setpiece/answered cannot judge ${requirement.type}.`);
      const have = read.state.setpiece.answered[requirement.setpiece] ?? 0;
      const need = requirement.times ?? 1;
      return { met: have >= need, have, need };
    },
    "setpiece/answered-with": (read, requirement) => {
      if (requirement.type !== "setpiece/answered-with") throw new Error(`setpiece/answered-with cannot judge ${requirement.type}.`);
      const given = read.state.setpiece.given[requirement.setpiece]?.[requirement.question];
      return { met: given === requirement.answer };
    },
  },
  effects: {
    "setpiece/open": (ctx, effect) => {
      if (effect.type !== "setpiece/open") throw new Error(`The set piece kind cannot open from ${effect.type}.`);
      return openSetpiece(ctx, effect.setpiece, effect.route);
    },
    "setpiece/close": (ctx, effect) => {
      if (effect.type !== "setpiece/close") throw new Error(`The set piece kind cannot close from ${effect.type}.`);
      return closeSetpiece(ctx, effect.setpiece);
    },
  },
  evolve,
  lines,
  invariants(state, content) {
    const open = state.setpiece.open;
    if (open === null) return [];
    const entry = content.setpiece[open.entry];
    if (entry === undefined) return [`The open set piece ${open.entry} is not in content.`];
    const problems: string[] = [];
    if (open.questions.length === 0) problems.push(`${open.entry} is open with no questions.`);
    if (new Set(open.questions).size !== open.questions.length) problems.push(`${open.entry} asks a question twice.`);
    if (open.route !== null && content.route[open.route] === undefined) problems.push(`${open.entry} is open for ${open.route}, which is not a route in content.`);
    open.questions.forEach((id, index) => {
      const question = findQuestion(entry, id);
      if (question === undefined) {
        problems.push(`${open.entry} asks ${id}, which it does not have.`);
        return;
      }
      const given = open.answers[id];
      if (given !== undefined && !question.answers.some((candidate) => candidate.id === given)) problems.push(`${id} was answered with ${given}.`);
      const earlier = open.questions[index - 1];
      if (given !== undefined && earlier !== undefined && open.answers[earlier] === undefined) problems.push(`${id} was answered before ${earlier}.`);
      // R-SETPIECE-008: a follow-up sits right after the question answered with the answer that names it.
      const before = earlier === undefined ? undefined : findQuestion(entry, earlier);
      const named = before?.answers.find((candidate) => candidate.id === open.answers[earlier ?? ""])?.followUp;
      if (isFollowUp(entry, id) && named !== id) problems.push(`${open.entry} asks the follow-up ${id} where no answer before it names it.`);
    });
    for (const id of Object.keys(open.answers)) {
      if (!open.questions.includes(id)) problems.push(`${open.entry} holds an answer to ${id}, which it never asked.`);
    }
    return problems;
  },
  view,
};
