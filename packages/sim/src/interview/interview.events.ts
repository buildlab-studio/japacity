import type { Id, InterviewResult } from "../engine/types";

/** What the interview kind records: docs/rules/interview.md. */
export type InterviewEvent =
  /** `truths` is hidden: it goes only to `secret.truths` (R-INTERVIEW-003). `thin` is the record measured once (R-INTERVIEW-012). */
  | { type: "interview/opened"; pair: string; route: Id<"route">; questions: { id: string; options: string[] }[]; standIn: boolean; thin: boolean; truths: (string | null)[] }
  /** `standIn` is true when the stand-in gave this answer (R-INTERVIEW-008). */
  | { type: "interview/answered"; question: string; option: string; standIn: boolean }
  | { type: "interview/closed"; pair: string }
  | { type: "interview/scored"; pair: string; route: Id<"route">; result: InterviewResult; matched: number; asked: number; month: number }
  | { type: "interview/withdrawn"; pair: string; route: Id<"route"> };
