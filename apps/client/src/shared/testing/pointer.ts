// The pointer a test's screen opens on (account:username-typed-and-checked): a desktop's fine pointer that hovers, or a
// touch phone's coarse one, as the page's media query answers. Every other query answers false. Undo with
// `vi.unstubAllGlobals()`.
import { vi } from "vitest";

import { FINE_POINTER } from "../ui/firstField";

export function stubPointer(pointer: "fine" | "coarse"): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    matches: query === FINE_POINTER ? pointer === "fine" : false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
  }));
}
