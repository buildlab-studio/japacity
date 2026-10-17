// The road's log on the phone: the brief carried first, as
// it was handed, its things ticked as the world ticks them; behind it the briefs already done, each stamped and told in
// its giver's closing words; and the next brief faint at the foot. Nothing here is a checklist to work through: each card
// is a thing a person handed you, with their name on it. The shell hands it to the Japa app, so the phone imports no
// other feature.
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";

import { useView } from "../../../authority/GameProvider";
import { Tile } from "../../../shared/tiles/Tile";
import { Face } from "../../../shared/ui/lively/Face";
import { openingKey } from "../../../shared/words/sixteen";
import { hasWords, say, words } from "../../../shared/words/text";
import { type Brief, baseOf, briefDots, briefOf, nextBase } from "./brief";

/** A brief's picture on its soft tile, cut as a sticker. */
function Picture({ of, size, soft = false }: { of: string; size: number; soft?: boolean }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-[16px] ${soft ? "bg-[var(--soft)]" : "bg-tint-plain"}`} style={{ width: size, height: size }} aria-hidden>
      <span className="sticker-cut" style={{ rotate: "-6deg" }}>
        <Tile of={of} size={Math.round(size * 0.68)} />
      </span>
    </span>
  );
}

/** The dots of the carried brief: green for a thing in, yellow for the one now, pale for the rest. */
function Dots({ brief }: { brief: Brief }) {
  return (
    <span className="flex items-center gap-[3px]" aria-hidden data-brief-dots>
      {briefDots(brief.items).map((dot, index) => (
        <i key={brief.items[index]?.id ?? String(index)} className={`brief-dot brief-dot-${dot} block size-[8px]`} data-dot={dot} />
      ))}
    </span>
  );
}

/** The brief carried now: its card as it was handed, the giver's words, each thing with its place, ticked once it is in. */
function Carried({ brief }: { brief: Brief }) {
  return (
    <li className="lively-card phone-picked flex flex-col gap-2.5 p-3" data-brief-log="carried" data-brief-log-chapter={brief.chapter}>
      <div className="flex items-center gap-3">
        <Picture of={brief.picture} size={60} soft />
        <div className="min-w-0 flex-1">
          <p className="text-[18px] leading-tight font-bold">{brief.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Face name={brief.giver.name} className="text-[13px]" />
            <Dots brief={brief} />
          </div>
        </div>
        <span className="sticker-chip shrink-0 self-start bg-[var(--soft)]" style={{ rotate: "3deg", color: "var(--soft-ink)" }}>
          {say("ui.brief.carrying")}
        </span>
      </div>
      {brief.line === "" ? null : (
        <p className="text-[14px] leading-snug text-text-2" data-brief-log-line>
          “{brief.line}”
        </p>
      )}
      <ul className="flex flex-col gap-1.5">
        {brief.items.map((item) => (
          <li key={item.id} className={`flex items-center gap-2.5 rounded-[14px] px-2 py-1.5 ${item.now ? "brief-step-now" : "brief-step"}`} data-brief-log-item={item.id} data-met={item.met ? "true" : "false"}>
            <span className="sticker-cut shrink-0" style={{ rotate: "-4deg" }} aria-hidden>
              <Tile of={item.picture} size={26} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-[15px] leading-tight font-bold ${item.met ? "text-text-2" : ""}`}>{item.words}</span>
              <span className="block text-[12px] text-text-2">{item.place}</span>
            </span>
            {item.met ? (
              <span className="brief-tick flex size-6 shrink-0 items-center justify-center text-[14px] font-bold text-white" aria-label={say("ui.brief.done")}>
                ✓
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </li>
  );
}

