// Set pieces: docs/rules/route.md, R-SETPIECE-001 to 005. A set piece is a
// short run of questions that blocks the next turn until it is answered. The
// one in this milestone is the credibility interview a visa application opens.
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
  Requirement,
  RequirementResult,
  SetpieceAnswer,
  SetpieceEntry,
  SetpieceQuestion,
  SetpieceSlice,
} from "../engine/types";
import type { SetpieceEvent } from "./setpiece.events";

const PREP: Id<"quality"> = "quality.interview-prep";

type Open = NonNullable<SetpieceSlice["open"]>;
type Judge = (requirement: Requirement) => RequirementResult;

function entryOf(content: Content, id: Id<"setpiece">): SetpieceEntry {
  const entry = content.setpiece[id];
  if (entry === undefined) throw new Error(`The content has no set piece ${id}.`);
  return entry;
}

function questionOf(entry: SetpieceEntry, id: string): SetpieceQuestion {
  const question = entry.questions.find((candidate) => candidate.id === id);
  if (question === undefined) throw new Error(`${entry.id} has no question ${id}.`);
  return question;
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

/**
 * R-SETPIECE-001: opens the set piece with `ask` questions drawn on `visa`
 * without repeats from those whose conditions hold, kept in the order drawn.
 * The route kind calls this when an application goes in (R-ROUTE-015).
 *
 * the contract has no effect that opens a set piece, so the route
 * calls this function, and the set piece's own event is applied through
 * `emit`. A set piece already open is left as it is, and with no question to
 * ask the interview scores 0 at once rather than open with nothing to answer,
 * which would leave the player stuck (R-ENGINE-011).
 */
export function openSetpiece(ctx: Ctx, id: Id<"setpiece">, route: Id<"route"> | null): BaseEvent[] {
  if (ctx.state.setpiece.open !== null) return [];
  const entry = entryOf(ctx.content, id);
  const pool = entry.questions.filter((question) => question.when.every((requirement) => ctx.check(requirement).met)).map((question) => question.id);
  const questions: string[] = [];
  while (questions.length < entry.ask && pool.length > 0) {
    const [drawn] = pool.splice(ctx.random.int("visa", pool.length), 1);
    if (drawn !== undefined) questions.push(drawn);
  }
  if (questions.length === 0) {
    if (route !== null) ctx.apply([{ type: "route/interview-scored", route, score: 0 }], { source: id, param: null, terms: {} });
    return [];
  }
  const opened: SetpieceEvent = { type: "setpiece/opened", entry: id, route, questions };
  return emit(ctx, "setpiece", [opened]);
}

/**
 * R-SETPIECE-003 and 004. the brief judges each answer's conditions
 * at the moment it is given, but the contract's slice keeps only the answer
 * ids and no running score. So every answer is judged when the last one is
 * given, in the same command. Between answers only the between-turn commands
 * can run, and of what the answers read, only the unexplained share can move.
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
  const answered: SetpieceEvent = { type: "setpiece/answered", question: next, answer: chosen.id };
  const events = emit(ctx, "setpiece", [answered]);
  // R-SETPIECE-006: an answer's effects apply the moment it is given.
  if (chosen.effects.length > 0) ctx.apply(chosen.effects, { source: open.entry, param: null, terms: {} });
  const now = ctx.state.setpiece.open;
  if (now === null || nextQuestion(now) !== null) return events;
  const judge: Judge = (requirement) => ctx.check(requirement);
  const score = now.questions.reduce((sum, id) => {
    const given = questionOf(entry, id).answers.find((candidate) => candidate.id === now.answers[id]);
    if (given === undefined) throw new Error(`${id} was answered with ${String(now.answers[id])}, which is not one of its answers.`);
    return sum + answerScore(given, judge);
  }, 0);
  const closed: SetpieceEvent = { type: "setpiece/closed", entry: now.entry, route: now.route };
  events.push(...emit(ctx, "setpiece", [closed]));
  if (now.route !== null) ctx.apply([{ type: "route/interview-scored", route: now.route, score }], { source: now.entry, param: null, terms: {} });
  return events;
}

function evolve(slice: SetpieceSlice, event: SetpieceEvent): SetpieceSlice {
  switch (event.type) {
    case "setpiece/opened":
      return { ...slice, open: { entry: event.entry, route: event.route, questions: event.questions, answers: {}, score: 0 } };
    case "setpiece/answered": {
      if (slice.open === null) throw new Error(`${event.question} was answered with no set piece open.`);
      return { ...slice, open: { ...slice.open, answers: { ...slice.open.answers, [event.question]: event.answer } } };
    }
    case "setpiece/closed":
      return { open: null, answered: { ...slice.answered, [event.entry]: (slice.answered[event.entry] ?? 0) + 1 } };
    default: {
      const never: never = event;
      throw new Error(`Unknown set piece event ${JSON.stringify(never)}.`);
    }
  }
}

function lines(event: SetpieceEvent): ReportLine[] {
  switch (event.type) {
    case "setpiece/opened":
      // It blocks the next turn, so the player must look.
      return [{ key: "line.setpiece.opened", params: { setpiece: event.entry, questions: event.questions.length }, tone: "plain", attention: true, counts: [] }];
    case "setpiece/answered":
      return [];
    case "setpiece/closed":
      return [{ key: "line.setpiece.closed", params: { setpiece: event.entry }, tone: "plain", attention: false, counts: [] }];
    default: {
      const never: never = event;
      throw new Error(`Unknown set piece event ${JSON.stringify(never)}.`);
    }
  }
}

/**
 * R-SETPIECE-005: one question at a time and never a score. With enough
 * interview prep, the answers that would score below zero now are marked.
 */
function view(read: ReadCtx): Pick<PlayerView, "setpiece"> {
  const open = read.state.setpiece.open;
  if (open === null) return { setpiece: null };
  const entry = entryOf(read.content, open.entry);
  const next = nextQuestion(open);
  const hinted = (read.state.quality[PREP] ?? 0) >= read.content.tuning.route.hintPrep;
  const judge: Judge = (requirement) => check(read, requirement);
  const question = next === null ? null : questionOf(entry, next);
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
              weak: hinted ? question.answers.filter((candidate) => answerScore(candidate, judge) < 0).map((candidate) => candidate.id) : [],
            },
    },
  };
}

