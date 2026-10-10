// The game store: the current view, the month being planned, and the last
// thing the authority said. Screens read from here and send through here, so
// none of them ever holds a state, a seed or a version number of its own.
import { content, text } from "@japacity/content";
import type { Command, Id, PlayerView, Reply, ReportLine, SlotPick } from "@japacity/sim";
import { createStore, type StoreApi } from "zustand/vanilla";

import { earlyWinIn } from "../features/guides/earlyWin";
import { againSlots, creditMoved, RUN_MONTHS, stopsRun } from "../features/turn/untilNews";
import type { AccountApi } from "../shared/net/auth";
import type { ClockView, PresenceReply, ServerCode, ServerRejection, WorldReply } from "../shared/net/contract";
import { isReported } from "../shared/net/http";
import { isSaid, tidyLines } from "../shared/words/lines";
import { setNow } from "../shared/words/now";
import { sayCount } from "../shared/words/text";
import { uiText } from "../shared/words/ui";
import { forgetLife } from "./ended";
import type { AuthorityEvent } from "./remote";

/** A command as a screen writes it: the store adds the version it is based on. */
export type PlayerCommand = Command extends infer C
  ? C extends { basedOn: number; type: infer T }
    ? T extends "turns/grant"
      ? never
      : Omit<C, "basedOn">
    : never
  : never;

/**
 * What the store sends through: the local authority, or the remote one whose
 * replies may also carry the server's own refusals.
 */
export interface StoreAuthority {
  view(): Promise<PlayerView>;
  send(command: Command): Promise<Reply | ServerRejection>;
  /** The month's clock as this authority keeps it, for one that reports no clock through events (the local one): when the next month comes (R-WORLD-027). */
  clock?(): ClockView | null;
}

export interface Shown {
  code: ServerCode;
  /** The player's words for it, from content. */
  words: string;
  /** The authority's own sentence, which names the slot or the thing refused. */
  detail?: string;
}

/** What the store needs beyond the contract to start a life, and to end one. */
export interface LifeControls {
  newLife(scenario: Id<"scenario">): Promise<PlayerView>;
  /** R-ACCOUNT-030: ends the life for good; false when the authority refused. */
  endLife?(): Promise<boolean>;
}

export interface GameState {
  view: PlayerView | null;
  /** Set when the authority could not be reached at all. */
  failed: string | null;
  busy: boolean;
  /** The last rejection, until the player sends something else or dismisses it. */
  rejection: Shown | null;
  /** The lines of the last accepted command. */
  lines: ReportLine[];
  /** The lines of what was done mid-month (an ask paid, an offer taken), kept for the month's results (R-WORLD-008). */
  monthLines: ReportLine[];
  /** The month just ended's mid-month lines, shown with its report. */
  lastMonthLines: ReportLine[];
  /**
   * One entry per free slot, null for an empty one, which rests; then any pick that fills no slot
   * (a month-act whose `slot` is `none`, such as cooking at home, R-TURN-006), after the slots.
   */
  plan: (SlotPick | null)[];
  /** True right after a month ends, so the report opens. */
  reportOpen: boolean;
  /**
   * The staged wins of the last accepted command, one full-screen moment each,
   * shown before the month report (docs/rules/text.md, "Money on screen").
   */
  moments: ReportLine[];
  /** The share card the player has closed, by `cardKey`, so the scenes after it know it has had its turn. */
  cardClosed: string | null;
  /** True when the player should pick who to be: a new life, or one that replaced a lost save. */
  choosingLife: boolean;
  /** Why a life was replaced, as a words key, when it was. */
  notice: string | null;
  /** The server's clock from the last reply, or null for the local authority (R-CLOCK-003). Shown, never kept. */
  clock: ClockView | null;
  /** The world of the current tick, fetched on the schedule of R-CLOCK-019. */
  world: WorldReply | null;
  /** Who else is in the character's place, a sample (R-CLOCK-028). */
  presence: PresenceReply | null;
  /** Signing in, the age screen and deletion, or null for the local authority. */
  account: AccountApi | null;
  /** True when the server says no one is signed in: the account screens show instead of the game. */
  signedOut: boolean;
  /** Why the player is at the sign-in screen, as a words key, when there is a reason to say. */
  accountNotice: string | null;
  /**
   * True once a month's report has shown the early win (R-GUIDE-014), or a chapter or goal is done.
   * Every ask (a sign-in method, notifications, feedback, an invite, a share) waits for it (R-GUIDE-015).
   */
  earlyWin: boolean;
  /** Counts the `messages` nudges heard, so an open conversation fetches what is new (R-PAIR-011). */
  messageNudges: number;
  /**
   * The quiet months of the last Until news run, oldest first, each as all of its lines (the first with
   * what was done mid-month), and a last line when the credit file moved over it. The results tell each
   * as one line above the month that stopped the run (R-WORLD-028).
   */
  quiet: ReportLine[][];

