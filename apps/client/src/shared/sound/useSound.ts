import { useStore } from "zustand";

import { type SoundState, soundStore } from "./sound";

/** A part of the sound state, read in a screen. */
export function useSound<T>(pick: (state: SoundState) => T): T {
  return useStore(soundStore, pick);
}
