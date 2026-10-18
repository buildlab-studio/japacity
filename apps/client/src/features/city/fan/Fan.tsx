// The fan (docs/design/13-the-lively-layer.md section 3; world:fan-of-sticker-buttons): every thing's acts fanned out of the thing
// itself, the thing's name in a pill over it, round sticker buttons on a curve into the larger free side, a name pill
// outside the curve, the yellow price pill where a price stands, or what stands in the way. The scene's frame loop moves
// the fan with its thing every frame (CityScene, `[data-fan]`, as the marks and the speech bubble); the layout is read once
// from where the thing first stood, and when the free side cannot hold it the caller opens the sheet of the same acts.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";

import { cue } from "../../../shared/sound/cues";
import { Tile } from "../../../shared/tiles/Tile";
import { Sticker } from "../../../shared/ui/lively/Sticker";
import { say } from "../../../shared/words/text";
import type { Thing } from "../../../shared/world/contract";
import { clearFanAnchor, fanAnchor, subscribeFanAnchor } from "./anchor";
import { type FanEntry, MOST_FANNED } from "./fanActs";
import { curvePath, type FanLayout, fanLayout, fanSizes, placesAt, shiftRange } from "./fanLayout";
import "./fan.css";
import { cityWords } from "../city.words";

export interface FanProps {
  /** The fanned thing's id: the scene finds the fan by it and moves it with the thing. */
  thing: string;
  /** The thing's name: the pill over it and the group's label. */
  title: string;
  /** The quiet mark of a person the game plays, beside the name as on every screen (person:computer-candidates-labelled, person:computer-mark-is-quiet). */
  mark?: Thing["mark"];
  entries: readonly FanEntry[];
  /** A button tapped that can be had: the caller walks to the thing and sends its act. */
  onAct: (entry: FanEntry) => void;
  /** The free side cannot hold the fan, or the thing stood off the screen: the caller opens the sheet instead. */
  onFallback: () => void;
  /** The entry walked to now, pressed until its act lands. */
  going?: string | null;
  /**
   * While a priced button is pressed, what the band's counter should show is left after it; null when it is let go
   * (chips earn their place: the band's money counter is the balance, design page 13 section 2).
   */
  onPreview?: (after: number | null) => void;
}

/** A finger moved this far is a drag along the curve, not a tap. */
const DRAG_PX = 6;
/** The space kept clear under the band and over the thumbs when nothing is measured (a page with neither yet). */
const BAND_GAP = 8;

/** What covers the top and the foot of the screen now: the band, and the thumbs with any small card standing over them. */
function insetsNow(): { top: number; bottom: number } {
  const band = document.querySelector("[data-band]")?.getBoundingClientRect().bottom ?? 0;
  const thumbs = [...document.querySelectorAll("[data-thumb], [data-home-teach], [data-night-teach]")].map((node) => node.getBoundingClientRect().top).filter((top) => top > 0);
  const foot = thumbs.length === 0 ? window.innerHeight : Math.min(...thumbs);
  return { top: band + BAND_GAP, bottom: window.innerHeight - foot + BAND_GAP };
}

/** How far over the hinge the name's pill stands, and the space kept between it and a button or the screen's edge. */
const TITLE_RISE = 22;
const TITLE_GAP = 8;

/**
 * Where the name's pill stands, from the hinge: over the thing, its inner edge at the thing's column so it never meets the
 * curve, which bows out the other way; with no room there it stands over the fan's first button; always inside the screen
 * and under the band, as the marks are.
 */
function titleAt(point: { x: number; y: number }, size: { width: number; height: number }, layout: FanLayout | null): { x: number; y: number } {
  const right = window.innerWidth - TITLE_GAP - size.width;
  const hold = (x: number): number => Math.min(Math.max(x, TITLE_GAP), Math.max(TITLE_GAP, right));
  let y = point.y - TITLE_RISE - size.height;
  let x = point.x - size.width / 2;
  if (layout !== null && layout.fits && layout.count > 0) {
    const beside = layout.side === "right" ? point.x - 2 - size.width : point.x + 2;
    if (hold(beside) === beside) x = beside;
    else y = Math.min(y, point.y + layout.first - layout.sizes.button / 2 - TITLE_GAP - size.height);
  }
  y = Math.max(y, insetsNow().top);
  return { x: Math.round(hold(x) - point.x), y: Math.round(y - point.y) };
}

