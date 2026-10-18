// Test support for content versions that rename ids. Nothing in the simulation imports this file.

/** Every string and key equal to an id in the table renamed, as a content version that renames ids would read. */
export function renamedDeep(value: unknown, renames: Record<string, string>): unknown {
  if (typeof value === "string") return renames[value] ?? value;
  if (Array.isArray(value)) return value.map((item) => renamedDeep(item, renames));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [renames[key] ?? key, renamedDeep(inner, renames)]));
  }
  return value;
}
