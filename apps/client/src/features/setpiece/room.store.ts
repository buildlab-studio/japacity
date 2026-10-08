// What the interview room remembers between views: whether the player walked in, the officer's
// line before the next question, and the closing still to be said once the set piece has closed.
// It lives in this tab only; a reload resumes at the question in text.
import { OFFICER_REACTIONS } from "@japacity/content";
import { createStore } from "zustand/vanilla";

export const VOICED = "setpiece.credibility-interview";
export const GREET = `${VOICED}.officer.greet`;
export const CLOSE = `${VOICED}.officer.close`;

export interface RoomState {
  /** Counts interviews opened in this tab, so each is a scene of its own for the notice. */
  opened: number;
  inRoom: boolean;
  entered: boolean;
  /** The words key of the officer's line before the question on screen: the greeting or a reaction. */
  prelude: string | null;
  answered: boolean;
  /** The reaction said before the closing line, while the closing shows. */
  closing: string | null;
}

export const roomStore = createStore<RoomState>(() => ({ opened: 0, inRoom: false, entered: false, prelude: null, answered: false, closing: null }));

/** R-SETPIECE-005: drawn at random, never from what the answer scored. */
export function drawReaction(): string {
  const [drawn = 0] = crypto.getRandomValues(new Uint32Array(1));
  return OFFICER_REACTIONS[drawn % OFFICER_REACTIONS.length] ?? OFFICER_REACTIONS[0] ?? GREET;
}

export function openRoom(): void {
  const state = roomStore.getState();
  if (state.inRoom) return;
  roomStore.setState({ opened: state.opened + 1, inRoom: true, entered: false, prelude: null, answered: false, closing: null });
}

export function enterRoom(): void {
  roomStore.setState({ entered: true, prelude: GREET });
}

export function answered(): void {
  roomStore.setState({ answered: true, prelude: drawReaction() });
}

/** The set piece has closed: the closing line is said when the player answered here. */
export function leaveRoomView(): void {
  const state = roomStore.getState();
  if (!state.inRoom) return;
  roomStore.setState({ inRoom: false, entered: false, closing: state.answered ? (state.prelude ?? drawReaction()) : null, prelude: null, answered: false });
}

export function closeRoom(): void {
  roomStore.setState({ closing: null });
}
