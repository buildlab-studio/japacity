// Hands the game store to every screen below it.
import type { PlayerView } from "@japacity/sim";
import { createContext, use, useEffect, type ReactNode } from "react";
import { useStore } from "zustand";

import { setNow } from "../shared/words/now";
import { swapsFor } from "./others";
import { playerName } from "../shared/front-door/person";
import type { GameState, GameStore } from "./store";

const GameContext = createContext<GameStore | null>(null);

export function GameProvider({ store, children }: { store: GameStore; children: ReactNode }) {
  // world:top-band-is-lively-pill: the month in hand for the words is this game's while it is on screen, and nobody's after.
  useEffect(() => {
    setNow(store.getState().view?.month ?? null, store.getState().view?.hometown ?? null, swapsFor(playerName(store.getState().view)));
    return () => setNow(null);
  }, [store]);
  return <GameContext value={store}>{children}</GameContext>;
}

/** The game store when a screen is inside a game, or null for a piece shown on its own (a sheet in a test). */
export function useGameStoreIfAny(): GameStore | null {
  return use(GameContext);
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
