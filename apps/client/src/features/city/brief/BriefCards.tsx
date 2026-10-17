// The mission card and the chapter close (docs/design/13-the-lively-layer.md section 4; the after set's
// world-chapter-title and world-chapter-close): a brief handed by its person in their voice, the things as
// sticker tiles with the place under each, the reward as picture chips, the next brief faint, one button "Let's go"; and
// at the close the same card with every tick, the stamp landing with a thud, confetti, and the next briefs as picture cards.
import { useEffect } from "react";

import { cue } from "../../../shared/sound/cues";
import { Tile } from "../../../shared/tiles/Tile";
import { CentredColumn } from "../../../shared/ui/lively/CentredColumn";
import { Face } from "../../../shared/ui/lively/Face";
import { PressButton } from "../../../shared/ui/lively/PressButton";
import { say } from "../../../shared/words/text";
import type { Brief, BriefItem } from "./brief";

/** The card's head: who hands it over and where, and which road it is on. */
function Giver({ brief }: { brief: Brief }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Face name={say("ui.brief.who", { name: brief.giver.name, where: brief.giver.where })} />
      <span className="sticker-chip bg-tint-money" style={{ rotate: "3deg", color: "var(--money-ink)" }} data-brief-road>
        {say("ui.brief.road")}
      </span>
    </div>
  );
}

/** One thing of the brief as a sticker tile: its picture, its words, the place under it, a tick once it is in. */
function ItemTile({ item, index }: { item: BriefItem; index: number }) {
  return (
    <li className={`brief-step relative flex flex-col items-center gap-1 rounded-[16px] px-1.5 pt-2.5 pb-2 text-center ${item.now ? "brief-step-now" : ""}`} data-brief-item={item.id} data-met={item.met} data-now={item.now}>
      <span className="sticker-cut wobble-in" style={{ rotate: `${String(index % 2 === 0 ? -5 : 4)}deg`, animationDelay: `${String(120 + index * 60)}ms` }}>
        <Tile of={item.picture} size={40} />
      </span>
      <span className="text-[14px] leading-tight font-bold">{item.words}</span>
      <span className="text-[12px] leading-tight text-text-2">
        {item.now ? (
          <>
            <b className="text-[var(--soft-ink)]">{say("ui.brief.now")}</b> · {item.place}
          </>
        ) : (
          item.place
        )}
      </span>
      {item.met ? (
        <span className="brief-tick pop absolute -top-1.5 -right-1 flex size-6 items-center justify-center text-[14px] font-bold text-white" aria-label={say("ui.brief.done")} data-brief-tick>
          ✓
        </span>
      ) : null}
    </li>
  );
}

function Items({ items }: { items: readonly BriefItem[] }) {
  return (
    <ul className={`grid gap-2 ${items.length === 4 ? "grid-cols-2" : "grid-cols-3"}`} data-brief-items>
      {items.map((item, index) => (
        <ItemTile key={item.id} item={item} index={index} />
      ))}
    </ul>
  );
}

/** The brief's title block: the picture of what you are after, the title with a wink, the place it all happens. */
function Head({ brief, line }: { brief: Brief; line: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-tint-plain p-3">
      <span className="sticker-cut wobble-in shrink-0" style={{ rotate: "-6deg" }}>
        <Tile of={brief.picture} size={60} />
      </span>
      <div className="min-w-0">
        <h2 className="text-[26px] leading-tight font-bold" data-brief-title>
          {brief.title}
        </h2>
        <p className="text-[15px] leading-snug text-text-2">{line}</p>
      </div>
    </div>
  );
}

/**
 * The mission card (R-WORLD-001 as the hand redraws it): handed by its person, their words first, one button. The card's
 * Let's go carries the opening's mark (`data-opening-go`), so whatever passed the opening card passes this one; the card
 * is marked open as a sheet is, so a staged ask waits for it to close (account.md R-ACCOUNT-023).
 */
export function MissionCard({ brief, onGo }: { brief: Brief; onGo: () => void }) {
  useEffect(() => cue("open"), []);
  const now = brief.items.find((item) => item.now);
  return (
    <>
    {/* The card stands on the drawn place, dimmed as behind the chapter's close (R-WORLD-001), never on a blank world: the
        shell shows it only once the place's first frame is drawn. */}
    <div aria-hidden className="fade fixed inset-0 z-[45] bg-scrim/60" data-brief-scrim />
    <CentredColumn className="pointer-events-none fixed inset-x-0 bottom-0 z-[46] px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <section className="brief-card pop pointer-events-auto flex max-h-[78dvh] flex-col gap-3 overflow-y-auto p-3.5" role="dialog" aria-label={say("ui.brief.label", { title: brief.title, name: brief.giver.name })} data-brief={brief.chapter} data-opening={brief.chapter} data-open>
        <Giver brief={brief} />
        <p className="text-[15px] leading-snug" data-brief-line>
          “{brief.line}”
        </p>
        <Head brief={brief} line={now?.place ?? brief.giver.where} />
        <Items items={brief.items} />
        {brief.rewards.length === 0 ? null : (
          <div className="flex flex-wrap gap-2" data-brief-rewards>
            {brief.rewards.map((reward, index) => (
              <span key={reward.words} className={`sticker-chip text-[14px] ${index === 0 ? "bg-tint-money" : "bg-[var(--soft)]"}`} style={{ rotate: `${String(index % 2 === 0 ? -2 : 2)}deg` }}>
                <span aria-hidden>{reward.emoji}</span>
                {reward.words}
              </span>
            ))}
          </div>
        )}
        {brief.next === null ? null : (
          <p className="flex items-center gap-2 text-[14px] font-bold text-text-2 opacity-70" data-brief-next={brief.next.chapter}>
            {say("ui.brief.then", { title: brief.next.title })}
          </p>
        )}
        <PressButton
          className="w-full"
          onClick={() => {
            cue("tap");
            onGo();
          }}
          data-opening-go
          data-brief-go
        >
          {say("ui.brief.go")}
        </PressButton>
      </section>
    </CentredColumn>
    </>
  );
}

