// How the world talks (docs/rules/world.md R-WORLD-005, R-WORLD-026; the talk budget, docs/design/13-the-lively-layer.md
// section 5; the plan 6). Two channels and nothing more: pictures over the crowd cost no reading, and words over a
// person come one bubble at a time, at most eight words, for about four seconds, an ambient line then at least twenty of
// quiet. A longer line never floats: the person shows "…" and a tap opens it in a sheet with their name. The bottom corner
// is for the player's own act's answer alone ("Mama presses a bag of oranges on you."), one line at a time; the street's
// talk tied to nobody no longer stands there.
import { useEffect, useRef, useSyncExternalStore } from "react";

import { CentredColumn } from "../ui/lively/CentredColumn";
import { Face, faceMark } from "../ui/lively/Face";
import { LivelySheet } from "../ui/lively/LivelySheet";
import { say } from "../words/text";

/** A told line stays this long in the corner. */
export const TOLD_MS = 7000;
/** A person's words stay over their head this long, unless tapped away (the talk budget: about four seconds). */
export const SPEECH_MS = 4000;
/** After an ambient line, at least this long before the next one floats (the talk budget). */
export const QUIET_MS = 20000;
/** The street's turn comes this often while nothing covers the world; the quiet still holds it back. */
export const TALK_EVERY_MS = 9000;
/** The most words a bubble holds; a longer line shows "…" and opens in a sheet. */
export const WORDS_MAX = 8;
/** The corner shows one line at a time; the others wait their turn. */
export const CORNER_MAX = 1;
/** Who speaks an ambient line: the resident nearest the player's figure, found by the scene. */
export const NEAR_SPEAKER = "crowd:near";

/** "told": the player's own act's answer, in the corner. */
export interface Line {
  id: number;
  text: string;
  kind: "told";
  /** How long it stands once it is shown. */
  ms: number;
}

/**
 * Someone in the scene speaking: `who` is the thing they stand at (or the resident nearest, `NEAR_SPEAKER`), `name` is
 * said small over their words. A long line shows "…" until tapped open.
 */
export interface Speech {
  id: number;
  who: string;
  name: string;
  text: string;
  long: boolean;
  ambient: boolean;
}

interface Said {
  lines: readonly Line[];
  speech: Speech | null;
  /** A long line opened in its sheet. */
  open: Speech | null;
}

let said: Said = { lines: [], speech: null, open: null };
let lastId = 0;
let speechTimer: number | undefined;
/** When the last ambient bubble went, for the quiet after it. */
let quietSince = -Infinity;
const timers = new Set<number>();
const listeners = new Set<() => void>();

function change(next: Partial<Said>): void {
  said = { ...said, ...next };
  for (const listener of listeners) listener();
}

/** How many words a line holds. */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((word) => word !== "").length;
}

/** True when a line is too long to float: it shows "…" and opens in a sheet (the talk budget). */
export function isLong(text: string): boolean {
  return wordCount(text) > WORDS_MAX;
}

/** The most lines waiting their turn in the corner. */
const CORNER_QUEUE = 3;
/** Lines told within this long of the one showing belong with it and wait their turn; a later one answers a new tap. */
export const JOIN_MS = 1000;
/** When the line showing was told. */
let headAt = -Infinity;

/** Starts the corner's first line on its time: when it goes, the next waiting takes its turn. */
function runHead(): void {
  const head = said.lines[0];
  if (head === undefined) return;
  headAt = Date.now();
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    if (said.lines[0]?.id !== head.id) return;
    change({ lines: said.lines.slice(1) });
    runHead();
  }, head.ms);
  timers.add(timer);
}

/**
 * The player's own act's answer, told in the bottom corner, one line at a time (the talk budget): the parcel collected,
 * the fare paid, Mama's oranges. A line told with the one showing (within JOIN_MS) waits its turn after it; a line told
 * later answers a new tap and takes the corner at once.
 */
