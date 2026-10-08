// The old month page opens only with `?classic` (docs/rules/world.md R-WORLD-024). The tests that
// drive it keep running against it by opening the page so; each test starts and ends at "/".
import { afterEach, beforeEach } from "vitest";

export function onTheClassicPage(): void {
  beforeEach(() => {
    history.replaceState(null, "", "/?classic");
  });
  afterEach(() => {
    history.replaceState(null, "", "/");
  });
}
