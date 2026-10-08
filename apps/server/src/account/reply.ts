// The account routes' refusals.
import type { ServerCode } from "../types";

export interface AccountRejection {
  ok: false;
  code: ServerCode;
  detail: string;
}

export function rejection(code: ServerCode, detail: string): AccountRejection {
  return { ok: false, code, detail };
}
