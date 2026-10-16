// The phone (docs/rules/world.md R-WORLD-018), its apps four across. The apps are handed in as the
// contract's `PhoneApp`, so the handset knows nothing of what they show.
import { ChevronLeft, Maximize2, Minimize2 } from "lucide-react";
import { type ReactNode, type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { PhoneNav } from "../../shared/phone/nav";
import { CentredColumn } from "../../shared/ui/lively/CentredColumn";
import { invertedTransform, layoutBox, type LayoutBox, motionOn } from "../../shared/ui/motion";
import type { PhoneApp } from "../../shared/world/contract";
import { tell, useLines } from "../../shared/world/Lines";
import { PhoneBack, PhoneSaid } from "./act";
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
  /** The place's picture beside its name on the wallpaper, where it has one. */
  areaPicture?: ReactNode;
}

/**
 * The room the grown handset leaves above it for the told lane (R-WORLD-026): grown to the screen's top, a lane above it
 * would stand off the screen, so the grown handset is this much shorter, still nearly the whole screen (R-WORLD-018).
 */
export const TOLD_LANE = "h-[calc(100dvh-max(8px,env(safe-area-inset-top))-max(8px,env(safe-area-inset-bottom))-44px)]";

/**
 * What an app's act did, told over the handset in the corner's own look (R-WORLD-026), in a lane of its own just above the
 * handset: never inside the glass, where it sat on the Jobs and Market icons and on Send money home (
 * pictures 149 and 150). Above the handset at rest is the dimmed world under the band; grown, the room it leaves.
 */
function Told() {
  const { lines } = useLines();
  const line = lines[0];
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-full mb-2 flex justify-center" data-phone-told-lane>
      {line === undefined ? null : (
        <p key={line.id} className="talk-corner rise max-w-[92%] px-4 py-1.5 text-center text-[14px] leading-snug font-bold" role="status" data-corner data-told>
          {line.text}
        </p>
      )}
    </div>
  );
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

