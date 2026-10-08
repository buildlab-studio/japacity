// The account routes' refusals.
import type { ServerCode } from "../types";

// ServerCode has no code for these five; it is added to types.ts or names others.
export type AccountCode = ServerCode | "under-age" | "bad-date" | "bot-check" | "not-fresh" | "bad-code";

export interface AccountRejection {
  ok: false;
  code: AccountCode;
  detail: string;
}

export function rejection(code: AccountCode, detail: string): AccountRejection {
  return { ok: false, code, detail };
}