/** A brief already done: stamped, its giver's closing words telling what was done. */
function Done({ brief }: { brief: Brief }) {
  return (
    <li className="lively-card relative flex items-center gap-3 p-3" data-brief-log="done" data-brief-log-chapter={brief.chapter}>
      <Picture of={brief.picture} size={48} />
      <div className="min-w-0 flex-1 pr-12">
        <p className="text-[16px] leading-tight font-bold">{brief.title}</p>
        <Face name={brief.giver.name} className="mt-1 text-[13px]" />
        {brief.line === "" ? null : <p className="mt-1 text-[13px] leading-snug text-text-2">{brief.line}</p>}
      </div>
      <span className="brief-stamp pointer-events-none absolute top-3 right-3 rounded-[10px] px-2 py-0.5 text-[15px] font-bold" style={{ rotate: "-12deg" }} data-brief-log-stamp>
        {say("ui.brief.done")}
      </span>
    </li>
  );
}

/** The brief after the carried one, faint: its title and who will hand it. */
function Next({ brief }: { brief: Brief }) {
  return (
    <li className="lively-card flex items-center gap-3 p-3 opacity-60" data-brief-log="next" data-brief-log-chapter={brief.chapter}>
      <Picture of={brief.picture} size={48} />
      <div className="min-w-0 flex-1">
        <p className="text-[16px] leading-tight font-bold">{brief.title}</p>
        <Face name={brief.giver.name} className="mt-1 text-[13px]" />
      </div>
      <span className="sticker-chip shrink-0 bg-sheet-2" style={{ rotate: "2deg" }}>
        {say("ui.brief.next")}
      </span>
    </li>
  );
}

/** A chapter as its brief with every thing in and its close as the giver's words, for the stamped cards. */
function doneBrief(chapter: Id<"chapter">, view: Pick<PlayerView, "chapter">): Brief | null {
  const entry = content.chapter[chapter];
  if (entry === undefined) return null;
  return briefOf({ chapter: { current: chapter, items: entry.items.map((item) => ({ id: item.id, met: true })), done: view.chapter.done, closes: true, next: null } }, hasWords(`${chapter}.close`) ? words(`${chapter}.close`) : "");
}

/** A chapter not yet begun as its brief, nothing in yet, for the faint card at the foot. */
function laterBrief(chapter: string, view: Pick<PlayerView, "chapter">): Brief | null {
  const entry = content.chapter[chapter as Id<"chapter">];
  if (entry === undefined) return null;
  return briefOf({ chapter: { current: entry.id, items: entry.items.map((item) => ({ id: item.id, met: false })), done: view.chapter.done, closes: false, next: null } }, "");
}

/** The log's briefs from the view: the carried one, those done (the latest first, each base chapter once), and the next. */
export function briefLog(view: PlayerView): { carried: Brief | null; done: Brief[]; next: Brief | null } {
  const carried = view.chapter.current === null ? null : briefOf(view, words(openingKey(view)));
  const seen = new Set<string>(carried === null ? [] : [carried.base]);
  const done = [...view.chapter.done]
    .reverse()
    .filter((chapter) => {
      const base = baseOf(chapter);
      if (seen.has(base)) return false;
      seen.add(base);
      return true;
    })
    .flatMap((chapter) => doneBrief(chapter, view) ?? []);
  const after = carried === null ? null : (carried.next?.chapter ?? nextBase(carried.chapter));
  return { carried, done, next: after === null ? null : laterBrief(after, view) };
}

/** The log as the Japa app shows it under the ways out: nothing at all before any brief is handed. */
export function BriefLog() {
  const view = useView();
  const { carried, done, next } = briefLog(view);
  if (carried === null && done.length === 0) return null;
  return (
    <section data-brief-log-list aria-label={say("ui.brief.log")}>
      <h3 className="mt-5 mb-2 px-0.5 text-[15px] font-semibold text-text-2">{say("ui.brief.log")}</h3>
      <ul className="flex flex-col gap-2.5">
        {carried === null ? null : <Carried brief={carried} />}
        {done.map((brief) => (
          <Done key={brief.chapter} brief={brief} />
        ))}
        {next === null ? null : <Next brief={next} />}
      </ul>
    </section>
  );
}