export const setpieceKind: RegisteredKind<SetpieceSlice, SetpieceEvent> = {
  kind: "setpiece",
  initial: () => ({ open: null, answered: {} }),
  commands: { "setpiece/answer": answer },
  requirements: {
    // R-SETPIECE-006.
    "setpiece/answered": (read, requirement) => {
      if (requirement.type !== "setpiece/answered") throw new Error(`setpiece/answered cannot judge ${requirement.type}.`);
      const have = read.state.setpiece.answered[requirement.setpiece] ?? 0;
      const need = requirement.times ?? 1;
      return { met: have >= need, have, need };
    },
  },
  effects: {
    "setpiece/open": (ctx, effect) => {
      if (effect.type !== "setpiece/open") throw new Error(`The set piece kind cannot open from ${effect.type}.`);
      return openSetpiece(ctx, effect.setpiece, effect.route);
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
      const question = entry.questions.find((candidate) => candidate.id === id);
      if (question === undefined) {
        problems.push(`${open.entry} asks ${id}, which it does not have.`);
        return;
      }
      const given = open.answers[id];
      if (given !== undefined && !question.answers.some((candidate) => candidate.id === given)) problems.push(`${id} was answered with ${given}.`);
      const earlier = open.questions[index - 1];
      if (given !== undefined && earlier !== undefined && open.answers[earlier] === undefined) problems.push(`${id} was answered before ${earlier}.`);
    });
    for (const id of Object.keys(open.answers)) {
      if (!open.questions.includes(id)) problems.push(`${open.entry} holds an answer to ${id}, which it never asked.`);
    }
    return problems;
  },
  view,
};