export function Phone({ apps, onClose, area, when, onOpen, now = realNow, start = null, notices = null, onMap, areaPicture = null }: PhoneProps) {
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
  // An app's inner screen hands the head's Back its way to the app's first screen (act.tsx, useInnerBack).
  const [inner, setInner] = useState<(() => void) | null>(null);
  const handBack = useCallback((back: (() => void) | null) => setInner(() => back), []);
  const back = () => (inner === null ? setOpen(null) : inner());
  const grow = (
    <button
      type="button"
      onClick={toggle}
      aria-label={phoneWords(grown ? "phone.shrink" : "phone.grow")}
      aria-pressed={grown}
      data-grow
      className={`press phone-round flex size-10 shrink-0 items-center justify-center ${app === null ? "bg-white/15 text-wall-text" : "border border-sheet-line bg-sheet-2 text-text shadow-[0_2px_6px_rgba(19,26,51,0.08)]"}`}
    >
      {grown ? <Minimize2 size={17} aria-hidden /> : <Maximize2 size={17} aria-hidden />}
    </button>
  );

  return (
    <PhoneSaid value={tell}>
      <PhoneBack value={handBack}>
      <PhoneNav value={{ openApp, close: putAway, ...(onMap === undefined ? {} : { openMap: onMap }) }}>
      <div className="fixed inset-0 z-[44]" role="dialog" aria-modal="true" aria-label={phoneWords("phone.title")} data-phone data-grown={grown} data-away={away}>
        <button type="button" tabIndex={-1} aria-hidden onClick={putAway} className={`motion-in-fade absolute inset-0 cursor-default bg-scrim ${away ? "opacity-0" : ""}`} data-phone-scrim />
        {/* The handset is laid out at rest or grown, centred at the foot, and never moves by layout: the grow and the
            shrink are one transform from the box it left (useGrow), and putting it away is a transform too, so the
            frames between are the compositor's (R-WORLD-023). On a laptop it is laid out in
            the centred column, so grown it is a phone's width, not the screen's (decision 0038). */}
        <CentredColumn className="pointer-events-none absolute inset-0">
        <div
          ref={handset}
          className={`pointer-events-auto absolute ${away ? "motion-away handset-away" : `motion-handset ${grown ? "handset-grown" : "handset-rest"}`} ${
            grown
              ? `bottom-[max(8px,env(safe-area-inset-bottom))] left-2 ${TOLD_LANE} w-[calc(100%-16px)]`
              : "bottom-[max(12px,env(safe-area-inset-bottom))] left-[calc(50%-min(44vw,170px))] h-[min(78dvh,600px)] w-[min(88vw,340px)]"
          }`}
          data-handset
        >
          <Told />
          <div className="phone-up flex h-full flex-col rounded-[34px] bg-device p-[7px] shadow-[0_24px_60px_rgba(10,14,30,0.55)]">
            <div className={`relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] ${app === null ? "phone-wall" : "bg-sheet text-text"}`} data-phone-glass>
              <div ref={screen} className="motion-screen flex min-h-0 flex-1 flex-col" data-phone-screen>
              {app === null ? (
                <div className="motion-in-fade flex min-h-0 flex-1 flex-col" data-phone-home>
                  {/* The lock screen as the after set draws it (phone-home): the big clock, the day in words, the place as a pill
                      with its picture; no pattern on the wallpaper, which keeps to the data page (design page 13, section 2). */}
                  <div className="flex items-start justify-between px-5 pt-5">
                    <div className="min-w-0">
                      <div className="text-[56px] leading-none font-bold tracking-[-0.03em] tabular-nums" data-phone-time>
                        {time}
                      </div>
                      <div className="mt-2 text-[16px] font-medium opacity-85">{when}</div>
                      <div className="phone-wall-pill mt-2 inline-flex max-w-full items-center gap-1.5 py-1 pr-3 pl-1.5">
                        {areaPicture === null ? null : (
                          <span className="sticker-cut shrink-0" style={{ rotate: "-6deg" }}>
                            {areaPicture}
                          </span>
                        )}
                        <span className="truncate text-[16px] font-bold" data-phone-area>
                          {area}
                        </span>
                      </div>
                    </div>
                    {grow}
                  </div>
                  {/* What the wallpaper tells and the grid of apps scroll together above the home bar: the status clock's
                      banner stands whole and the grid scrolls under it when both do not fit, never pushed out of reach under
                      the home bar. With room to spare the grid rests at the foot. */}
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain" data-wallpaper-room>
                    {notices}
                    <ul className="mt-auto grid shrink-0 grid-cols-4 gap-x-2 gap-y-4 px-4 pt-6 pb-4" aria-label={phoneWords("phone.apps")}>
                    {apps.map((candidate) => (
                      <li key={candidate.id} className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openApp(candidate.id)}
                          data-app={candidate.id}
                          aria-label={candidate.waiting ? `${candidate.name}, ${phoneWords("phone.new")}` : candidate.name}
                          className="phone-app-icon press pop relative flex size-[56px] items-center justify-center rounded-[16px] text-white"
                          style={{ background: `var(${candidate.tint})` }}
                        >
                          <PhoneIcon name={candidate.icon} size={26} />
                          {candidate.waiting ? <span className="absolute -top-1.5 -right-1.5 size-4 rounded-full border-2 border-white bg-signal" aria-hidden data-dot /> : null}
                        </button>
                        <span className="max-w-full truncate text-[13px] font-bold" aria-hidden>
                          {candidate.name}
                        </span>
                      </li>
                    ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div key={app.id} className="motion-in-right flex min-h-0 flex-1 flex-col bg-sheet text-text">
                  {/* The app's head: back, the app's own icon as a small tile, its name in
                      Rubik, and the grow as a round white button; plain on the sheet, no band. */}
                  <div className="flex items-center gap-2 px-2.5 pt-3 pb-2" data-app-head>
                    <button type="button" onClick={back} aria-label={phoneWords("phone.back")} data-phone-back className="press phone-round flex size-9 shrink-0 items-center justify-center">
                      <ChevronLeft size={24} aria-hidden />
                    </button>
                    <span className="phone-app-tile flex size-10 shrink-0 items-center justify-center rounded-[12px] text-white" style={{ background: `var(${app.tint})` }} aria-hidden data-app-tile>
                      <PhoneIcon name={app.icon} size={20} />
                    </span>
                    {/* The pill stands beside the name, and drops under it where the phone at rest has no room for both. */}
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                      <h2 className="shrink-0 text-[24px] leading-tight font-bold">{app.name}</h2>
                      {/* What is there now (the notes item 19). */}
                      {app.context === undefined || app.context === null ? null : (
                        <span className="pill max-w-full px-2.5 py-0.5 text-[13px] font-bold whitespace-nowrap" data-app-context>
                          <span className="truncate">{app.context}</span>
                        </span>
                      )}
                    </div>
                    {grow}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-1 pb-3" data-app-screen={app.id}>
                    {app.screen}
                  </div>
                </div>
              )}
              <div className="flex justify-center pt-1 pb-2">
                <button type="button" onClick={putAway} aria-label={phoneWords("phone.close")} data-home-bar className="flex h-6 w-40 items-center justify-center">
                  <span className={`h-[5px] w-28 rounded-[3px] ${app === null ? "bg-wall-text/70" : "bg-text/30"}`} />
                </button>
              </div>
              </div>
            </div>
          </div>
        </div>
        </CentredColumn>
      </div>
      </PhoneNav>
      </PhoneBack>
    </PhoneSaid>
  );
}