  refresh: () => Promise<void>;
  send: (command: PlayerCommand) => Promise<Reply | ServerRejection | null>;
  endMonth: () => Promise<Reply | ServerRejection | null>;
  /**
   * Until news (R-WORLD-028): ends months in a row, each its own `turn/end` with last month's slots
   * (this month's plan first, when anything is planned), until something needs the player or six have passed.
   */
  untilNews: () => Promise<Reply | ServerRejection | null>;
  setSlot: (index: number, pick: SlotPick | null) => void;
  /** Puts a pick in the first empty slot, or after the slots when it fills none. False when every slot is full. */
  addToPlan: (pick: SlotPick) => boolean;
  sameAgain: () => void;
  clearPlan: () => void;
  dismissRejection: () => void;
  /** Moves on from the moment on screen to the next, or to the report. */
  nextMoment: () => void;
  setReportOpen: (open: boolean) => void;
  closeCard: (key: string) => void;
  chooseLife: (scenario: Id<"scenario">) => Promise<void>;
  /** Null when this authority cannot start a life over: the server will own that. */
  openLifeChooser: (() => void) | null;
  /**
   * R-ACCOUNT-030: "Start a new life". Ends this life for good through the authority, drops what the device kept of
   * it, and opens the front door. False when it did not end. Null where the authority cannot end a life.
   */
  endLife: (() => Promise<boolean>) | null;
  closeLifeChooser: () => void;
  /** What the remote authority reports beside its replies. */
  heard: (event: AuthorityEvent) => void;
  /** After a sign-in: back to the game. */
  signedIn: () => Promise<void>;
  /** After signing out or deleting the account: to the account screens with a reason to show. */
  leave: (notice: string | null) => void;
  /** The socket heard that the pair's conversation has a new row. */
  heardMessages: () => void;
}

export type GameStore = StoreApi<GameState>;

export interface GameStoreOptions {
  life?: LifeControls;
  /** False when a life may be started only once, as online (R-ACCOUNT-015). */
  lifeAgain?: boolean;
  choosingLife?: boolean;
  notice?: string | null;
  account?: AccountApi | null;
  /** True for the browser's own game: the month's plan and lines are kept across loads. */
  rememberMonth?: boolean;
  /** After a life has ended and the door is open (R-ACCOUNT-030): the browser's game loads afresh, so nothing held in memory outlives the life. */
  afterLifeEnded?: () => void;
}

const REST: Id<"activity"> = "activity.rest";

export function rejectionWords(code: ServerCode): string {
  const key = `reject.${code}`;
  return text[key] ?? uiText[key] ?? code;
}

const failure = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The lines that get a moment of their own, once each payment is told once; an offer's answer said in its own words is one. */
function bigLines(lines: readonly ReportLine[]): ReportLine[] {
  return tidyLines(lines).filter((line) => line.big === true || isSaid(line));
}

/** R-GUIDE-014: the view or the lines just shown hold the early win. */
function wonEarly(view: PlayerView, lines: readonly ReportLine[], slots: readonly SlotPick[] | null): boolean {
  return view.chapter.done.length > 0 || view.goals.done.length > 0 || earlyWinIn(lines, slots) !== null;
}

/** True when a pick fills one of the month's slots: an activity whose `slot` is `none` fills none (R-TURN-006). */
export function takesSlot(pick: SlotPick): boolean {
  return content.activity[pick.activity]?.slot !== "none";
}

/** The picks that fill slots, empty slots among them: the plan's first part. */
export function slotted(plan: readonly (SlotPick | null)[]): (SlotPick | null)[] {
  return plan.filter((pick) => pick === null || takesSlot(pick));
}

