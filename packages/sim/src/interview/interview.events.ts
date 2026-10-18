import type { Id, InterviewResult } from "../engine/types";

/** What the interview kind records: docs/rules/interview.md. */
export type InterviewEvent =
  /** `truths` is hidden: it goes only to `secret.truths` (interview:questions-drawn-from-record). `thin` is the record measured once (interview:draws-made-in-one-life). */
  | { type: "interview/opened"; pair: string; route: Id<"route">; questions: { id: string; options: string[] }[]; standIn: boolean; thin: boolean; truths: (string | null)[] }
  /** `standIn` is true when the stand-in gave this answer (interview:stand-in-answers-when-absent). */
  | { type: "interview/answered"; question: string; option: string; standIn: boolean }
  | { type: "interview/closed"; pair: string }
  /** `standIn` marks whose answers were a stand-in's (interview:stand-in-answers-when-absent), as `InterviewSlice.last` keeps them. */
  | { type: "interview/scored"; pair: string; route: Id<"route">; result: InterviewResult; matched: number; asked: number; month: number; standIn: { a: boolean; b: boolean } }
  | { type: "interview/withdrawn"; pair: string; route: Id<"route"> };
