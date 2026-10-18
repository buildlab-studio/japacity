// What goes into a memory store and what comes out is copied through JSON,
// so a caller can never change a stored row by holding on to it, and a row
// reads back as it would from a JSON column in Postgres.

export function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function accept<T>(value: T): { ok: true; value: T } {
  return { ok: true, value: copy(value) };
}
