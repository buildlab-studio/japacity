// The send-off as a scene (docs/rules/chapter.md R-CHAPTER-012): where the scene stands, kept outside any one screen so
// the city, the moment card, the share card and the phone each read it without importing one another. The scene lives
// only in this tab: the simulation knows nothing of it, and a reload after the plane opens in the room abroad with no
// scene (beats 4 to 6 run on the client over the view). The one thing kept on the device is the seat the counter gave
// (beat 2), so the ticket stub carries it later (share.md R-SHARE-015) whatever happens to the tab in between.
import type { Id } from "@japacity/sim";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { SEAT_KEY } from "../kept/storage";

/** The six beats, in order (R-CHAPTER-012). */
export const BEATS = ["departures", "counter", "gate", "plane", "landing", "ride"] as const;
type Beat = (typeof BEATS)[number];

/** Window or aisle: the counter's two chips change nothing but the stub's seat letter (R-CHAPTER-012 beat 2). */
export type Seat = "window" | "aisle";

/** The route the scene flies, read when it opens, so the beats after the plane never depend on the view's route state. */
interface SendOffFlight {
  route: Id<"route">;
  country: Id<"country">;
}

export interface SendOffScene extends SendOffFlight {
  beat: Beat;
  /** How many times Step forward was tapped (beat 1): 0 to 3. */
  step: number;
}

interface SendOffStore {
  scene: SendOffScene | null;
  seat: Seat;
  /** True once the first ride has shown "Send-off card saved" (share.md R-SHARE-015): the card goes to the cards kept. */
  saved: boolean;
  open: (flight: SendOffFlight) => void;
  stepForward: () => void;
  to: (beat: Beat) => void;
  choose: (seat: Seat) => void;
  save: () => void;
  close: () => void;
}

function keptSeat(): Seat {
  try {
    return localStorage.getItem(SEAT_KEY) === "aisle" ? "aisle" : "window";
  } catch {
    return "window";
  }
}

function keepSeat(seat: Seat): void {
  try {
    localStorage.setItem(SEAT_KEY, seat);
  } catch {
    // A full or blocked store keeps the seat for this visit only.
  }
}

/** The three taps of Step forward (R-CHAPTER-012 beat 1). */
const QUEUE_TAPS = 3;

export const sendOff = createStore<SendOffStore>()((set, get) => ({
  scene: null,
  seat: keptSeat(),
  saved: false,
  open: (flight) => set({ scene: { ...flight, beat: "departures", step: 0 }, saved: false }),
  stepForward: () => {
    const scene = get().scene;
    if (scene === null || scene.beat !== "departures" || scene.step >= QUEUE_TAPS) return;
    set({ scene: { ...scene, step: scene.step + 1 } });
  },
  to: (beat) => {
    const scene = get().scene;
    if (scene !== null) set({ scene: { ...scene, beat } });
  },
  choose: (seat) => {
    keepSeat(seat);
    set({ seat });
  },
  save: () => set({ saved: true }),
  close: () => set({ scene: null }),
}));

/** The scene on screen, or null. */
export function useSendOff(): SendOffScene | null {
  return useStore(sendOff, (state) => state.scene);
}

/** True while the scene covers the world: what would open over it waits (the landing's moment card, the share card). */
export function useSendOffShowing(): boolean {
  return useStore(sendOff, (state) => state.scene !== null);
}

/** The seat the counter gave. */
export function useSeat(): Seat {
  return useStore(sendOff, (state) => state.seat);
}

/** True once the first ride has said the card is saved. */
export function useSendOffSaved(): boolean {
  return useStore(sendOff, (state) => state.saved);
}

/**
 * What the shell's plane cut is handed (world.md R-WORLD-037): the map's own layer, drawn by the map's feature and
 * handed to the scene through the shell, so neither imports the other.
 */
export interface PlaneCutSlot {
  /** The route's country, for the line's lean. */
  country: string;
  /** The city's name on the sticker card ("London"). */
  city: string;
  /** The small line under it. */
  small: string;
  /** The line along the foot. */
  line: string;
  /** How long the plane takes, in milliseconds (about three seconds). */
  ms: number;
}
