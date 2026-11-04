// world:lazy-part-fails-softly, server:production-and-staging: a tab opened before a release asks for the old build's parts, which the new
// one no longer has. When a part of the game fails to download, the page the server serves now is read once with no cache; when its
// build (`<meta name="japacity-build">`) differs from this page's own, the page reloads once to the new build. A mark in the tab's
// storage keeps it to once: it stands until the life's screens have loaded, so a reload that did not help leaves the connection card
// to say it, never a loop. When the builds match, or either cannot be read, the failure stays the soft one with Retry.
// What the player has survives the reload: online the life is the server's, and the door's run, the person and the month in play
// are kept on the device (engine:browser-authority-for-dev-only).
import { READ_TIMEOUT_MS } from "./http";
import { buildOf, STAMP_META } from "../build-stamp/stamp";
import { browserStorage, STALE_KEY } from "../storage/storage";

type TabStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface StaleGuard {
  /** A part failed to download. True when the page is reloading to the server's newer build, so nothing else needs to say it. */
  failed(): Promise<boolean>;
  /** The life's screens loaded: the build is the server's, and a later release may reload this tab once again. */
  loaded(): void;
}

export interface StaleOptions {
  storage: () => TabStore | null;
  /** This page's build, or null when it carries none. */
  own: () => string | null;
  /** The build of the page the server serves now, or null when it could not be read. */
  live: () => Promise<string | null>;
  reload: () => void;
}

/** The marked build in a page's markup, read without parsing it as a document (no script sink under Trusted Types). */
const STAMP_TAG = new RegExp(`<meta\\s[^>]*name=["']${STAMP_META}["'][^>]*>`, "i");
const CONTENT = /content=["']([^"']*)["']/i;

/** The build a page's markup carries, or null. */
export function buildIn(markup: string): string | null {
  const tag = STAMP_TAG.exec(markup)?.[0];
  if (tag === undefined) return null;
  return CONTENT.exec(tag)?.[1] ?? null;
}

export function staleGuard({ storage, own, live, reload }: StaleOptions): StaleGuard {
  return {
    async failed() {
      const store = storage();
      // Without a place to mark the reload, a loop cannot be told from a first time: the card says it instead.
      if (store === null) return false;
      try {
        if (store.getItem(STALE_KEY) !== null) return false;
      } catch {
        return false;
      }
      const mine = own();
      if (mine === null) return false;
      const theirs = await live().catch(() => null);
      if (theirs === null || theirs === mine) return false;
      try {
        store.setItem(STALE_KEY, "1");
      } catch {
        return false;
      }
      reload();
      return true;
    },
    loaded() {
      try {
        storage()?.removeItem(STALE_KEY);
      } catch {
        // A blocked storage holds no mark to clear.
      }
    },
  };
}

/** The page the server serves now, asked with no cache, same origin, no redirect followed, on a read's clock. */
async function livePage(): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
  try {
    const response = await globalThis.fetch("/", { cache: "no-store", credentials: "same-origin", redirect: "manual", signal: controller.signal, headers: { accept: "text/html" } });
    if (!response.ok) return null;
    return buildIn(await response.text());
  } finally {
    clearTimeout(timer);
  }
}

/** The page's own guard: this tab's session storage, the page's tag, the served page and a reload. */
export const pageStale: StaleGuard = staleGuard({
  storage: () => browserStorage("session"),
  own: () => (typeof document === "undefined" ? null : buildOf(document)),
  live: livePage,
  reload: () => location.reload(),
});
