// A stable hash of plain data, for goldens and determinism tests. Keys are
// sorted so two equal states hash the same whatever order they were built in.
import { hashString32 } from "./random";

/** JSON with every object's keys sorted. Equal plain data gives equal text. */
export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  const record = value as Record<string, unknown>;
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

/** A 64-bit hash as 16 hex digits: two 32-bit FNV-1a passes over the stable text. */
export function hashState(value: unknown): string {
  const text = stableJson(value);
  const a = hashString32(text);
  const b = hashString32(`${String(a)}/${text}`);
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}
