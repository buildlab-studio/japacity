// Hands the game store to every screen below it.
import type { PlayerView } from "@japacity/sim";
import { createContext, use, type ReactNode } from "react";
import { useStore } from "zustand";

import type { GameState, GameStore } from "./store";

const GameContext = createContext<GameStore | null>(null);

export function GameProvider({ store, children }: { store: GameStore; children: ReactNode }) {
  return <GameContext value={store}>{children}</GameContext>;
}

function useGameStore(): GameStore {
  const store = use(GameContext);
  if (store === null) throw new Error("A screen was rendered outside the GameProvider.");
  return store;
}

/** Reads one part of the game store. Select a single field or a stable value, never a new object. */
export function useGame<T>(selector: (state: GameState) => T): T {
  return useStore(useGameStore(), selector);
}

/** The current view. Screens are only shown once there is one. */
export function useView(): PlayerView {
  const view = useGame((state) => state.view);
  if (view === null) throw new Error("A screen was rendered before the first view arrived.");
  return view;
}
