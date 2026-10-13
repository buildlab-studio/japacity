// Renders a screen with a game store around it, already holding a view.
import type { PlayerView } from "@japacity/sim";
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore, type GameStore } from "../../authority/store";
import { fakeAuthority, type FakeAuthority } from "./fixtures";

// The client project runs without Vitest globals, so Testing Library cannot
// clean up on its own. Every screen test imports this file.
afterEach(() => {
  cleanup();
});

export interface Rendered {
  authority: FakeAuthority;
  store: GameStore;
}

export async function renderWithView(ui: ReactElement, view: PlayerView): Promise<Rendered> {
  const authority = fakeAuthority(view);
  const store = createGameStore(authority);
  await store.getState().refresh();
  render(<GameProvider store={store}>{ui}</GameProvider>);
  return { authority, store };
}

/** The element at `selector`, or a throw, so `waitFor(() => found(...))` waits until it is there. */
export function found(selector: string): HTMLElement {
  const one = document.querySelector<HTMLElement>(selector);
  if (one === null) throw new Error(`Nothing at ${selector}.`);
  return one;
}
