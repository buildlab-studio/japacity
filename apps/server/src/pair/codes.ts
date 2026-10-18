// The people routes' refusals beside the server's own (pair:invite-link-single-use,
// pair:phrase-checks-before-send, moderation:block-refuses-both-ways). Anything that turns on the other side is
// `not-possible` and nothing more.
import type { ServerCode } from "@japacity/api";
import type { SayRefusal } from "@japacity/sim";

import type { Answer, Status } from "../authority/answer";

/** The say check's refusals are all in ServerCode; the union keeps the two from drifting apart. */
export type PairCode = ServerCode | SayRefusal;

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

/** The one thing a refusal that turns on the other side may say (pair:phrase-checks-before-send, moderation:block-refuses-both-ways). */
export const NOT_POSSIBLE = "That is not possible now.";

/** A server answer known to be a refusal, as a pair answer of any reply. */
export function asRefusal(answer: { status: Status; body: { ok: boolean } }): { status: Status; body: PairRejection } {
  if (answer.body.ok) throw new Error("An accepted answer is not a refusal.");
  return answer as { status: Status; body: PairRejection };
}
