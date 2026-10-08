// What goes into a memory store and what comes out is copied through JSON,
// so a caller can never change a stored row by holding on to it, and a row
// reads back as it would from a JSON column in Postgres.

export function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function refuse<C extends string>(code: C, detail: string): { ok: false; code: C; detail: string } {
  return { ok: false, code, detail };
}

export function accept<T>(value: T): { ok: true; value: T } {
  return { ok: true, value: copy(value) };
}

/**
 * One async lock: each call waits for the one before to settle, so overlapping
 * writes run one after the other. A failed call releases the lock too.
 */
export function makeLock(): <T>(run: () => Promise<T>) => Promise<T> {
  let last: Promise<unknown> = Promise.resolve();
  return <T>(run: () => Promise<T>): Promise<T> => {
    const next = last.then(run);
    last = next.catch(() => undefined);
    return next;
  };
}