/** The picks planned that fill a slot, for "1 of 2 free slots planned". */
export function slotsUsed(plan: readonly (SlotPick | null)[]): number {
  return plan.filter((pick) => pick !== null && takesSlot(pick)).length;
}

/**
 * Keeps the picks that still fit, and pads with empty slots up to the count. A pick that fills no
 * slot is kept after the slots, whatever the count (R-TURN-006).
 */
function fitPlan(plan: readonly (SlotPick | null)[], slots: number): (SlotPick | null)[] {
  const kept = slotted(plan).slice(0, slots);
  while (kept.length < slots) kept.push(null);
  return [...kept, ...plan.filter((pick): pick is SlotPick => pick !== null && !takesSlot(pick))];
}

/** What the browser keeps of the month between loads: the plan, the lines so far, and the card closed. */
export const MONTH_KEY = "japacity.month";

interface MonthMemory {
  /** The view the memory belongs to: a reload lands on the same view, so the same number. */
  v: number;
  scenario: string;
  plan: (SlotPick | null)[];
  monthLines: ReportLine[];
  lastMonthLines: ReportLine[];
  cardClosed: string | null;
}

function readMonth(): MonthMemory | null {
  try {
    const raw = localStorage.getItem(MONTH_KEY);
    if (raw === null) return null;
    const held: unknown = JSON.parse(raw);
    if (typeof held !== "object" || held === null || typeof (held as MonthMemory).v !== "number" || !Array.isArray((held as MonthMemory).plan)) return null;
    return held as MonthMemory;
  } catch {
    return null;
  }
}

function writeMonth(memory: MonthMemory): void {
  try {
    localStorage.setItem(MONTH_KEY, JSON.stringify(memory));
  } catch {
    // Private windows and full stores: the month is kept in memory alone.
  }
}

/** Drops what the browser remembers of the month: a new life, or a test's own load. */
export function forgetMonth(): void {
  try {
    localStorage.removeItem(MONTH_KEY);
  } catch {
    // Nothing kept, nothing to drop.
  }
}

/** Puts the month the browser remembers back into the store, when it belongs to this very view. */
function rememberedMonth(view: PlayerView): Partial<GameState> {
  const memory = readMonth();
  if (memory === null || memory.v !== view.v || memory.scenario !== view.scenario) return {};
  return { plan: fitPlan(memory.plan, view.freeSlots), monthLines: memory.monthLines, lastMonthLines: memory.lastMonthLines, cardClosed: memory.cardClosed };
}

export function createGameStore(authority: StoreAuthority, options: GameStoreOptions = {}): GameStore {
  const store = makeStore(authority, options);
  // R-WORLD-007, R-WORLD-008: a reload keeps the month's plan and what was done in it.
  if (options.rememberMonth === true) store.subscribe((state, before) => {
    if (state.view === null) return;
    if (state.view.v === before.view?.v && state.plan === before.plan && state.monthLines === before.monthLines && state.lastMonthLines === before.lastMonthLines && state.cardClosed === before.cardClosed) return;
    writeMonth({ v: state.view.v, scenario: state.view.scenario, plan: state.plan, monthLines: state.monthLines, lastMonthLines: state.lastMonthLines, cardClosed: state.cardClosed });
  });
  // R-WORLD-002: the words tell a stamped month as months away from the view's month, kept beside them.
  store.subscribe((state, before) => {
    if (state.view !== before.view) setNow(state.view?.month ?? null);
  });
  return store;
}

