// The phone (docs/rules/world.md R-WORLD-018), its apps four across. The apps are handed in as the
// contract's `PhoneApp`, so the handset knows nothing of what they show.
import { ChevronLeft, Maximize2, Minimize2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

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

export function Phone({ apps, onClose, area, when, onOpen, now = realNow, start = null, notices = null }: PhoneProps) {
  const [open, setOpen] = useState<string | null>(start);
  const started = useRef(false);
  useEffect(() => {
    if (start === null || started.current) return;
    started.current = true;
    onOpen?.(start);
  }, [start, onOpen]);
  const [grown, setGrown] = useState(false);
  const time = useClock(now);
  const app = apps.find((candidate) => candidate.id === open) ?? null;
  const openApp = (id: string) => {
    setOpen(id);
    onOpen?.(id);
  };
  const grow = (
    <button type="button" onClick={() => setGrown(!grown)} aria-label={phoneWords(grown ? "phone.shrink" : "phone.grow")} aria-pressed={grown} data-grow className="press flex size-9 items-center justify-center rounded-[5px]">
      {grown ? <Minimize2 size={17} aria-hidden /> : <Maximize2 size={17} aria-hidden />}
    </button>
  );

  return (
    <PhoneSaid value={tell}>
      <div className="fixed inset-0 z-[44]" role="dialog" aria-modal="true" aria-label={phoneWords("phone.title")} data-phone data-grown={grown}>
        <button type="button" tabIndex={-1} aria-hidden onClick={onClose} className="fade absolute inset-0 cursor-default bg-scrim" />
        {/* Grown and small share one anchor (the bottom middle, shifted half its width) and set the same four
            numbers, so growing and shrinking move every edge together; a width or edge left to "auto" cannot
            animate and would snap. */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 transition-[bottom,width,height,rotate] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
            grown
              ? "bottom-[max(8px,env(safe-area-inset-bottom))] h-[calc(100dvh-max(8px,env(safe-area-inset-top))-max(8px,env(safe-area-inset-bottom)))] w-[calc(100vw-16px)] rotate-0"
              : "bottom-[max(12px,env(safe-area-inset-bottom))] h-[min(78dvh,600px)] w-[min(88vw,340px)] -rotate-2"
          }`}
          data-handset
        >
          <div className="phone-up flex h-full flex-col rounded-[34px] bg-device p-[7px] shadow-[0_24px_60px_rgba(10,14,30,0.55)]">
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] bg-sheet text-text">
              {app === null ? (
                <div className="wall flex min-h-0 flex-1 flex-col" data-phone-home>
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
                <>
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
                </>
              )}
              <div className={`flex justify-center pt-1 pb-2 ${app === null ? "wall" : "bg-sheet"}`}>
                <button type="button" onClick={onClose} aria-label={phoneWords("phone.close")} data-home-bar className="flex h-6 w-40 items-center justify-center">
                  <span className={`h-[5px] w-28 rounded-[2px] ${app === null ? "bg-wall-text/70" : "bg-text/40"}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* What an app's act did is told over the handset, in the corner's own look, so it is read while the phone covers the world (R-WORLD-026). */}
        <Corner told />
      </div>
    </PhoneSaid>
  );
}
