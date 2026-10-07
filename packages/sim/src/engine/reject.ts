import type { BaseEvent, Rejection, RejectionCode } from "./types";

export function reject(code: RejectionCode, detail: string): Rejection {
  return { ok: false, code, detail };
}

export function isRejection(value: BaseEvent[] | Rejection): value is Rejection {
  return !Array.isArray(value);
}
