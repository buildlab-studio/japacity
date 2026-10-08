// What a route answers: a status and a body of the HTTP contract in types.ts.
import type { ServerCode, ServerRejection } from "../types";

/** The statuses the routes use. A simulation's rejection is a game answer and goes out as 200. */
export type Status = 200 | 400 | 401 | 404 | 409 | 429;

export interface Answer<B> {
  status: Status;
  body: B | ServerRejection;
}

export function refusal(status: Exclude<Status, 200>, code: ServerCode, detail: string): { status: Status; body: ServerRejection } {
  return { status, body: { ok: false, code, detail } };
}
