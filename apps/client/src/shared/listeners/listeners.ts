// The listeners of a module's own small store: who hears when it changes, for React's useSyncExternalStore or any
// other subscriber.

export interface Listeners<A extends unknown[] = []> {
  /** Starts listening; returns the way to stop. */
  subscribe: (listener: (...args: A) => void) => () => void;
  /** Tells every listener. */
  notify: (...args: A) => void;
}

export function listeners<A extends unknown[] = []>(): Listeners<A> {
  const heard = new Set<(...args: A) => void>();
  return {
    subscribe(listener) {
      heard.add(listener);
      return () => {
        heard.delete(listener);
      };
    },
    notify(...args) {
      for (const listener of heard) listener(...args);
    },
  };
}
