// Content is one plain object and every number the game runs on is read from
// it (R-ENGINE-017). An overlay replaces any part of it, applied once at load,
// and the result is checked before anything plays on it (R-ENGINE-014).
import { ContentSchema } from "../schemas";
import { checkContent } from "./content";
import type { Content } from "./types";

/** Any part of a plain object, to any depth. Arrays are replaced whole. */
export type Part<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: Part<T[K]> }
    : T;

/**
 * An overlay: the version that names it, which the save records (R-ENGINE-010),
 * and any part of the content to replace. The content's own version is never
 * replaced, so a save still names the content it was made with.
 */
export type Overlay = { version: string } & Part<Omit<Content, "version" | "overlay">>;

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

/**
 * A copy of the content with the overlay's values in place of the defaults,
 * and the overlay's version recorded on it. Neither input is changed. Throws
 * when the result does not fit the schemas or fails `checkContent`, so content
 * that would break a rule is refused at load.
 */
export function applyOverlay(content: Content, overlay: Overlay): Content {
  const { version, ...changes } = overlay;
  const merged = { ...(merge(content, changes) as Content), overlay: version };
  const parsed = ContentSchema.safeParse(merged);
  if (!parsed.success) {
    const where = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`The overlay ${version} does not fit the content schemas: ${where}`);
  }
  const problems = checkContent(merged);
  if (problems.length > 0) throw new Error(`The overlay ${version} fails the content check: ${problems.join(" ")}`);
  return merged;
}
