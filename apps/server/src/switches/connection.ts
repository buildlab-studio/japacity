// The switch store's database handle in the Worker. The row is read once per
// cache period per isolate (R-SERVER-031), so each call opens its own client
// and closes it: a client is never held across requests, as Hyperdrive asks.
import type { Connection, Handle } from "@japacity/db";

export function perCallHandle(open: () => Promise<Pick<Connection, "handle" | "close">>): Handle {
  const within = async <T>(run: (handle: Handle) => Promise<T>): Promise<T> => {
    const { handle, close } = await open();
    try {
      return await run(handle);
    } finally {
      await close();
    }
  };
  return {
    read: (run) => within((handle) => handle.read(run)),
    transaction: (run) => within((handle) => handle.transaction(run)),
  };
}
