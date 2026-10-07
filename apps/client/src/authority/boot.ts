// Starts the game in the tab: the local authority on the right clock, and the
// store the screens read. A lost save is said out loud on the life chooser.
import { clockMode } from "./clock";
import { localAuthority, type LocalAuthorityOptions } from "./local";
import { createGameStore, type GameStore } from "./store";

export function bootGame(options: Partial<LocalAuthorityOptions> = {}): GameStore {
  const authority = localAuthority({ fastClock: clockMode().fastClock, ...options });
  const { start } = authority;
  return createGameStore(authority, {
    life: authority,
    choosingLife: start.kind !== "loaded",
    notice: start.kind === "replaced" ? `ui.life.notice.${start.why}` : null,
  });
}
