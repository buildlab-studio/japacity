// The Calendar app (docs/rules/world.md R-WORLD-002, R-WORLD-007, R-WORLD-018): the month
// on the phone, in order. The job held; the free time as up to three cards, each thing started carrying on until it is
// stopped (R-WORLD-007), an empty one resting (R-TURN-006); the chores done this month and what they saved; what is
// coming with its months away, each row opening where it is dealt with; the pages left; and its own Next month, which
// puts the phone away and turns the page. Handed to the phone by the shell, so the phone knows nothing of the month.
import { content } from "@japacity/content";
import type { PlayerView, SlotLock, SlotPick } from "@japacity/sim";
import { int } from "@japacity/sim";
import { Briefcase, Lock, X } from "lucide-react";
import { type ReactNode, use, useEffect, useRef, useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { slotsUsed } from "../../authority/store";
import { stretchedWords } from "../../shared/days/stretch";
import { PhoneNav } from "../../shared/phone/nav";
import { cue } from "../../shared/sound/cues";
import { Rejection } from "../../shared/ui/Rejection";
import type { Coming } from "../../shared/words/coming";
import { formatMoney } from "../../shared/words/format";
import { lockWords } from "../../shared/words/locks";
import { hasWords, nameOf, paramWords, say } from "../../shared/words/text";
import { countFacts } from "../../shared/world/MonthCount";
import { markTaught, wasTaught } from "../../shared/world/taught";
import { ComingList } from "./ComingList";
import { blockedBy } from "./TurnBar";
import { TurnClock } from "./TurnClock";
import { freeTimeWords, turnWords } from "./turn.words";

/** What the Calendar opens on: its coming section (the band's chip), or the month with the teach card (the band's Next month). */
export type CalendarOpening = "coming" | "teach" | null;

/** The Calendar's opening from the phone's `calendar:<opening>`, or null for the month as it is. */
export function calendarOpening(said: string | null): CalendarOpening {
  return said === "coming" || said === "teach" ? said : null;
}

const COOK = "activity.cook-at-home";
const WATER = "activity.fetch-water";
const DRUM = "activity.fill-drum";

function pickWords(pick: SlotPick): string {
  return pick.param === null ? nameOf(pick.activity) : `${nameOf(pick.activity)}: ${paramWords(pick.param)}`;
}

/** The jobs held, the month's first lines: the work is set before anything else. */
function jobRows(job: PlayerView["job"]): string[] {
  return [...(job.id === null ? [] : [turnWords("turn.month.working", { job: nameOf(job.id) })]), ...(job.side === null ? [] : [turnWords("turn.month.side", { job: nameOf(job.side) })])];
}

/**
 * R-HOME-010: one line when the room's year of rent is taken at this month's end and the naira
 * held, cash and bank, falls short of it. Null otherwise.
 */
export function rentShortWords(view: Pick<PlayerView, "home" | "pockets">): string | null {
  const rent = view.home.roomRent;
  if (rent === null || rent.dueIn > 0) return null;
  const held = view.pockets.NGN.cash + view.pockets.NGN.bank;
  if (held >= rent.year) return null;
  return turnWords("turn.month.rent-short", { amount: formatMoney(rent.year, "NGN"), held: formatMoney(held, "NGN") });
}

/**
 * The chores done this month and what they saved (R-OBLIGATION-014; d9741d1f's foot): cooking and the water answer now,
 * and their share is held on the upkeep for its next charge, so the line reads the relief the view carries. The drum
 * filled from the yard's tap saves nothing and says so plainly. Null when nothing was done.
 */
export function choresWords(view: Pick<PlayerView, "obligations" | "activities">): string | null {
  const done = (id: string): boolean => view.activities.some((option) => option.id === id && option.done === true);
  const upkeep = view.obligations.find((owed) => content.obligation[owed.entry]?.type === "upkeep" && (owed.relief ?? []).length > 0) ?? null;
  const reliefs = upkeep?.relief ?? [];
  const cooked = reliefs.some((relief) => relief.source === COOK);
  const water = reliefs.some((relief) => relief.source === WATER);
  if (upkeep !== null && (cooked || water)) {
    const share = reliefs.reduce((sum, relief) => sum + relief.bp, 0);
    const amount = Math.min(upkeep.due, int.bp(upkeep.due, Math.min(share, 10000)));
    const currency = content.obligation[upkeep.entry]?.currency ?? "NGN";
    return turnWords(`turn.calendar.chores.${cooked && water ? "both" : cooked ? "cook" : "water"}`, { amount: formatMoney(amount, currency) });
  }
  if (done(DRUM)) return turnWords("turn.calendar.chores.drum");
  if (done(COOK)) return turnWords("turn.calendar.chores.cooked");
  return null;
}

/** A held slot as a row of the month: "At the burial", or the lock's sentence where content has no row words. */
function lockRow(lock: SlotLock, month: number): string {
  return hasWords(`ui.locks.row.${lock.why}`) ? say(`ui.locks.row.${lock.why}`) : lockWords(lock, month);
}

/** The place a dated ask is answered at: the first place that stages it. */
function askPlace(entry: string): string | null {
  const place = Object.values(content.place).find((candidate) => (candidate.stages as readonly string[]).includes(entry));
  if (place === undefined) return null;
  const name = say(`${place.id}.name`);
  return turnWords("turn.calendar.at", { place: name });
}

function Section({ title, children, mark }: { title: string; children: ReactNode; mark: string }) {
  return (
    <section className="flex flex-col gap-1.5" data-calendar={mark}>
      <h3 className="label text-text-2">{title}</h3>
      {children}
    </section>
  );
}

export function Calendar({ opening = null }: { opening?: CalendarOpening }) {
  const view = useView();
  const plan = useGame((state) => state.plan);
  const busy = useGame((state) => state.busy);
  const stopPick = useGame((state) => state.stopPick);
  const clearPlan = useGame((state) => state.clearPlan);
  const endMonth = useGame((state) => state.endMonth);
  const untilNews = useGame((state) => state.untilNews);
  const nextTurnAt = useGame((state) => state.clock?.nextTurnAt);
  const nav = use(PhoneNav);
  // The teach card says once in a life what the month is, when Next month opened the Calendar in place of turning (R-WORLD-002).
  const [teach, setTeach] = useState(() => opening === "teach" && !wasTaught("calendar", view.scenario));
  const coming = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (opening === "coming") coming.current?.scrollIntoView?.({ block: "start" });
  }, [opening]);
  // An interview with a question still to answer holds the month as a set piece does (R-INTERVIEW-004).
  const blocked = blockedBy(view.ended, view.turns.banked, view.setpiece !== null || (view.interview?.question ?? null) !== null);
  const shut = busy || blocked !== null;
  const abroad = view.place.where === "abroad";
  const used = slotsUsed(plan);
  const stretched = stretchedWords(view, plan);
  const rentShort = rentShortWords(view);
  const chores = choresWords(view);
  const jobs = jobRows(view.job);
  const turn = (run: () => Promise<unknown>) => {
    cue("tap");
    // The page turns, and the phone goes away so it turns over the world (R-WORLD-027).
    void run();
    nav.close();
  };
  // A row of what is coming opens where it is dealt with: a paper or a wait in Japa, a due in Bills (R-WORLD-002).
  const openFor = (item: Coming): (() => void) | null => {
    switch (item.kind) {
      case "paper":
      case "visa":
      case "plan":
      case "age-limit":
        return () => nav.openApp("japa");
      case "rent":
        return () => nav.openApp("bills");
      case "offer":
      case "birthday":
        return null;
      default: {
        const never: never = item.kind;
        throw new Error(`Unknown coming kind ${String(never)}.`);
      }
    }
  };
  // A dated ask names the place it is answered at (R-WORLD-002).
  const noteOf = (item: Coming): string | null => (item.kind === "offer" && item.entry !== undefined ? askPlace(item.entry) : null);
  const endButton = (main: boolean) => (
    <button
      key="end"
      type="button"
      className={main ? "btn-main" : "chip press flex h-12 w-full items-center justify-between px-4 text-[15px] font-extrabold disabled:opacity-50"}
      disabled={shut}
      onClick={() => turn(endMonth)}
      data-month-end
      data-main={main}
    >
      <span>{turnWords("turn.month.end")}</span>
      <span className="truncate pl-2 text-[13px] font-semibold opacity-80">{freeTimeWords(used, view.freeSlots)}</span>
    </button>
  );
  const untilButton = (main: boolean) => (
    <button
      key="until"
      type="button"
      className={main ? "btn-main" : "chip press flex h-12 w-full items-center justify-between px-4 text-[15px] font-extrabold disabled:opacity-50"}
      disabled={shut}
      onClick={() => turn(untilNews)}
      data-month-until
      data-main={main}
    >
      <span className="shrink-0">{turnWords("ui.month.until-news")}</span>
      <span className="truncate pl-2 text-right text-[12px] leading-tight font-semibold opacity-80">{turnWords("ui.month.until-news-foot")}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-4" data-calendar-app data-phone-app="calendar">
      {teach ? (
        <div className="flex items-start gap-2 rounded-[6px] bg-sheet-2 p-3 shadow-[0_2px_0_var(--sheet-line)]" role="note" data-calendar-teach>
          <p className="min-w-0 flex-1 text-[14px] leading-snug">{turnWords("turn.calendar.teach")}</p>
          <button
            type="button"
            className="press flex size-8 shrink-0 items-center justify-center rounded-[4px] text-text-2"
            aria-label={turnWords("turn.calendar.teach.ok")}
            onClick={() => {
              markTaught("calendar", view.scenario);
              setTeach(false);
            }}
            data-calendar-teach-ok
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      ) : null}
      {jobs.length === 0 ? null : (
        <Section title={turnWords("turn.calendar.work")} mark="work">
          <ul className="flex flex-col gap-1.5" data-month-jobs>
            {jobs.map((row) => (
              <li key={row} className="flex min-h-11 items-center gap-2 rounded-[5px] bg-sheet-muted px-3 text-[15px] font-bold" data-slot="job">
                <Briefcase size={16} aria-hidden className="shrink-0 text-text-2" />
                <span className="min-w-0 flex-1 truncate">{row}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title={turnWords("turn.month.free")} mark="free">
        {view.locks.length === 0 ? null : (
          <ul className="flex flex-col gap-1.5" aria-label={say("ui.locks.title")} data-month-locks>
            {view.locks.map((lock, index) => (
              <li key={`${lock.why}-${String(index)}`} className="flex min-h-11 items-center gap-2 rounded-[5px] bg-sheet-muted px-3 text-[15px] font-bold" data-slot="lock" data-lock={lock.why}>
                <Lock size={16} aria-hidden className="shrink-0 text-text-2" />
                <span className="min-w-0 flex-1 truncate">{lockRow(lock, view.month)}</span>
              </li>
            ))}
          </ul>
        )}
        {view.freeSlots === 0 ? <p className="text-[14px] text-text-2">{turnWords("turn.month.no-slots")}</p> : null}
        {plan.length === 0 ? null : (
          <ol className="flex flex-col gap-1.5" aria-label={turnWords("turn.month.free")} data-month-plan>
            {plan.map((pick, index) =>
              pick === null ? (
                <li key={`free-${String(index)}`} className="flex min-h-11 items-center rounded-[5px] border-2 border-dashed border-sheet-line px-3 text-[14px] text-text-2" data-slot="free">
                  {say("ui.month.rest")}
                </li>
              ) : (
                <li key={`${pick.activity}-${String(index)}`} className="chip-in flex min-h-11 items-center gap-2 rounded-[5px] bg-sheet-muted py-1 pr-1 pl-3 text-[15px] font-bold" data-slot="planned">
                  <span className="min-w-0 flex-1 truncate">{pickWords(pick)}</span>
                  <span className="shrink-0 text-[12px] font-semibold text-text-2">{say("ui.world.thing.planned")}</span>
                  <button
                    type="button"
                    aria-label={say("ui.world.stop-act", { what: pickWords(pick) })}
                    onClick={() => {
                      cue("close");
                      stopPick(pick);
                    }}
                    className="press flex size-9 shrink-0 items-center justify-center rounded-[4px] text-text-2"
                    data-stop
                  >
                    <X size={18} aria-hidden />
                  </button>
                </li>
              ),
            )}
          </ol>
        )}
        {view.freeSlots > 0 && used >= view.freeSlots ? (
          <p className="text-[13px] font-semibold" data-free-full>
            {turnWords("turn.calendar.all-used")}
          </p>
        ) : null}
        {view.freeSlots > used ? <p className="text-[13px] text-text-2">{turnWords("turn.month.hint")}</p> : null}
        {used > 0 ? (
          <div>
            <button
              type="button"
              className="chip press inline-flex h-9 items-center gap-1.5 px-3 text-[13px] font-bold"
              onClick={() => {
                cue("close");
                clearPlan();
              }}
              data-clear-plan
            >
              {say("ui.month.clear")}
            </button>
          </div>
        ) : null}
      </Section>
      {chores === null ? null : (
        <Section title={turnWords("turn.calendar.done")} mark="chores">
          <p className="text-[14px] font-semibold" data-month-chores>
            {chores}
          </p>
        </Section>
      )}
      <div ref={coming} className="scroll-mt-2">
        <Section title={say("ui.world.coming-up")} mark="coming">
          <ComingList view={view} onPick={openFor} noteOf={noteOf} />
        </Section>
      </div>
      <Section title={turnWords("turn.calendar.pages")} mark="pages">
        <ul className="flex flex-col gap-1.5 text-[14px] leading-tight font-semibold" data-calendar-pages>
          {countFacts(view.turns.banked, view.turns.cap, nextTurnAt, Date.now()).map((fact) => (
            <li key={fact.id} className="flex items-center gap-2" data-count-fact={fact.id}>
              <fact.icon size={18} className="shrink-0 text-text-2" aria-hidden />
              <span>{fact.words}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Rejection />
      <div className="sticky -bottom-3 -mx-3 -mb-3 flex flex-col gap-1.5 bg-sheet px-3 pt-2 pb-3">
        {stretched === null ? null : (
          <p className="text-[13px] font-semibold text-text-2" data-month-stretched>
            {stretched}
          </p>
        )}
        {rentShort === null ? null : (
          <p className="text-[13px] font-semibold text-out" data-month-rent-short>
            {rentShort}
          </p>
        )}
        {/* R-WORLD-028: abroad the quiet months go by Until news, so it is the main button there and Next month the second. */}
        {abroad ? untilButton(true) : endButton(true)}
        {abroad ? endButton(false) : untilButton(false)}
        {blocked === null ? null : (
          <p className="text-[13px] text-text-2" data-month-blocked>
            {blocked}
          </p>
        )}
        {blocked !== null && view.turns.banked < 1 ? <TurnClock /> : null}
      </div>
    </div>
  );
}