export function tell(text: string, ms = TOLD_MS): void {
  lastId += 1;
  const line = { id: lastId, text, kind: "told" as const, ms };
  if (said.lines.length > 0 && Date.now() - headAt <= JOIN_MS) {
    change({ lines: [...said.lines, line].slice(0, CORNER_QUEUE) });
    return;
  }
  change({ lines: [line] });
  runHead();
}

function put(who: string, name: string, text: string, ambient: boolean, ms: number): void {
  lastId += 1;
  const id = lastId;
  change({ speech: { id, who, name, text, long: isLong(text), ambient } });
  if (speechTimer !== undefined) window.clearTimeout(speechTimer);
  speechTimer = window.setTimeout(() => hush(id), ms);
}

/** Someone in the scene says it, over their head; one speaker at a time, so a new one takes the last one's place. */
export function speak(who: string, name: string, text: string, ms = SPEECH_MS): void {
  put(who, name, text, false, ms);
}

/**
 * The street's talk, tied to nobody, given to the resident nearest the player (the talk budget): it floats only while no
 * one speaks and the quiet after the last ambient line has passed. True when it floated.
 */
export function murmur(text: string, now: number = Date.now()): boolean {
  if (said.speech !== null || now - quietSince < QUIET_MS) return false;
  quietSince = now + SPEECH_MS;
  put(NEAR_SPEAKER, say("ui.talk.someone"), text, true, SPEECH_MS);
  return true;
}

/** The street's talk heard: an ambient line, as `murmur`. */
export const hear = (text: string): boolean => murmur(text);

/** Takes the words down: those with this id, or whoever is speaking. */
export function hush(id?: number): void {
  if (said.speech === null || (id !== undefined && said.speech.id !== id)) return;
  change({ speech: null });
}

/** Opens a long line in its sheet, with the speaker's name; the bubble goes. */
export function listen(speech: Speech): void {
  change({ open: speech, speech: null });
}

