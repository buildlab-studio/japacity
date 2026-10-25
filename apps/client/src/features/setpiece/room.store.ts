// What the interview room remembers between views: whether the player walked in, the officer's
// line before the next question, the officer's voice, and the closing still to be said once the set
// piece has closed. It lives in this tab only; a reload resumes at the question in text.
import { OFFICER_REACTIONS, OFFICER_VOICES, type OfficerVoice } from "@japacity/content";
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
  /** The voice of the interview the room was last opened for, kept for its closing line once the set piece has closed. */
  voice: OfficerVoice;
}

export const roomStore = createStore<RoomState>(() => ({ opened: 0, inRoom: false, entered: false, prelude: null, answered: false, closing: null, voice: OFFICER_VOICES[0] ?? "m" }));

/**
 * world:officer-voice-drawn-per-interview: the officer is drawn from the month the interview is held in, which
 * it keeps while it is open (route:open-set-piece-holds-month), so a reload draws the same voice and
 * interviews in other months draw either. Nothing the player answered is read.
 */
export function officerVoiceFor(interview: { entry: string; month: number }): OfficerVoice {
  // FNV-1a over the entry and the month, then a mixing finish: FNV's low bit follows the last digit's,
  // which would make neighbouring months simply alternate.
  let hash = 0x811c9dc5;
  for (const char of `${interview.entry}#${String(interview.month)}`) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  hash ^= hash >>> 16;
  return OFFICER_VOICES[(hash >>> 0) % OFFICER_VOICES.length] ?? "m";
}

/** route:view-shows-progress-not-score: drawn at random, never from what the answer scored. */
export function drawReaction(): string {
  const [drawn = 0] = crypto.getRandomValues(new Uint32Array(1));
  return OFFICER_REACTIONS[drawn % OFFICER_REACTIONS.length] ?? OFFICER_REACTIONS[0] ?? GREET;
}

export function openRoom(voice: OfficerVoice): void {
  const state = roomStore.getState();
  if (state.inRoom) return;
  roomStore.setState({ opened: state.opened + 1, inRoom: true, entered: false, prelude: null, answered: false, closing: null, voice });
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
