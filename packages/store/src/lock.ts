/**
 * One async lock: each call waits for the one before to settle, so overlapping
 * calls run one after the other. A failed call releases the lock too.
 */
export function makeLock(): <T>(run: () => Promise<T>) => Promise<T> {
  let last: Promise<unknown> = Promise.resolve();
  return <T>(run: () => Promise<T>): Promise<T> => {
    const next = last.then(run);
    last = next.catch(() => undefined);
    return next;
  };
}
