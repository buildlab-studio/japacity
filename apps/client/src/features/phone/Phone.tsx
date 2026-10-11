// The phone (docs/rules/world.md R-WORLD-018), its apps four across. The apps are handed in as the
// contract's `PhoneApp`, so the handset knows nothing of what they show.
import { ChevronLeft, Maximize2, Minimize2 } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";

import { PhoneNav } from "../../shared/phone/nav";
import { invertedTransform, layoutBox, type LayoutBox, motionOn } from "../../shared/ui/motion";
import type { PhoneApp } from "../../shared/world/contract";
import { Corner, tell } from "../../shared/world/Lines";
import { PhoneSaid } from "./act";
import { PhoneIcon } from "./icons";
import { phoneWords } from "./phone.words";

export interface PhoneProps {
  apps: readonly PhoneApp[];
  onClose: () => void;
  /** The place the character is in, for the wallpaper. */
  area: string;
  /** The month as the band says it: "Month 6". */
  when: string;
  /** Called when an app opens, so what it holds counts as seen. */
  onOpen?: (id: string) => void;
  /** The clock, for tests. */
  now?: () => Date;
  /** An app to open on, counted as seen (the nudge's "The month's news is in", R-WORLD-003). */
  start?: string | null;
  /** What the wallpaper tells between the clock and the apps: the month's acts telling of themselves (R-WORLD-030). */
  notices?: ReactNode;
  /** Puts the phone away onto the map at a stop (R-WORLD-019): a paper's visit in Papers. */
  onMap?: (stop: string) => void;
}

const CLOCK = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const MINUTE_MS = 60_000;

/** The time of day on the device, kept to the minute. */
function useClock(now: () => Date): string {
  const [time, setTime] = useState(() => CLOCK.format(now()));
  useEffect(() => {
    const timer = window.setInterval(() => setTime(CLOCK.format(now())), MINUTE_MS);
    return () => window.clearInterval(timer);
  }, [now]);
  return time;
}

const realNow = () => new Date();

/** The handset's tilt at rest at the foot, in degrees: `.handset-rest` in index.css says the same. */
export const REST_TILT_DEG = -2;
/** The grow or shrink, frame and then content (index.css `.motion-handset`, `.motion-screen`): the frame lands, then the screen fades in. */
export const GROW_MS = 250;
export const SCREEN_FADE_MS = 150;
/** Putting the phone away (index.css `.motion-away`): it drops back the way it rose, then it is gone. */
export const AWAY_MS = 200;

/**
 * The grow and the shrink as one move (world.md R-WORLD-018, R-WORLD-023). The handset is
 * laid out once at its new size; FLIP then draws it where it stood (`invertedTransform`) and lets the transition carry it
 * home, so every frame between is a transform the compositor draws and nothing is laid out again. Its content, laid out
 * at the new size, stays hidden in flight and fades in once the frame lands. A tap while it flies waits for the landing.
 */
function useGrow(): { grown: boolean; toggle: () => void; handset: RefObject<HTMLDivElement | null>; screen: RefObject<HTMLDivElement | null> } {
  const [grown, setGrown] = useState(false);
  const handset = useRef<HTMLDivElement | null>(null);
  const screen = useRef<HTMLDivElement | null>(null);
  const from = useRef<LayoutBox | null>(null);
  const flying = useRef(false);
  const toggle = () => {
    if (flying.current) return;
    from.current = handset.current !== null && motionOn() ? layoutBox(handset.current) : null;
    setGrown((was) => !was);
  };
  useLayoutEffect(() => {
    const first = from.current;
    from.current = null;
    const frame = handset.current;
    const content = screen.current;
    if (first === null || frame === null || content === null) return;
    // First and last: where it stood, and where it is laid out now. Invert, with no transition, before the first paint.
    frame.style.transition = "none";
    content.style.transition = "none";
    frame.style.transform = invertedTransform(first, layoutBox(frame), grown ? REST_TILT_DEG : 0);
    content.style.opacity = "0";
    // The inverted frame is the starting style: read a box so the browser takes it before the play.
    frame.getBoundingClientRect();
    // Play: the class's transform is the end, and its transition carries the frame there; the content fades in after.
    frame.style.transition = "";
    content.style.transition = "";
    frame.style.transform = "";
    content.style.opacity = "";
    flying.current = true;
    const landed = window.setTimeout(() => {
      flying.current = false;
    }, GROW_MS);
    return () => {
      window.clearTimeout(landed);
      flying.current = false;
    };
  }, [grown]);
  return { grown, toggle, handset, screen };
}

