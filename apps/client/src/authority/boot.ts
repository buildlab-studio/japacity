// Starts the game in the tab: the server when the build names one, or the
// local authority on the right clock; and the store the screens read. A lost
// local save is said out loud on the life chooser.
import type { AccountReply } from "@japacity/api";

import { setUsageCounts, startCounting } from "../shared/analytics/start";
import { readAccount } from "../shared/net/account";
import { betterAuthApi } from "../shared/net/auth";
import { clockMode } from "./clock";
import type { LocalAuthorityOptions } from "./local";
import { authorityMode } from "../shared/net/authorityMode";
import { goOnline } from "./online";
import { remoteAuthority } from "./remote";
import { followLifeMark } from "./lifeMark";
import { createGameStore, type GameStore } from "./store";
import { MORNING_KEY } from "../shared/storage/storage";

/**
 * engine:browser-authority-for-dev-only: the in-browser authority, fetched by a dynamic import only in a build that names no server
 * (development, tests, offline play). A player's build names its server, so the bundler drops this import and a player never
 * downloads the local authority.
 */
const local = import.meta.env.VITE_SERVER_URL ? null : await import("./local");

/** The account's row as the server answered it when the game started online; null before, and with the local authority. */
let accountRead: Promise<AccountReply> | null = null;

/**
 * server:unknown-address-becomes-root, moderation:admin-view-for-admin-list: the one account read the game makes as it starts,
 * so the address is judged on it with no request of its own.
 */
export function accountAtBoot(): Promise<AccountReply> | null {
  return accountRead;
}

export function bootGame(options: Partial<LocalAuthorityOptions> = {}): GameStore {
  const mode = authorityMode();
  switch (mode.authority) {
    case "refused":
      throw new Error(mode.why);
    case "remote":
      return bootRemote(mode.baseUrl);
    case "local":
      return bootLocal(options);
    default: {
      const never: never = mode;
      throw new Error(`Unknown authority mode: ${JSON.stringify(never)}`);
    }
  }
}

/** account:start-a-new-life: once a life has ended, the page loads afresh on the door, so nothing the old life held in memory stays. */
function loadAfresh(): void {
  location.reload();
}

/**
 * clock:envelopes-show-real-waits, development only: `?morning=now` on the address opens every sealed result at once and `?morning=off`
 * lets them wait for the game's own morning, so a tester on a phone needs no console.
 */
function takeMorningSwitch(): void {
  if (!import.meta.env.DEV || typeof location === "undefined") return;
  const asked = new URLSearchParams(location.search).get("morning");
  if (asked === null) return;
  try {
    if (asked === "now") localStorage.setItem(MORNING_KEY, "now");
    else localStorage.removeItem(MORNING_KEY);
  } catch {
    // Storage blocked: the switch does nothing, and the envelopes keep their mornings.
    return;
  }
}

function bootLocal(options: Partial<LocalAuthorityOptions>): GameStore {
  takeMorningSwitch();
  if (local === null) throw new Error("This build names a server, so it carries no local authority.");
  const authority = local.localAuthority({ fastClock: clockMode().fastClock, ...options });
  const { start } = authority;
  const store = createGameStore(authority, {
    life: authority,
    rememberMonth: true,
    afterLifeEnded: loadAfresh,
    choosingLife: start.kind !== "loaded",
    notice: start.kind === "replaced" ? `ui.life.notice.${start.why}` : null,
  });
  followMorning(store);
  followLifeMark(store);
  return store;
}

/**
 * clock:envelopes-show-real-waits: back on the tab, from another app or a night's sleep, the view is read again and with it the results
 * whose morning has come. Online, `goOnline` reads the view on the same signs.
 */
function followMorning(store: GameStore): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const refresh = () => void store.getState().refresh();
  window.addEventListener("focus", refresh);
  window.addEventListener("pageshow", refresh);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
}

function bootRemote(baseUrl: string): GameStore {
  const remote = remoteAuthority({ baseUrl });
  // One life per account online (account:one-character-per-account): the chooser opens only when the server says there is none.
  const store = createGameStore(remote, { life: remote, lifeAgain: false, rememberMonth: true, afterLifeEnded: loadAfresh, account: betterAuthApi({ baseUrl }) });
  goOnline({ store, remote });
  followLifeMark(store);
  startCounting({ baseUrl });
  // analytics:player-can-stop-usage-counts: an account that turned the counters off stays off from the first screen.
  accountRead = readAccount(remote.api);
  void accountRead.then((reply) => {
    if (reply.ok && reply.account.sendUsageCounts === false) setUsageCounts(false);
  });
  return store;
}
