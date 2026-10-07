// Content is one plain object and every number the game runs on is read from
// it (R-ENGINE-017). An overlay replaces any part of it, applied once at load.
import type { Content } from "./types";

/** Any part of a plain object, to any depth. Arrays are replaced whole. */
export type Overlay<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: Overlay<T[K]> }
    : T;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function merge(base: unknown, over: unknown): unknown {
  if (over === undefined) return base;
  if (isPlainObject(base) && isPlainObject(over)) {
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(over)) out[key] = merge(base[key], value);
    return out;
  }
  return over;
}

/** A copy of the content with the overlay's values in place of the defaults. Neither input is changed. */
export function applyOverlay(content: Content, overlay: Overlay<Content>): Content {
  return merge(content, overlay) as Content;
}
