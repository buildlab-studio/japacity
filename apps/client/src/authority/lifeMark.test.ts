// world:lazy-part-fails-softly: a browser where a life opened keeps a mark, so the next load fetches the life's screens at once even where
// only the account knows the character; the mark goes when the browser is left with no life to open.
import { describe, expect, test } from "vitest";

import { engineView } from "../shared/testing/fixtures";
import { removableStorage } from "../shared/testing/storage";
import { LIFE_MARK_KEY } from "../shared/storage/storage";
import { followLifeMark, lifeMarked } from "./lifeMark";
import { createGameStore } from "./store";

/** A store over a life the server holds, its life endable, with the mark followed in its own storage. */
function followed(marked = false) {
  const storage = removableStorage();
  if (marked) storage.setItem(LIFE_MARK_KEY, "1");
  const store = createGameStore(
    { view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("not sent")) },
    { life: { newLife: () => Promise.resolve(engineView()), endLife: () => Promise.resolve(true) }, lifeAgain: false },
  );
  followLifeMark(store, storage);
  return { store, storage, mark: () => storage.items.get(LIFE_MARK_KEY) ?? null };
}

describe("the mark of a life opened in this browser (world:lazy-part-fails-softly)", () => {
  test("[world:lazy-part-fails-softly] given a browser with no mark, when the first view is still coming, then nothing is marked; when the life opens, then the mark is kept", async () => {
    const { store, mark, storage } = followed();
    expect(mark()).toBeNull();
    await store.getState().refresh();
    expect(mark()).toBe("1");
    expect(lifeMarked(storage)).toBe(true);
  });

  test("[world:lazy-part-fails-softly] given a life chosen at the door, when it opens, then the mark is kept", async () => {
    const { store, mark } = followed();
    store.getState().heard({ kind: "no-character" });
    await store.getState().chooseLife("scenario.graduate");
    expect(mark()).toBe("1");
  });

  test("[world:lazy-part-fails-softly] given a marked browser with its life open, when the player signs out or deletes the account, then the mark goes", async () => {
    for (const notice of ["ui.account.notice.signed-out", "ui.account.notice.deleted", null] as const) {
      const { store, mark } = followed(true);
      await store.getState().refresh();
      store.getState().leave(notice);
      expect({ notice, mark: mark() }).toEqual({ notice, mark: null });
    }
  });

  test("[world:lazy-part-fails-softly] given a marked browser, when the server says it is signed out or its account has no character, then the mark goes", () => {
    for (const kind of ["signed-out", "no-character"] as const) {
      const { store, mark } = followed(true);
      store.getState().heard({ kind });
      expect({ kind, mark: mark() }).toEqual({ kind, mark: null });
    }
  });

  test("[world:lazy-part-fails-softly] given a marked browser with its life open, when the life ends and no other life is chosen, then the mark goes; when the next life opens, then it is kept again", async () => {
    const { store, mark } = followed(true);
    await store.getState().refresh();
    expect(await store.getState().endLife?.()).toBe(true);
    expect(mark()).toBeNull();
    await store.getState().chooseLife("scenario.graduate");
    expect(mark()).toBe("1");
  });

  test("[world:lazy-part-fails-softly] given a stale mark, when the first view is still coming, then the mark stays as it is until the server answers", () => {
    const { mark } = followed(true);
    expect(mark()).toBe("1");
  });

  test("[world:lazy-part-fails-softly] given storage that throws, when a life opens or the mark is read, then nothing breaks and no mark is read", async () => {
    const refused = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("SecurityError"); }, removeItem: () => { throw new Error("SecurityError"); } };
    const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("not sent")) });
    followLifeMark(store, refused);
    await store.getState().refresh();
    expect(store.getState().view).not.toBeNull();
    expect(lifeMarked(refused)).toBe(false);
    expect(lifeMarked(null)).toBe(false);
  });
});
