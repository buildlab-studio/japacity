import type { BaseEvent, Rejection, RejectionCode } from "./types";

export function reject(code: RejectionCode, detail: string, reason?: Rejection["reason"]): Rejection {
  return reason === undefined ? { ok: false, code, detail } : { ok: false, code, detail, reason };
}

export function isRejection(value: BaseEvent[] | Rejection): value is Rejection {
  return !Array.isArray(value);
}
