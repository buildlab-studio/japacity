// Browser storage held in memory, for the tests that hand the game its own storage.

/** Reads and writes only, with its map as `items`. With no `removeItem` the authority cannot forget a save (authority/local.ts). */
export function memoryStorage() {
  const items = new Map<string, string>();
  return { items, getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

/** The same storage that can also forget a key, as a life's end asks of the save's storage. */
export function removableStorage() {
  const storage = memoryStorage();
  return { ...storage, removeItem: (key: string) => void storage.items.delete(key) };
}