/** Confetti for the close: a few short pieces, on transform and opacity alone, gone under a second (section 7, "Answer"). */
const CONFETTI = ["#1fb866", "#c2185b", "#2c3f87", "#f6b800", "#f28c38", "#ffffff"] as const;

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden data-confetti>
      {Array.from({ length: 18 }, (_, index) => (
        <i
          key={index}
          className="brief-confetti absolute block h-3.5 w-2 rounded-[2px]"
          style={{
            left: `${String(6 + ((index * 37) % 88))}%`,
            top: `${String(8 + ((index * 23) % 30))}%`,
            background: CONFETTI[index % CONFETTI.length],
            animationDelay: `${String((index % 6) * 45)}ms`,
            ["--dx" as string]: `${String(((index * 29) % 60) - 30)}px`,
            ["--rot" as string]: `${String(120 + ((index * 53) % 200))}deg`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * The chapter close (section 4): the brief's card comes back with every tick, the stamp lands with a thud and the
 * confetti falls; under it the next briefs as picture cards, the first to take and the one after faint; Let's go hands
 * the next.
 */
export function ChapterClose({ brief, line, next, after, onGo }: { brief: Brief; line: string; next: Brief | null; after: { chapter: string; title: string } | null; onGo: () => void }) {
  useEffect(() => {
    cue("ding");
    const timer = window.setTimeout(() => cue("thud"), 260);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <>
    {/* The world dims behind the close, as behind any moment (R-WORLD-001), and the thumbs wait under it. */}
    <div aria-hidden className="motion-scrim fixed inset-0 z-[45] bg-scrim" data-brief-close-scrim />
    <CentredColumn className="pointer-events-none fixed inset-0 z-[46] flex flex-col justify-end px-3 pt-[max(76px,calc(env(safe-area-inset-top)+76px))] pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto relative flex max-h-full flex-col gap-3 overflow-y-auto" role="dialog" aria-label={brief.title} data-brief-close={brief.chapter} data-open>
        <section className="brief-card pop relative flex flex-col gap-3 p-3.5">
          <Giver brief={brief} />
          <Head brief={brief} line={line} />
          <Items items={brief.items.map((item) => ({ ...item, met: true, now: false }))} />
          <span className="brief-stamp stamp pointer-events-none absolute right-4 bottom-6 rounded-[12px] px-4 py-1 text-[30px] font-bold" style={{ ["--r" as string]: "-14deg" }} data-brief-stamp>
            {say("ui.brief.done")}
          </span>
          <Confetti />
        </section>
        {next === null ? null : (
          <>
            <p className="px-1 text-[16px] font-bold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.5)]">{say("ui.brief.next-road")}</p>
            <div className="lively-card rise flex items-center gap-3 p-3" data-brief-next-card={next.chapter}>
              <span className="flex size-[72px] shrink-0 items-center justify-center rounded-[16px] bg-[var(--soft)]">
                <span className="sticker-cut" style={{ rotate: "-5deg" }}>
                  <Tile of={next.picture} size={48} />
                </span>
              </span>
              <div className="min-w-0">
                <p className="text-[22px] leading-tight font-bold">{next.title}</p>
                <p className="truncate text-[15px] text-text-2">{next.giver.name}, {next.giver.where}</p>
                <div className="mt-1 flex gap-1">
                  {next.items.slice(0, 4).map((item) => (
                    <span key={item.id} className="sticker-cut" style={{ rotate: "3deg" }}>
                      <Tile of={item.picture} size={22} />
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {after === null ? null : (
              <div className="lively-card flex items-center gap-3 p-3 opacity-60" data-brief-after={after.chapter}>
                <p className="text-[18px] font-bold">{say("ui.brief.then", { title: after.title })}</p>
              </div>
            )}
          </>
        )}
        <PressButton
          className="w-full"
          onClick={() => {
            cue("tap");
            onGo();
          }}
          data-brief-close-go
        >
          {say("ui.brief.go")}
        </PressButton>
      </div>
    </CentredColumn>
    </>
  );
}