/** The layout for a thing first seen at `point`, on the screen as it is now. */
function layoutAt(point: NonNullable<ReturnType<typeof fanAnchor>>, count: number, label: number | null): FanLayout {
  const screen = { width: window.innerWidth, height: window.innerHeight };
  // A thing off the screen gets a point off it, which never fits: the sheet opens.
  const at = point === "off" ? { x: -1, y: -1 } : point;
  const sizes = fanSizes(screen.width);
  return fanLayout({ at, screen, count, inset: insetsNow(), ...sizes, label: label ?? sizes.label });
}

export function Fan({ thing, title, mark, entries, onAct, onFallback, going = null, onPreview }: FanProps) {
  const point = useSyncExternalStore(subscribeFanAnchor, () => fanAnchor(thing));
  const count = entries.length;
  // A thing with no act (someone standing as themselves) shows its name alone; a long list is a list, so the sheet opens.
  const bare = count === 0;
  const long = count > MOST_FANNED;
  // The labels' width as drawn, read once after the first layout: a long name or a large balance may need more room than the
  // measure the layout starts from, and the fan lays out again with it, or hands over to the sheet (before the first paint).
  const [label, setLabel] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const layout = useMemo(() => (point === null ? null : layoutAt(point, count, label)), [point, count, label]);
  const fits = layout !== null && layout.fits && !long;
  useLayoutEffect(() => {
    if (label !== null || layout === null || !fits || root.current === null) return;
    const widest = Math.max(0, ...[...root.current.querySelectorAll<HTMLElement>(".fan-labels")].map((node) => node.scrollWidth));
    if (widest > layout.sizes.label) setLabel(Math.ceil(widest));
  }, [layout, label, fits]);
  // The name's pill, placed once from where the thing first stood (titleAt).
  const titleRef = useRef<HTMLSpanElement>(null);
  const [titleShift, setTitleShift] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (titleShift !== null || point === null || point === "off" || titleRef.current === null) return;
    setTitleShift(titleAt(point, { width: titleRef.current.offsetWidth, height: titleRef.current.offsetHeight }, layout));
  }, [point, titleShift, layout]);
  const [shift, setShift] = useState(0);
  const [shaking, setShaking] = useState<{ id: string; n: number } | null>(null);
  const drag = useRef<{ y: number; from: number; moved: boolean } | null>(null);
  const fallback = useRef(onFallback);
  fallback.current = onFallback;

  // The fan opens with a whoosh, or hands over to the sheet when it cannot stand here; a name alone opens quietly.
  useEffect(() => {
    if (layout === null || bare) return;
    if (!fits) fallback.current();
    else cue("whoosh");
  }, [layout, bare, fits]);
  // The next opening reads the thing where it stands then.
  useEffect(() => () => clearFanAnchor(thing), [thing]);

  // Until the scene says where the thing stands, the fan is an empty anchor it can find; with no room beside the thing, nothing.
  if (layout === null) return <div aria-hidden className="fan pointer-events-none fixed top-0 left-0 z-[37]" data-fan={thing} />;
  // The thing's name over it, with a person's quiet mark beside it (world:things-are-tappable-models: a tap shows the thing's name and its acts).
  const name = (
    <span ref={titleRef} className="fan-title" data-fan-title style={titleShift === null ? undefined : { left: `${String(titleShift.x)}px`, top: `${String(titleShift.y)}px` }}>
      {title}
      {mark === undefined ? null : (
        <span className="fan-mark" data-person-mark={mark}>
          {cityWords(`ui.people.mark.${mark}`)}
        </span>
      )}
    </span>
  );
  if (bare) {
    return point === "off" ? null : (
      <div role="group" aria-label={title} className="fan pointer-events-none fixed top-0 left-0 z-[37]" data-fan={thing} data-fan-shown={0}>
        {name}
      </div>
    );
  }
  if (!fits) return null;
  const places = placesAt(layout, shift);
  const range = shiftRange(layout);
  const draggable = range.min < 0;

  const tap = (entry: FanEntry, folded: boolean): void => {
    if (drag.current?.moved === true) return;
    // A button past the fold comes up the curve first.
    if (folded) {
      const index = entries.indexOf(entry);
      setShift(Math.max(range.min, Math.min(range.max, -(index - layout.shown + 1) * layout.sizes.pitch)));
      return;
    }
    // A refusal answers with its own low double note and a shake, and nothing else happens (section 7, "Refuse").
    cue(entry.refusal !== null ? "no" : "tap");
    if (entry.refusal !== null) {
      setShaking((was) => ({ id: entry.id, n: (was?.n ?? 0) + 1 }));
      return;
    }
    onAct(entry);
  };

  const down = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!draggable) return;
    drag.current = { y: event.clientY, from: shift, moved: false };
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const held = drag.current;
    if (held === null) return;
    const moved = event.clientY - held.y;
    if (!held.moved && Math.abs(moved) < DRAG_PX) return;
    held.moved = true;
    setShift(Math.max(range.min, Math.min(range.max, held.from + moved)));
  };
  const up = (): void => {
    const held = drag.current;
    // The click that ends a drag lands after the pointer comes up: let it pass, then forget the drag.
    if (held?.moved === true) window.setTimeout(() => (drag.current = null), 0);
    else drag.current = null;
  };

  return (
    <div
      ref={root}
      role="group"
      aria-label={title}
      className="fan pointer-events-none fixed top-0 left-0 z-[37]"
      style={{ ["--fan-button" as string]: `${String(layout.sizes.button)}px`, ["--fan-gap" as string]: `${String(layout.sizes.gap)}px`, ["--fan-label" as string]: `${String(layout.sizes.label)}px` }}
      data-fan={thing}
      data-fan-side={layout.side}
      data-fan-size={layout.sizes.button > 64 ? "laptop" : "phone"}
      data-fan-shown={layout.shown}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {name}
      <svg className="fan-curve" width="1" height="1" aria-hidden>
        <path d={curvePath(layout, shift)} />
      </svg>
      {entries.map((entry, index) => {
        const place = places[index];
        if (place === undefined) return null;
        const refused = entry.refusal !== null;
        return (
          <div
            key={entry.id}
            className="fan-item"
            style={{ transform: `translate(${place.dx.toFixed(1)}px, ${place.dy.toFixed(1)}px)` }}
            data-fan-act={entry.id}
            data-fan-from={entry.from}
            data-fan-kind={entry.kind}
            data-tint={entry.tint}
            {...(place.folded ? { "data-fan-folded": "" } : {})}
            {...(refused ? { "data-fan-refused": entry.refusal?.kind } : {})}
            {...(going === entry.id ? { "data-fan-going": "" } : {})}
          >
            {/* The spring out of the thing, one after another, grows from the hinge (section 7, "Appear"). */}
            <div className="fan-spring" style={{ animationDelay: `${String(index * 40)}ms`, transformOrigin: `${(-place.dx).toFixed(0)}px ${(-place.dy).toFixed(0)}px` }}>
              <button
                key={shaking?.id === entry.id ? `shake-${String(shaking.n)}` : "still"}
                type="button"
                className={`fan-button pointer-events-auto${shaking?.id === entry.id ? " fan-shake" : ""}`}
                onClick={() => tap(entry, place.folded)}
                aria-label={entry.refusal !== null || entry.price !== null || entry.free === true ? `${entry.name}: ${entry.refusal?.words ?? entry.price ?? say("ui.world.free")}` : (entry.label ?? entry.name)}
                onPointerDown={() => {
                  if (entry.refusal === null && entry.balance !== null && !place.folded) onPreview?.(entry.balance.after.amount);
                }}
                onPointerUp={() => onPreview?.(null)}
                onPointerLeave={() => onPreview?.(null)}
                onPointerCancel={() => onPreview?.(null)}
                {...(refused ? { "aria-disabled": true } : {})}
                tabIndex={place.folded ? -1 : 0}
              >
                <span className="fan-disc" aria-hidden>
                  {/* The act's tile, cut as a sticker (the lively Sticker), tilted one way and the next the other. */}
                  <span className={`fan-sticker${index % 2 === 0 ? " fan-tilt-left" : " fan-tilt-right"}`} data-fan-picture={entry.picture}>
                    <Sticker alt={entry.name} tilt={0}>
                      <Tile of={entry.picture} size={Math.round(layout.sizes.button * 0.62)} />
                    </Sticker>
                  </span>
                </span>
                <span className="fan-labels" aria-hidden>
                  <span className={`fan-name${index % 2 === 0 ? " fan-tilt-left" : " fan-tilt-right"}`}>{entry.name}</span>
                  {entry.refusal !== null ? (
                    <span className={`fan-lock${entry.refusal.kind === "short" ? " fan-short num" : ""}`} data-fan-refusal={entry.refusal.kind}>
                      {entry.refusal.kind === "locked" ? <span aria-hidden>🔒 </span> : null}
                      {entry.refusal.words}
                    </span>
                  ) : entry.price !== null || entry.free === true ? (
                    // The price pill alone (chips earn their place): the balance is the band's counter, previewed while pressed.
                    <span className="fan-price num" data-fan-price>
                      {entry.price ?? say("ui.world.free")}
                    </span>
                  ) : null}
                </span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
