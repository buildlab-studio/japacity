// How the world talks (docs/rules/world.md R-WORLD-005, R-WORLD-026; the talk budget, docs/design/13-the-lively-layer.md
// section 5). Two channels and nothing more: pictures over the crowd cost no reading, and words over a
// person come one bubble at a time, at most eight words, for about four seconds, an ambient line then at least twenty of
// quiet. A longer line never floats whole: its bubble clips it to two lines and a tap opens it in a sheet with their name. The bottom corner
// is for the player's own act's answer alone ("Mama presses a bag of oranges on you."), one line at a time; the street's
// talk tied to nobody never stands there.
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";

import { CentredColumn } from "../ui/lively/CentredColumn";
import { Face, faceMark } from "../ui/lively/Face";
import { LivelySheet } from "../ui/lively/LivelySheet";
import { say } from "../words/text";

/** A told line stays this long in the corner. */
export const TOLD_MS = 7000;
/** A person's words stay over their head this long, unless tapped away (the talk budget: about four seconds). */
export const SPEECH_MS = 4000;
/** After an ambient line, at least this long before the next one floats (the talk budget). */
export const QUIET_MS = 30000;
/** The street's turn comes this often while nothing covers the world; the quiet still holds it back. */
export const TALK_EVERY_MS = 9000;
/** The most words a bubble holds whole; a longer line is clipped to two lines and opens in a sheet. */
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
 * said small over their words. A long line shows clipped to two lines until tapped open.
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

/** True when a line is too long to float whole: it is clipped to two lines and opens in a sheet (the talk budget). */
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
export function murmur(text: string, now: number = Date.now(), name: string = say("ui.talk.someone"), who: string = NEAR_SPEAKER): boolean {
  if (said.speech !== null || now - quietSince < QUIET_MS) return false;
  quietSince = now + SPEECH_MS;
  put(who, name, text, true, SPEECH_MS);
  return true;
}

/**
 * A line the street's talk offers: its words, and, where one person plainly says it, their name (world.md R-WORLD-026,
 * `<line>.by`) and the thing they stand at when they stand in the place, so the bubble goes over them.
 */
