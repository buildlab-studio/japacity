import type { StoreCode } from "./types";

/** A refusal with its code narrowed, so a store's result type can name the codes it gives. */
export function refuse<C extends StoreCode>(code: C, detail: string): { ok: false; code: C; detail: string } {
  return { ok: false, code, detail };
}
