// The people routes' refusals beside the server's own (pair.md R-PAIR-008,
// R-PAIR-013, R-MODERATION-001). Anything that turns on the other side is
// `not-possible` and nothing more.
import type { SayRefusal } from "@japacity/sim";

import type { Answer, Status } from "../authority/answer";
import type { ServerCode } from "../types";

/** the codes after ServerCode are not in types.ts's ServerCode; the maintainer decides whether they join it. */
export type PairCode = ServerCode | SayRefusal | "used" | "expired" | "wrong-slot" | "not-adult";

export interface PairRejection {
  ok: false;
  code: PairCode;
  detail: string;
  /** Seconds, with `rate-limited` only. */
  retryAfter?: number;
}

export type PairAnswer<B> = { status: Status; body: B | PairRejection };

export function refused(status: Status, code: PairCode, detail: string): { status: Status; body: PairRejection } {
  return { status, body: { ok: false, code, detail } };
}

/** A server answer as a pair answer: the codes are a superset. */
export function widen<B>(answer: Answer<B>): PairAnswer<B> {
  return answer;
}

/** The one thing a refusal that turns on the other side may say (R-PAIR-013, R-MODERATION-001). */
export const NOT_POSSIBLE = "That is not possible now.";

/** A server answer known to be a refusal, as a pair answer of any reply. */
export function asRefusal(answer: { status: Status; body: { ok: boolean } }): { status: Status; body: PairRejection } {
  if (answer.body.ok) throw new Error("An accepted answer is not a refusal.");
  return answer as { status: Status; body: PairRejection };
}
