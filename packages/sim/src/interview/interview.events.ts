import type { Id, InterviewResult } from "../engine/types";

/** What the interview kind records: docs/rules/interview.md. */
export type InterviewEvent =
  | { type: "interview/opened"; pair: string; route: Id<"route">; questions: { id: string; options: string[] }[]; standIn: boolean }
  | { type: "interview/answered"; question: string; option: string }
  | { type: "interview/closed"; pair: string }
  | { type: "interview/scored"; pair: string; route: Id<"route">; result: InterviewResult; matched: number; asked: number; month: number }
  | { type: "interview/withdrawn"; pair: string };
