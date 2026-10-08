// The genuineness interview: docs/rules/interview.md. Not built yet beyond the
// slice, the stub commands and the view: the people milestone's interview agent
// fills the commands, the scoring, the lines and the ban.
import type { RegisteredKind } from "../engine/kind";
import { reject } from "../engine/reject";
import type { InterviewSlice, PlayerView, ReadCtx, ReportLine } from "../engine/types";
import type { InterviewEvent } from "./interview.events";

function evolve(slice: InterviewSlice, event: InterviewEvent): InterviewSlice {
  switch (event.type) {
    case "interview/opened":
    case "interview/answered":
    case "interview/closed":
    case "interview/scored":
    case "interview/withdrawn":
      return slice;
    default: {
      const never: never = event;
      throw new Error(`Unknown interview event ${JSON.stringify(never)}.`);
    }
  }
}

function lines(): ReportLine[] {
  return [];
}

function view(read: ReadCtx): Pick<PlayerView, "interview"> {
  const open = read.state.interview.open;
  if (open === null) return { interview: null };
  const next = open.questions[open.answers.length] ?? null;
  return { interview: { route: open.route, question: next, asked: open.answers.length, total: open.questions.length, waiting: next === null, standIn: open.standIn, result: null, matched: null } };
}

const rejectNotBuilt = () => reject("not-legal", "The interview is not built yet.");

export const interviewKind: RegisteredKind<InterviewSlice, InterviewEvent> = {
  kind: "interview",
  initial: () => ({ open: null, last: null, secret: { truths: null } }),
  commands: { "interview/answer": rejectNotBuilt, "interview/open": rejectNotBuilt, "interview/scored": rejectNotBuilt },
  evolve,
  lines,
  view,
};
