// Starts the game in the tab: the server when the build names one, or the
// local authority on the right clock; and the store the screens read. A lost
// local save is said out loud on the life chooser.
import { setUsageCounts, startCounting } from "../shared/analytics/start";
import { readAccount } from "../shared/net/account";
import { betterAuthApi } from "../shared/net/auth";
import { clockMode } from "./clock";
import { localAuthority, type LocalAuthorityOptions, MORNING_KEY } from "./local";
import { authorityMode } from "./mode";
import { goOnline } from "./online";
import { remoteAuthority } from "./remote";
import { createGameStore, type GameStore } from "./store";

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

/** R-ACCOUNT-030: once a life has ended, the page loads afresh on the door, so nothing the old life held in memory stays. */
function loadAfresh(): void {
  location.reload();
}

/**
 * R-CLOCK-032, development only: `?morning=now` on the address opens every sealed result at once and `?morning=off`
 * lets them wait for seven in Lagos again, so a tester on a phone needs no console.
 */
function takeMorningSwitch(): void {
  if (!import.meta.env.DEV || typeof location === "undefined") return;
  const asked = new URLSearchParams(location.search).get("morning");
  if (asked === null) return;
  try {
    if (asked === "now") localStorage.setItem(MORNING_KEY, "now");
    else localStorage.removeItem(MORNING_KEY);
  } catch {
    // Storage blocked: the switch does nothing.
  }
}

function bootLocal(options: Partial<LocalAuthorityOptions>): GameStore {
  takeMorningSwitch();
  const authority = localAuthority({ fastClock: clockMode().fastClock, ...options });
  const { start } = authority;
  const store = createGameStore(authority, {
    life: authority,
    rememberMonth: true,
    afterLifeEnded: loadAfresh,
    choosingLife: start.kind !== "loaded",
    notice: start.kind === "replaced" ? `ui.life.notice.${start.why}` : null,
  });
  followMorning(store);
  return store;
}

/**
 * R-CLOCK-032: back on the tab, from another app or a night's sleep, the view is read again and with it the results
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
  // One life per account online (R-ACCOUNT-015): the chooser opens only when the server says there is none.
  const store = createGameStore(remote, { life: remote, lifeAgain: false, rememberMonth: true, afterLifeEnded: loadAfresh, account: betterAuthApi({ baseUrl }) });
  goOnline({ store, remote });
  startCounting({ baseUrl });
  // R-ANALYTICS-006: an account that turned the counters off stays off from the first screen.
  void readAccount(remote.api).then((reply) => {
    if (reply.ok && reply.account.sendUsageCounts === false) setUsageCounts(false);
  });
  return store;
}
