// The view: all the interface ever sees (R-ENGINE-007). Every kind gives its
// part and the engine joins them, adds japacity, and refuses to hand out a
// view with a key missing.
import { japacity } from "../japacity/japacity.logic";
import { registry } from "../kinds";
import type { Registry } from "./kind";
import type { PlayerView, ReadCtx } from "./types";

/** Every key of PlayerView. Fails to compile when the type gains or loses one. */
export const VIEW_KEYS = [
  "v",
  "scenario",
  "month",
  "ended",
  "turns",
  "japacity",
  "qualities",
  "job",
  "freeSlots",
  "activities",
  "lastSlots",
  "pockets",
  "queued",
  "rates",
  "bankAllowanceLeft",
  "documents",
  "routes",
  "setpiece",
  "obligations",
  "offers",
  "chapter",
  "news",
  "report",
] as const satisfies readonly (keyof PlayerView)[];

export const VIEW_KEYS_COMPLETE: [Exclude<keyof PlayerView, (typeof VIEW_KEYS)[number]>] extends [never] ? true : never = true;

/** Names that must never appear as a key anywhere in a view. */
export const HIDDEN_KEYS = ["seed", "draws", "secret"] as const;

/** Walks any value and returns the paths of keys named in HIDDEN_KEYS. Empty when the view is clean. */
export function hiddenPaths(value: unknown, path = ""): string[] {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => hiddenPaths(item, `${path}[${String(index)}]`));
  const found: string[] = [];
  for (const [key, inner] of Object.entries(value)) {
    const here = path === "" ? key : `${path}.${key}`;
    if ((HIDDEN_KEYS as readonly string[]).includes(key)) found.push(here);
    found.push(...hiddenPaths(inner, here));
  }
  return found;
}

/** The view for a given registry. Tests use this to swap kinds in. */
export function viewWith(kinds: Registry, read: ReadCtx): PlayerView {
  const joined: Partial<PlayerView> = { japacity: japacity(read) };
  for (const kind of kinds) {
    const part = kind.view?.(read) ?? {};
    for (const key of Object.keys(part)) {
      if (key in joined) throw new Error(`Two kinds give the view key ${key}; the ${kind.kind} kind is the second.`);
    }
    Object.assign(joined, part);
  }
  const missing = VIEW_KEYS.filter((key) => !(key in joined));
  if (missing.length > 0) throw new Error(`No kind gives the view keys: ${missing.join(", ")}.`);
  return joined as PlayerView;
}

/** What one player may see of the state. */
export function viewFor(read: ReadCtx): PlayerView {
  return viewWith(registry(), read);
}