export interface TalkLine {
  text: string;
  name?: string;
  who?: string;
}

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
export function useStreetTalk(next: () => string | TalkLine | null, free: boolean, name?: string): void {
  const nextRef = useRef(next);
  nextRef.current = next;
  const nameRef = useRef(name);
  nameRef.current = name;
  useEffect(() => {
    if (!free) return;
    const talk = (): void => {
      if (said.speech !== null || Date.now() - quietSince < QUIET_MS) return;
      const line = nextRef.current();
      if (line === null) return;
      const heard = typeof line === "string" ? { text: line } : line;
      // A line's own speaker is named over it; else at home the voice is the house's, not a stranger's
      // (never "Someone nearby" at the family house), and in the street someone nearby.
      murmur(heard.text, Date.now(), heard.name ?? nameRef.current, heard.who);
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
    // On a laptop the corner is the centred column's (decision 0038). It keeps out of the thumbs' columns, so the round turn
    // button over Phone never stands on its end.
    <CentredColumn className={`pointer-events-none fixed inset-x-0 bottom-[calc(max(14px,env(safe-area-inset-bottom))+84px)] flex justify-center px-[72px] ${told ? "z-[45]" : "z-[36]"}`}>
      <p key={line.id} className="talk-corner rise max-w-full px-4 py-1.5 text-center text-[14px] leading-snug font-bold" role="status" data-corner data-told>
        {line.text}
      </p>
    </CentredColumn>
  );
}

/** How close to the screen's edge the bubble may stand. */
const EDGE = 8;
/** How far the bubble's tail reaches under its box when nothing lifts it, in pixels; the box the scene measures counts it. */
export const TAIL = 10;
/** The tail's width where it leaves the box. */
const TAIL_BASE = 18;
/** How far in from the box's rounded corners the tail may leave it. */
const TAIL_INSET = 22;
/** The bubble's underside: the edge drawn under its box (index.css, `.talk-bubble`). */
const UNDERSIDE = 4;
/** The longest the tail ever reaches, a bubble's own height at most: a longer one reads as broken. */
export const TAIL_MAX = 80;
/** The most the bubble is lifted off its plain spot, so its tail stays within TAIL_MAX. */
export const LIFT_MAX = TAIL_MAX - TAIL;
const LIFT_STEP = 5;
/** How far the bubble steps aside at a time, looking for room beside its speaker. */
const SHIFT_STEP = 8;
/** What a square pixel of a dot under the box costs against a pixel of shift: little, so a near spot over a dot beats a far one. */
const SOFT_WEIGHT = 0.25;
/** What a square pixel of a head or a name under a lifted tail costs against a pixel of shift. */
const TAIL_WEIGHT = 2;

/** A box on the screen, in pixels: a head, a thing's name, a mark, the marker. */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Where the bubble stands: `x` its box's centre and `y` the foot of its box with the plain tail under it; `tail` where
 * the tail's point is from the box's centre and how long it reaches, so it ends over the speaker however the box moved;
 * `lift` and `shift` say how the box moved off its plain spot, so the next frame can keep it.
 */
export interface BubbleSpot {
  x: number;
  y: number;
  shown: boolean;
  tail: { x: number; length: number };
  lift: number;
  shift: number;
}

/** The box a bubble placed at `spot` covers on the screen: its body and the underside under it, not its tail. */
export function bubbleRect(spot: Pick<BubbleSpot, "x" | "y">, box: { width: number; height: number }): Rect {
  return { left: spot.x - box.width / 2, right: spot.x + box.width / 2, top: spot.y - box.height, bottom: spot.y - TAIL + UNDERSIDE };
}

/** How much of two boxes overlaps, in square pixels. */
export function overlap(a: Rect, b: Rect): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

/** The shifts tried, nearest first: none, then a step to each side in turn, out to beside the speaker. */
function shifts(most: number): number[] {
  const out = [0];
  for (let step = SHIFT_STEP; step <= most; step += SHIFT_STEP) out.push(-step, step);
  return out;
}

/** What a bubble keeps clear of: `clear` it never covers where any spot in reach is clear of it (every head, a name
 * shown, the marker, the thumbs); `soft` it covers only where nothing clear of it is in reach (a thing's dot, which the
 * bubble hands a tap on through, R-WORLD-005); `last` the spot the last frame chose. */
export interface BubbleKeep {
  clear?: readonly Rect[];
  soft?: readonly Rect[];
  last?: Pick<BubbleSpot, "lift" | "shift">;
}

/**
 * Where the bubble stands on the screen, from the speaker's anchor as the camera projects it (-1 to 1 across and up,
 * `z` under 1 in front of the camera): over the speaker, held inside the screen and under `top` (the band), hidden when
 * the speaker is behind the camera. It stands clear of every head and name in the scene (world.md R-WORLD-026, `keep`):
 * it steps aside to beside the speaker where there is room, else is lifted over the crowd with its tail reaching down to
 * the speaker; where nothing in reach is clear it takes the spot that covers least. The spot the last frame chose is
 * kept while it stays clear, so the bubble does not hop as the crowd idles.
 */
export function bubbleSpot(at: { x: number; y: number; z: number }, size: { width: number; height: number }, box: { width: number; height: number }, top = 0, keep: BubbleKeep = {}): BubbleSpot {
  const { clear = [], soft = [], last } = keep;
  const half = box.width / 2 + EDGE;
  const over = { x: ((at.x + 1) / 2) * size.width, y: ((1 - at.y) / 2) * size.height };
  const centred = Math.min(Math.max(over.x, half), Math.max(half, size.width - half));
  const lowest = top + box.height + EDGE;
  const shown = at.z < 1;
  // No room over the speaker under the band: the box is held under it, its plain tail straight down, as before.
  if (over.y < lowest) return { x: centred, y: Math.min(lowest, size.height - EDGE), shown, tail: { x: 0, length: TAIL }, lift: 0, shift: 0 };
  const y = Math.min(over.y, size.height - EDGE);
  const tipX = over.x;
  // Near spots first: over or beside the speaker, the tail short, clear of every head and name; among those, one over a
  // dot or the road is better than one further off. Only when no near spot is clear does the bubble stand over the crowd,
  // its tail at TAIL_MAX and the bubble as low as that allows, covering what it must least.
  let near: { spot: BubbleSpot; cost: number } | null = null;
  let high: { spot: BubbleSpot; lift: number; hard: number; cost: number } | null = null;
  let kept: BubbleSpot | null = null;
  for (let lift = 0; lift <= LIFT_MAX && y - lift >= lowest; lift = lift + LIFT_STEP > LIFT_MAX && lift < LIFT_MAX ? LIFT_MAX : lift + LIFT_STEP) {
    const length = TAIL + lift;
    for (const shift of shifts(box.width / 2 + length)) {
      const x = Math.min(Math.max(centred + shift, half), Math.max(half, size.width - half));
      if (shift !== 0 && x === centred) continue;
      // The tail leaves the box between its rounded corners and leans no more than it reaches down.
      const base = Math.min(Math.max(tipX, x - box.width / 2 + TAIL_INSET), x + box.width / 2 - TAIL_INSET);
      if (Math.abs(tipX - base) > length) continue;
      const foot = y - lift;
      const rect = bubbleRect({ x, y: foot }, box);
      // A lifted bubble's tail runs down past what stands under it: it keeps clear of heads and names too.
      const tail = { left: Math.min(base, tipX) - TAIL_BASE / 4, right: Math.max(base, tipX) + TAIL_BASE / 4, top: rect.bottom, bottom: y - 4 };
      const hard = clear.reduce((sum, other) => sum + overlap(rect, other), 0);
      const crossed = lift > 0 ? clear.reduce((sum, other) => sum + overlap(tail, other), 0) : 0;
      const light = soft.reduce((sum, other) => sum + overlap(rect, other), 0);
      const spot = { x, y: foot, shown, tail: { x: tipX - x, length }, lift, shift: x - centred };
      if (last !== undefined && hard === 0 && crossed === 0 && lift === last.lift && Math.abs(spot.shift - last.shift) < SHIFT_STEP / 2) kept = spot;
      const cost = Math.abs(spot.shift) + lift * 1.5 + light * SOFT_WEIGHT + crossed * TAIL_WEIGHT;
      if (hard === 0 && (near === null || cost < near.cost)) near = { spot, cost };
      if (high === null || lift > high.lift || (lift === high.lift && (hard < high.hard || (hard === high.hard && cost < high.cost)))) high = { spot, lift, hard, cost };
    }
  }
  if (kept !== null) return kept;
  return near?.spot ?? high?.spot ?? { x: centred, y, shown, tail: { x: tipX - centred, length: TAIL }, lift: 0, shift: 0 };
}

/**
 * Draws the bubble's tail as `bubbleSpot` placed it: a point in the bubble's own fill with its edge round it and the
 * underside under it, leaving the box between its corners and ending over the speaker.
 */
export function drawTail(bubble: HTMLElement, tail: BubbleSpot["tail"]): void {
  const svg = bubble.querySelector<SVGSVGElement>("[data-speech-tail]");
  const body = bubble.querySelector<HTMLElement>(".talk-bubble");
  if (svg === null || body === null) return;
  const paths = tailPaths(body.offsetWidth, tail);
  svg.style.height = `${String(tail.length + UNDERSIDE)}px`;
  for (const node of svg.querySelectorAll<SVGPathElement>("path")) {
    const d = paths[node.dataset.part as keyof typeof paths];
    if (d !== undefined && node.getAttribute("d") !== d) node.setAttribute("d", d);
  }
}

/** The tail's three paths across a box `width` wide: the underside, the fill and the edge. */
export function tailPaths(width: number, tail: BubbleSpot["tail"]): { under: string; fill: string; edge: string } {
  const tip = width / 2 + tail.x;
  const base = Math.min(Math.max(tip, TAIL_INSET), width - TAIL_INSET);
  const left = base - TAIL_BASE / 2;
  const right = base + TAIL_BASE / 2;
  const n = (value: number): string => String(Math.round(value * 10) / 10);
  return {
    under: `M${n(left - 1)} 0L${n(right + 1)} 0L${n(tip)} ${n(tail.length + UNDERSIDE - 0.5)}Z`,
    // The fill starts inside the box, so it covers the box's edge and underside where the tail leaves it.
    fill: `M${n(left)} -3L${n(right)} -3L${n(tip)} ${n(tail.length)}Z`,
    edge: `M${n(left)} 0L${n(tip)} ${n(tail.length)}L${n(right)} 0`,
  };
}

/**
 * The bubble over whoever is speaking: the lively bubble with the speaker's name pill over their words, in one pair of
 * curly quotes whatever line it is (the quotes are the bubble's, never the line's). With a scene drawn (`anchored`) the
 * scene moves it each frame clear of every head and name, its tail over the speaker (`bubbleSpot`, `drawTail`), and it
 * stays hidden until then; with none it stands over the corner. A tap takes a short line down; a long one shows clipped to two
 * lines and a tap opens it in a sheet.
 */
export function SpeechBubble({ hidden = false, anchored }: { hidden?: boolean; anchored: boolean }) {
  const { speech, open } = useLines();
  const button = useRef<HTMLButtonElement>(null);
  const shown = speech !== null && !hidden;
  // The plain tail, straight down from the box's middle, until a scene places the bubble and leans it to the speaker.
  useLayoutEffect(() => {
    if (shown && button.current !== null) drawTail(button.current, { x: 0, length: TAIL });
  }, [shown, speech?.id]);
  return (
    <>
      {speech === null || hidden ? null : (
        <button
          ref={button}
          type="button"
          onClick={(event) => {
            // A thing's mark or a fan button under the bubble keeps its tap (R-WORLD-005): the bubble hands it on.
            const under = (typeof document.elementsFromPoint === "function" ? document.elementsFromPoint(event.clientX, event.clientY) : []).find((node) => node !== event.currentTarget && !event.currentTarget.contains(node) && node.closest("[data-mark], [data-fan] button") !== null);
            if (under instanceof HTMLElement) {
              under.click();
              return;
            }
            if (speech.long) listen(speech);
            else hush(speech.id);
          }}
          className={`pointer-events-auto fixed z-[37] w-max max-w-[280px] text-left ${anchored ? "top-0 left-0" : "bottom-[calc(max(14px,env(safe-area-inset-bottom))+150px)] left-1/2 -translate-x-1/2"}`}
          style={anchored ? { visibility: "hidden" } : undefined}
          aria-label={speech.long ? say("ui.talk.open", { name: speech.name }) : undefined}
          data-speech={speech.who}
          {...(speech.long ? { "data-speech-long": "" } : {})}
          {...(speech.ambient ? { "data-speech-ambient": "" } : {})}
        >
          <span key={speech.id} className={`pop block ${anchored ? "-translate-x-1/2 -translate-y-full" : ""}`}>
            <span className="talk-bubble block px-3 py-2">
              <span className="mb-1 flex items-center gap-1.5 text-[13px] font-bold">
                <span className="face-mark flex size-5 shrink-0 items-center justify-center text-[11px] text-white" style={{ background: faceMark(speech.name).colour }} aria-hidden>
                  {faceMark(speech.name).initial}
                </span>
                <span data-speech-name>{speech.name}</span>
              </span>
              {/* A long line shows its words too, clipped to two lines; the tap opens it whole, since a bubble of three dots says nothing. */}
              <span className={`talk-said block text-[15px] leading-snug ${speech.long ? "talk-clip" : ""}`} data-speech-words>
                {speech.text}
              </span>
            </span>
            {/* The tail's room under the box; the tail itself is drawn over it, in the bubble's fill, and reaches the speaker. */}
            <span className="relative block" style={{ height: TAIL }} aria-hidden>
              <svg className="talk-tail absolute top-0 left-0 w-full overflow-visible" style={{ height: TAIL + UNDERSIDE }} data-speech-tail>
                <path className="talk-tail-under" data-part="under" />
                <path className="talk-tail-fill" data-part="fill" />
                <path className="talk-tail-edge" data-part="edge" />
              </svg>
            </span>
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
