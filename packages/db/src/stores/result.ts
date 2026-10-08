import type { StoreCode } from "@japacity/store";

export function refuse<C extends StoreCode>(code: C, detail: string): { ok: false; code: C; detail: string } {
  return { ok: false, code, detail };
}

export function accept<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}
