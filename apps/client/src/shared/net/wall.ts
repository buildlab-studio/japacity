// account:session-is-secure-cookie, engine:browser-authority-for-dev-only: the login wall in front of staging (Cloudflare Access). A fetch cannot pass it: Access answers an /api request without its cookie with a redirect to
// its own login on another origin, which a fetch must not follow. Only the page can: so the first wall reloads the
// whole page once, and Access shows its login. A second wall within a minute means the reload did not get through, so
// nothing reloads again and the card with Reload says it instead. A reply from the game clears the mark, but only
// one that comes 3 s or more after the reload: on a host walled in part, a route that answers at once beside one that
// is walled must not clear it, or the page would reload for ever.
import { browserStorage, WALL_KEY } from "../storage/storage";

/** A second wall sooner than this after the reload shows the card instead of reloading again. */
export const WALL_AGAIN_MS = 60_000;

/** A reply this soon after the reload's mark leaves it standing. */
export const WALL_SETTLE_MS = 3_000;

export interface WallGuard {
  /** A wall was met. True when the page is reloading for it, so nothing else needs to say it. */
  met(): boolean;
  /** The game answered: the way through the wall is open. */
  passed(): void;
}

type TabStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface WallOptions {
  storage: () => TabStore | null;
  now: () => number;
  reload: () => void;
}

export function wallGuard({ storage, now, reload }: WallOptions): WallGuard {
  return {
    met() {
      const store = storage();
      // Without a place to mark the reload, a loop cannot be told from a first time: the card says it instead.
      if (store === null) return false;
      try {
        const last = Number(store.getItem(WALL_KEY) ?? "");
        if (Number.isFinite(last) && last > 0 && now() - last < WALL_AGAIN_MS) return false;
        store.setItem(WALL_KEY, String(now()));
      } catch {
        return false;
      }
      reload();
      return true;
    },
    passed() {
      try {
        const store = storage();
        const last = Number(store?.getItem(WALL_KEY) ?? "");
        if (!Number.isFinite(last) || last <= 0 || now() - last < WALL_SETTLE_MS) return;
        store?.removeItem(WALL_KEY);
      } catch {
        // A blocked storage holds no mark to clear.
        return;
      }
    },
  };
}

/** The page's own guard: this tab's session storage, the device's clock, and a reload of the page. */
export const pageWall: WallGuard = wallGuard({
  storage: () => browserStorage("session"),
  now: () => Date.now(),
  reload: () => location.reload(),
});