/** Clears the corner, the bubble and the quiet at once, for a new life or a test. */
export function resetLines(): void {
  for (const timer of timers) window.clearTimeout(timer);
  timers.clear();
  if (speechTimer !== undefined) window.clearTimeout(speechTimer);
  speechTimer = undefined;
  quietSince = -Infinity;
  headAt = -Infinity;
  change({ lines: [], speech: null, open: null });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** What is said now: the corner's lines, the one speaking, the long line opened. */
export function useLines(): Said {
  return useSyncExternalStore(
    subscribe,
    () => said,
    () => said,
  );
}

/** The same, outside React: the scene's frame loop and the street's talk read it. */
export function linesNow(): Said {
  return said;
}

/**
 * The street's own talk (the talk budget): a turn at once when the world is free, then one every TALK_EVERY_MS while it
 * stays free; each turn offers an ambient line, which floats only when no one speaks and the quiet has passed. `next`
 * gives the line.
 */
export function useStreetTalk(next: () => string | null, free: boolean): void {
  const nextRef = useRef(next);
  nextRef.current = next;
  useEffect(() => {
    if (!free) return;
    const talk = (): void => {
      if (said.speech !== null || Date.now() - quietSince < QUIET_MS) return;
      const line = nextRef.current();
      if (line !== null) murmur(line);
    };
    talk();
    const timer = window.setInterval(talk, TALK_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [free]);
}

/**
 * The bottom corner, above the thumbs (the talk budget): the line the player's own act was answered with, one at a time,
 * as a pill. In the world it hides while anything covers it; over the phone (`told`) it still shows, so a line an act on the
 * phone made is read while the phone covers the world.
 */
export function Corner({ hidden = false, told = false }: { hidden?: boolean; told?: boolean }) {
  const { lines } = useLines();
  const line = lines[0];
  if (hidden || line === undefined) return null;
  return (
    // On a laptop the corner is the centred column's (decision 0038).
    <CentredColumn className={`pointer-events-none fixed inset-x-0 bottom-[calc(max(14px,env(safe-area-inset-bottom))+84px)] flex justify-center px-3 ${told ? "z-[45]" : "z-[36]"}`}>
      <p key={line.id} className="talk-corner rise max-w-[86%] px-4 py-1.5 text-center text-[14px] leading-snug font-bold" role="status" data-corner data-told>
        {line.text}
      </p>
    </CentredColumn>
  );
}

/** How close to the screen's edge the bubble may stand. */
const EDGE = 8;

/**
 * Where the bubble's tail points on the screen, from the speaker's anchor as the camera projects it (-1 to 1 across
 * and up, `z` under 1 in front of the camera): over the speaker, held inside the screen and under `top` (the band),
 * hidden when the speaker is behind the camera.
 */
export function bubbleSpot(at: { x: number; y: number; z: number }, size: { width: number; height: number }, box: { width: number; height: number }, top = 0): { x: number; y: number; shown: boolean } {
  const half = box.width / 2 + EDGE;
  const x = Math.min(Math.max(((at.x + 1) / 2) * size.width, half), Math.max(half, size.width - half));
  const y = Math.min(Math.max(((1 - at.y) / 2) * size.height, top + box.height + EDGE), size.height - EDGE);
  return { x, y, shown: at.z < 1 };
}

/**
 * The bubble over whoever is speaking: the lively bubble with the speaker's name pill over their words. With a scene
 * drawn (`anchored`) the scene moves it each frame over the speaker (`bubbleSpot`) and it stays hidden until then; with
 * none it stands over the corner. A tap takes a short line down; a long one shows "…" and a tap opens it in a sheet.
 */
export function SpeechBubble({ hidden = false, anchored }: { hidden?: boolean; anchored: boolean }) {
  const { speech, open } = useLines();
  return (
    <>
      {speech === null || hidden ? null : (
        <button
          type="button"
          onClick={() => (speech.long ? listen(speech) : hush(speech.id))}
          // A short line takes no tap, so the bubble over the player's figure never steals the tap meant for a thing's mark beside it (R-WORLD-005); a long line's bubble opens its sheet.
          className={`${speech.long ? "pointer-events-auto" : "pointer-events-none"} fixed z-[37] w-max max-w-[280px] text-left ${anchored ? "top-0 left-0" : "bottom-[calc(max(14px,env(safe-area-inset-bottom))+150px)] left-1/2 -translate-x-1/2"}`}
          style={anchored ? { visibility: "hidden" } : undefined}
          aria-label={speech.long ? say("ui.talk.open", { name: speech.name }) : undefined}
          data-speech={speech.who}
          {...(speech.long ? { "data-speech-long": "" } : {})}
        >
          <span key={speech.id} className={`pop block ${anchored ? "-translate-x-1/2 -translate-y-full" : ""}`}>
            <span className="talk-bubble block px-3 py-2">
              <span className="mb-1 flex items-center gap-1.5 text-[13px] font-bold">
                <span className="face-mark flex size-5 shrink-0 items-center justify-center text-[11px] text-white" style={{ background: faceMark(speech.name).colour }} aria-hidden>
                  {faceMark(speech.name).initial}
                </span>
                <span data-speech-name>{speech.name}</span>
              </span>
              <span className="block text-[15px] leading-snug" data-speech-words>
                {speech.long ? "…" : speech.text}
              </span>
            </span>
            <span className="talk-tail mx-auto block h-0 w-0 border-x-[8px] border-t-[9px] border-x-transparent" aria-hidden />
          </span>
        </button>
      )}
      {open === null ? null : (
        <LivelySheet open onOpenChange={(next) => (next ? undefined : change({ open: null }))} title={open.name} picture={<Face name={open.name} />}>
          <p className="pb-2 text-[17px] leading-snug" data-talk-open>
            “{open.text}”
          </p>
        </LivelySheet>
      )}
    </>
  );
}
