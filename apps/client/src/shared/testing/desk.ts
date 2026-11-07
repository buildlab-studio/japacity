// A desk for a test (prologue:front-door-three-screens, `shared/ui/desk`): the page's media queries stubbed so the window reads as a
// desktop, with a fine pointer that hovers unless asked otherwise (any query of the pointer or of hover answers so);
// reduced motion is not asked. Undo with `vi.unstubAllGlobals()`.
import { vi } from "vitest";

import { deskQuery, FINE_POINTER } from "../ui/desk";

export function stubDesk({ fine = true }: { fine?: boolean } = {}): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    matches: query === deskQuery() || (fine && (query.includes(FINE_POINTER) || query.includes("(hover: hover)"))),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}