export function Phone({ apps, onClose, area, when, onOpen, now = realNow, start = null, notices = null, onMap }: PhoneProps) {
  const [open, setOpen] = useState<string | null>(start);
  const started = useRef(false);
  useEffect(() => {
    if (start === null || started.current) return;
    started.current = true;
    onOpen?.(start);
  }, [start, onOpen]);
  const { grown, toggle, handset, screen } = useGrow();
  const [away, setAway] = useState(false);
  /** Puts the phone away: it drops back the way it rose while the scrim clears, then it is gone (R-WORLD-023). */
  const putAway = () => {
    if (away) return;
    if (motionOn()) setAway(true);
    else onClose();
  };
  // Gone when the drop ends, on its own clock rather than a timer's; a drop that never started closes at once.
  const closed = useRef(false);
  useEffect(() => {
    const frame = handset.current;
    if (!away || frame === null) return;
    const done = (event?: TransitionEvent) => {
      if (event !== undefined && (event.target !== frame || event.propertyName !== "transform")) return;
      if (closed.current) return;
      closed.current = true;
      onClose();
    };
    frame.getBoundingClientRect();
    if (frame.getAnimations().length === 0) {
      done();
      return;
    }
    frame.addEventListener("transitionend", done);
    frame.addEventListener("transitioncancel", done);
    return () => {
      frame.removeEventListener("transitionend", done);
      frame.removeEventListener("transitioncancel", done);
    };
  }, [away, handset, onClose]);
  const time = useClock(now);
  const app = apps.find((candidate) => candidate.id === open) ?? null;
  const openApp = (id: string) => {
    setOpen(id);
    onOpen?.(id);
  };
  const grow = (
    <button type="button" onClick={toggle} aria-label={phoneWords(grown ? "phone.shrink" : "phone.grow")} aria-pressed={grown} data-grow className="press flex size-9 items-center justify-center rounded-[5px]">
      {grown ? <Minimize2 size={17} aria-hidden /> : <Maximize2 size={17} aria-hidden />}
    </button>
  );

  return (
    <PhoneSaid value={tell}>
      <PhoneNav value={{ openApp, close: putAway, ...(onMap === undefined ? {} : { openMap: onMap }) }}>
      <div className="fixed inset-0 z-[44]" role="dialog" aria-modal="true" aria-label={phoneWords("phone.title")} data-phone data-grown={grown} data-away={away}>
        <button type="button" tabIndex={-1} aria-hidden onClick={putAway} className={`motion-in-fade absolute inset-0 cursor-default bg-scrim ${away ? "opacity-0" : ""}`} data-phone-scrim />
        {/* The handset is laid out at rest or grown, centred at the foot, and never moves by layout: the grow and the
            shrink are one transform from the box it left (useGrow), and putting it away is a transform too, so the
            frames between are the compositor's (R-WORLD-023). */}
        <div
          ref={handset}
          className={`absolute ${away ? "motion-away handset-away" : `motion-handset ${grown ? "handset-grown" : "handset-rest"}`} ${
            grown
              ? "bottom-[max(8px,env(safe-area-inset-bottom))] left-2 h-[calc(100dvh-max(8px,env(safe-area-inset-top))-max(8px,env(safe-area-inset-bottom)))] w-[calc(100vw-16px)]"
              : "bottom-[max(12px,env(safe-area-inset-bottom))] left-[calc(50%-min(44vw,170px))] h-[min(78dvh,600px)] w-[min(88vw,340px)]"
          }`}
          data-handset
        >
          <div className="phone-up flex h-full flex-col rounded-[34px] bg-device p-[7px] shadow-[0_24px_60px_rgba(10,14,30,0.55)]">
            <div className={`relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] ${app === null ? "wall" : "bg-sheet text-text"}`} data-phone-glass>
              <div ref={screen} className="motion-screen flex min-h-0 flex-1 flex-col" data-phone-screen>
              {app === null ? (
                <div className="motion-in-fade flex min-h-0 flex-1 flex-col" data-phone-home>
                  <div className="flex items-start justify-between px-5 pt-5">
                    <div className="min-w-0">
                      <div className="num text-[44px] leading-none" data-phone-time>
                        {time}
                      </div>
                      <div className="label mt-2 opacity-80">{when}</div>
                      <div className="title truncate text-[17px]" data-phone-area>
                        {area}
                      </div>
                    </div>
                    {grow}
                  </div>
                  {notices}
                  <ul className="mt-auto grid grid-cols-4 gap-x-2 gap-y-4 px-4 pt-6 pb-4" aria-label={phoneWords("phone.apps")}>
                    {apps.map((candidate) => (
                      <li key={candidate.id} className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openApp(candidate.id)}
                          data-app={candidate.id}
                          aria-label={candidate.waiting ? `${candidate.name}, ${phoneWords("phone.new")}` : candidate.name}
                          className="press pop relative flex size-[56px] items-center justify-center rounded-[14px] text-on-strong shadow-[0_6px_14px_rgba(10,14,30,0.35)]"
                          style={{ background: `var(${candidate.tint})` }}
                        >
                          <PhoneIcon name={candidate.icon} size={26} />
                          {candidate.waiting ? <span className="absolute -top-1 -right-1 size-3.5 rounded-full border-2 border-sheet bg-signal" aria-hidden data-dot /> : null}
                        </button>
                        <span className="max-w-full truncate text-[12px] font-bold" aria-hidden>
                          {candidate.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div key={app.id} className="motion-in-right flex min-h-0 flex-1 flex-col bg-sheet text-text">
                  <div className="band flex items-center gap-1 px-2 pt-3 pb-2">
                    <button type="button" onClick={() => setOpen(null)} aria-label={phoneWords("phone.back")} data-phone-back className="press flex size-9 items-center justify-center rounded-[5px]">
                      <ChevronLeft size={22} aria-hidden />
                    </button>
                    <h2 className="title min-w-0 flex-1 truncate text-[20px]">{app.name}</h2>
                    {grow}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3" data-app-screen={app.id}>
                    {app.screen}
                  </div>
                </div>
              )}
              <div className="flex justify-center pt-1 pb-2">
                <button type="button" onClick={putAway} aria-label={phoneWords("phone.close")} data-home-bar className="flex h-6 w-40 items-center justify-center">
                  <span className={`h-[5px] w-28 rounded-[2px] ${app === null ? "bg-wall-text/70" : "bg-text/40"}`} />
                </button>
              </div>
              </div>
            </div>
          </div>
        </div>
        {/* What an app's act did is told over the handset, in the corner's own look, so it is read while the phone covers the world (R-WORLD-026). */}
        <Corner told />
      </div>
      </PhoneNav>
    </PhoneSaid>
  );
}