function makeStore(authority: StoreAuthority, options: GameStoreOptions): GameStore {
  return createStore<GameState>()((set, get) => {
    /** The authority's own clock, when it keeps one and reports none through events. */
    function ownClock(): Partial<GameState> {
      const clock = authority.clock?.();
      return clock === undefined ? {} : { clock };
    }

    function take(view: PlayerView): void {
      // A fetch that set out before a command's reply can land after it: the older view is dropped.
      const held = get().view;
      if (held !== null && view.v < held.v) return;
      set({ view, plan: fitPlan(get().plan, view.freeSlots), earlyWin: get().earlyWin || wonEarly(view, view.report?.lines ?? [], null), ...(held === null && options.rememberMonth === true ? rememberedMonth(view) : {}), ...ownClock() });
    }

    async function send(command: PlayerCommand): Promise<Reply | ServerRejection | null> {
      const { view, busy } = get();
      if (view === null || busy) return null;
      set({ busy: true, rejection: null });
      try {
        const reply = await authority.send({ ...command, basedOn: view.v });
        if (reply.ok) {
          // One update: a month's report opens with the view it reports on, so nothing that
          // waits for the report (the share card, a scene) can open in between.
          const ended = command.type === "turn/end";
          const slots = command.type === "turn/end" ? command.slots : null;
          set({
            earlyWin: get().earlyWin || wonEarly(reply.view, reply.lines, slots),
            view: reply.view,
            plan: fitPlan(ended ? [] : get().plan, reply.view.freeSlots),
            lines: reply.lines,
            moments: bigLines(reply.lines),
            ...(ended ? { reportOpen: true, lastMonthLines: get().monthLines, monthLines: [], quiet: [] } : { monthLines: [...get().monthLines, ...reply.lines] }),
            ...ownClock(),
          });
        } else {
          set({ rejection: { code: reply.code, words: rejectionWords(reply.code), ...("detail" in reply && typeof reply.detail === "string" ? { detail: reply.detail } : {}) } });
          // The state may have moved on (a stale command): show the latest.
          if (!get().signedOut) take(await authority.view());
        }
        return reply;
      } catch (error) {
        if (!isReported(error)) set({ failed: failure(error) });
        return null;
      } finally {
        set({ busy: false });
      }
    }

    return {
      view: null,
      failed: null,
      busy: false,
      rejection: null,
      lines: [],
      monthLines: [],
      lastMonthLines: [],
      plan: [],
      reportOpen: false,
      moments: [],
      cardClosed: null,
      choosingLife: options.choosingLife ?? false,
      notice: options.notice ?? null,
      clock: null,
      world: null,
      presence: null,
      account: options.account ?? null,
      signedOut: false,
      accountNotice: null,
      earlyWin: false,
      messageNudges: 0,
      quiet: [],

      async refresh() {
        try {
          take(await authority.view());
        } catch (error) {
          if (!isReported(error)) set({ failed: failure(error) });
        }
      },
      send,
      async endMonth() {
        const slots = get().plan.filter((pick): pick is SlotPick => pick !== null);
        const reply = await send({ type: "turn/end", slots });
        if (reply?.ok === true) set({ plan: fitPlan([], reply.view.freeSlots), reportOpen: true });
        return reply;
      },
      async untilNews() {
        const first = get();
        if (first.view === null || first.busy) return null;
        set({ busy: true, rejection: null });
        const quiet: ReportLine[][] = [];
        const moments: ReportLine[] = [];
        let last: Reply | ServerRejection | null = null;
        let accepted = 0;
        try {
          for (let months = 1; months <= RUN_MONTHS; months += 1) {
            const view = get().view;
            if (view === null) break;
            const planned = get().plan.filter((pick): pick is SlotPick => pick !== null);
            const slots = months === 1 && planned.length > 0 ? planned : againSlots(view);
            const reply = await authority.send({ type: "turn/end", slots, basedOn: view.v });
            last = reply;
            if (!reply.ok) {
              set({ rejection: { code: reply.code, words: rejectionWords(reply.code), ...("detail" in reply && typeof reply.detail === "string" ? { detail: reply.detail } : {}) } });
              if (accepted === 0 && !get().signedOut) take(await authority.view());
              // A month already ended stands as the one that stopped the run: its full results show.
              quiet.pop();
              break;
            }
            accepted += 1;
            const credit = creditMoved(view, reply.view);
            const told = [...(months === 1 ? get().monthLines : []), ...reply.lines, ...(credit === null ? [] : [credit])];
            moments.push(...bigLines(reply.lines));
            // Each month lands in the store as it ends, so the month kept on the device follows the run.
            set({
              earlyWin: get().earlyWin || wonEarly(reply.view, reply.lines, slots),
              view: reply.view,
              plan: fitPlan([], reply.view.freeSlots),
              lines: reply.lines,
              lastMonthLines: months === 1 ? get().monthLines : [],
              monthLines: [],
            });
            if (stopsRun(reply.view, reply.lines, months).length > 0) break;
            quiet.push(told);
          }
        } catch (error) {
          if (!isReported(error)) set({ failed: failure(error) });
          quiet.pop();
        } finally {
          set({ busy: false, ...(accepted > 0 ? { quiet, moments, reportOpen: true } : {}) });
        }
        return last;
      },
      setSlot(index, pick) {
        const plan = [...get().plan];
        if (index < 0 || index >= plan.length) return;
        const slots = slotted(plan).length;
        plan[index] = pick;
        // A pick that fills no slot, taken out, leaves no empty slot behind.
        set({ plan: fitPlan(plan, slots) });
      },
      addToPlan(pick) {
        const plan = [...get().plan];
        if (!takesSlot(pick)) {
          // Planned once is enough: a pick that fills no slot does no more for being planned twice.
          if (!plan.some((held) => held !== null && held.activity === pick.activity && held.param === pick.param)) set({ plan: [...plan, pick] });
          return true;
        }
        const empty = plan.indexOf(null);
        if (empty === -1) return false;
        plan[empty] = pick;
        set({ plan });
        return true;
      },
      sameAgain() {
        const view = get().view;
        if (view === null) return;
        // A month left to rest sends no slots, so "same again" after it plans rest in every slot.
        const last = view.lastSlots.length === 0 && view.report !== null ? Array.from({ length: view.freeSlots }, () => ({ activity: REST, param: null })) : view.lastSlots;
        set({ plan: fitPlan(last, view.freeSlots) });
      },
      clearPlan() {
        set({ plan: fitPlan([], slotted(get().plan).length) });
      },
      dismissRejection() {
        set({ rejection: null });
      },
      nextMoment() {
        set({ moments: get().moments.slice(1) });
      },
      setReportOpen(open) {
        set({ reportOpen: open });
      },
      closeCard(key) {
        set({ cardClosed: key });
      },
      async chooseLife(scenario) {
        if (options.life === undefined) return;
        const view = await options.life.newLife(scenario);
        forgetMonth();
        set({ view, plan: fitPlan([], view.freeSlots), choosingLife: false, notice: null, lines: [], moments: [], rejection: null, monthLines: [], lastMonthLines: [], cardClosed: null, quiet: [] });
      },
      openLifeChooser: options.life === undefined || options.lifeAgain === false ? null : () => set({ choosingLife: true }),
      endLife:
        options.life?.endLife === undefined
          ? null
          : async () => {
              const life = options.life;
              if (life?.endLife === undefined || get().busy) return false;
              set({ busy: true, rejection: null });
              try {
                if (!(await life.endLife())) return false;
                forgetMonth();
                forgetLife();
                set({ view: null, choosingLife: true, notice: null, plan: [], lines: [], moments: [], monthLines: [], lastMonthLines: [], cardClosed: null, quiet: [], reportOpen: false, earlyWin: false, clock: null, world: null, presence: null });
                options.afterLifeEnded?.();
                return true;
              } catch (error) {
                if (!isReported(error)) set({ failed: failure(error) });
                return false;
              } finally {
                set({ busy: false });
              }
            },
      closeLifeChooser() {
        set({ choosingLife: false });
      },
      heard(event) {
        switch (event.kind) {
          case "clock":
            set({ clock: event.clock });
            return;
          case "signed-out":
            set({ signedOut: true, view: null, clock: null, busy: false });
            return;
          case "no-character":
            set({ choosingLife: true });
            return;
          case "rate-limited":
            set({ rejection: { code: "rate-limited", words: sayCount("ui.online.wait", event.retryAfter, { seconds: event.retryAfter }) } });
            return;
          case "lines":
            // The authority's own lines (a draw paid while away): staged as the command's are, never as a report.
            set({ moments: [...get().moments, ...bigLines(event.lines)], earlyWin: get().earlyWin || earlyWinIn(event.lines, null) !== null });
            return;
          default: {
            const never: never = event;
            throw new Error(`Unknown authority event: ${JSON.stringify(never)}`);
          }
        }
      },
      async signedIn() {
        set({ signedOut: false, accountNotice: null, failed: null });
        await get().refresh();
      },
      heardMessages() {
        set({ messageNudges: get().messageNudges + 1 });
      },
      leave(notice) {
        set({ signedOut: true, accountNotice: notice, view: null, clock: null, world: null, presence: null, rejection: null, lines: [], moments: [], quiet: [] });
      },
    };
  });
}
