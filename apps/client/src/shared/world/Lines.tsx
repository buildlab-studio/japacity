// How the world talks (docs/rules/world.md R-WORLD-005, R-WORLD-026; the design). A person
// says their words in a bubble over their own head, in the scene; what happens, and the street's talk, roll into the
// bottom corner, one short line each, the newest at the bottom, gone after a few seconds. Nothing is narrated in a
// card across the middle of the world: Mama says "You have eaten? Sit small." over her head, and the corner says
// "Mama presses a bag of oranges on you."
import { useEffect, useRef, useSyncExternalStore } from "react";

/** A told line stays this long in the corner (the design's `toast`). */
export const TOLD_MS = 7000;
/** A heard line, the street's talk, stays this long (the design's `hear`). */
export const HEARD_MS = 8000;
/** A person's words stay over their head this long, unless tapped away (the design's `say`). */
export const SPEECH_MS = 5200;
/** The street's talk comes this often while nothing covers the world (R-WORLD-026). */
export const TALK_EVERY_MS = 9000;
/** The corner holds this many lines; the oldest goes as a new one comes in. */
export const CORNER_MAX = 3;
/** The street's talk waits while the corner holds this many lines or more. */
const TALK_ROOM = 2;
/** The lines' opacity, oldest to newest, when the corner is full. */
const FADE = [0.55, 0.8, 1] as const;

/** "told": what happened. "heard": the street's talk, tied to nobody. */
export interface Line {
  id: number;
  text: string;
  kind: "told" | "heard";
}

/** Someone in the scene speaking: `who` is the thing they stand at, `name` is said small over their words. */
export interface Speech {
  id: number;
  who: string;
  name: string;
  text: string;
}

interface Said {
  lines: readonly Line[];
  speech: Speech | null;
}

let said: Said = { lines: [], speech: null };
let lastId = 0;
let speechTimer: number | undefined;
const timers = new Set<number>();
const listeners = new Set<() => void>();

function change(next: Partial<Said>): void {
  said = { ...said, ...next };
  for (const listener of listeners) listener();
}

function add(text: string, kind: Line["kind"], ms: number): void {
  lastId += 1;
  const id = lastId;
  change({ lines: [...said.lines, { id, text, kind }].slice(-CORNER_MAX) });
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    if (said.lines.some((line) => line.id === id)) change({ lines: said.lines.filter((line) => line.id !== id) });
  }, ms);
  timers.add(timer);
}

/** What happened, told in the bottom corner: the parcel collected, the fare paid, Mama's oranges. */
export function tell(text: string, ms = TOLD_MS): void {
  add(text, "told", ms);
}

/** The street's talk, tied to nobody, in the same corner. */
export function hear(text: string, ms = HEARD_MS): void {
  add(text, "heard", ms);
}

/** Someone in the scene says it, over their head; one speaker at a time, so a new one takes the last one's place. */
export function speak(who: string, name: string, text: string, ms = SPEECH_MS): void {
  lastId += 1;
  const id = lastId;
  change({ speech: { id, who, name, text } });
  if (speechTimer !== undefined) window.clearTimeout(speechTimer);
  speechTimer = window.setTimeout(() => hush(id), ms);
}

/** Takes the words down: those with this id, or whoever is speaking. */
export function hush(id?: number): void {
  if (said.speech === null || (id !== undefined && said.speech.id !== id)) return;
  change({ speech: null });
}

/** Clears the corner and the bubble at once, for a new life or a test. */
export function resetLines(): void {
  for (const timer of timers) window.clearTimeout(timer);
  timers.clear();
  if (speechTimer !== undefined) window.clearTimeout(speechTimer);
  speechTimer = undefined;
  change({ lines: [], speech: null });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** What is said now: the corner's lines and the one speaking. */
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
 * The street's own talk (R-WORLD-026): a line at once when the world is free, then one every TALK_EVERY_MS while it
 * stays free, never while someone speaks or the corner already holds two lines. `next` gives the line to hear.
 */
export function useStreetTalk(next: () => string | null, free: boolean): void {
  const nextRef = useRef(next);
  nextRef.current = next;
  useEffect(() => {
    if (!free) return;
    const talk = (): void => {
      if (said.speech !== null || said.lines.length >= TALK_ROOM) return;
      const line = nextRef.current();
      if (line !== null) hear(line);
    };
    talk();
    const timer = window.setInterval(talk, TALK_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [free]);
}

/** One line in the corner, off-white with dark text in both themes. */
function CornerLine({ line, opacity }: { line: Line; opacity: number }) {
  const mark = line.kind === "told" ? { "data-told": "" } : { "data-heard": "", "data-chatter": "" };
  return (
    <p className={`line rise rounded-[8px] px-3 py-1.5 text-[13px] leading-snug transition-opacity duration-300 ${line.kind === "heard" ? "line-heard font-semibold" : "font-bold"}`} style={{ opacity }} {...mark}>
      {line.text}
    </p>
  );
}

/**
 * The bottom corner, above the Map button (R-WORLD-026): up to three lines, the newest at the bottom, the older fading.
 * In the world it hides while anything covers it. Over the phone (`told`) it shows only what was told, so a line an
 * act on the phone made is read while the phone covers the world.
 */
export function Corner({ hidden = false, told = false }: { hidden?: boolean; told?: boolean }) {
  const { lines } = useLines();
  const shown = told ? lines.filter((line) => line.kind === "told") : lines;
  if (hidden || shown.length === 0) return null;
  return (
    <div className={`pointer-events-none fixed bottom-[calc(max(14px,env(safe-area-inset-bottom))+76px)] left-3 flex max-w-[74vw] flex-col items-start gap-1.5 ${told ? "z-[45]" : "z-[36]"}`} role="status" data-corner>
      {shown.map((line, index) => (
        <CornerLine key={line.id} line={line} opacity={FADE[index + CORNER_MAX - shown.length] ?? 1} />
      ))}
    </div>
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
 * The bubble over whoever is speaking. With a scene drawn (`anchored`) the scene moves it each frame over the speaker
 * (`bubbleSpot`) and it stays hidden until then; with none it stands over the corner. A tap takes it down.
 */
export function SpeechBubble({ hidden = false, anchored }: { hidden?: boolean; anchored: boolean }) {
  const { speech } = useLines();
  if (speech === null || hidden) return null;
  return (
    <button
      type="button"
      onClick={() => hush(speech.id)}
      className={`pointer-events-auto fixed z-[37] w-max max-w-[240px] text-left ${anchored ? "top-0 left-0" : "bottom-[calc(max(14px,env(safe-area-inset-bottom))+150px)] left-1/2 -translate-x-1/2"}`}
      style={anchored ? { visibility: "hidden" } : undefined}
      data-speech={speech.who}
    >
      <span key={speech.id} className={`pop block ${anchored ? "-translate-x-1/2 -translate-y-full" : ""}`}>
        <span className="line block rounded-[12px] px-3 py-2">
          <span className="block text-[11px] font-bold opacity-60" data-speech-name>
            {speech.name}
          </span>
          <span className="block text-[15px] leading-snug font-semibold" data-speech-words>
            {speech.text}
          </span>
        </span>
        <span className="line-tail mx-auto block h-0 w-0 border-x-[8px] border-t-[9px] border-x-transparent" aria-hidden />
      </span>
    </button>
  );
}
