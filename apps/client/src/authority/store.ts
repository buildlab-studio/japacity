// The game store: the current view, the month being planned, and the last
// thing the authority said. Screens read from here and send through here, so
// none of them ever holds a state, a seed or a version number of its own.
import type { ClockView, PresenceReply, PresetReply, PresetRequest, PresetStep, ServerCode, ServerRejection, WorldReply } from "@japacity/api";
import { content, text } from "@japacity/content";
import type { Command, Envelope, Id, PlayerView, Reply, ReportLine, SlotPick, World } from "@japacity/sim";
import { createStore, type StoreApi } from "zustand/vanilla";

import { earlyWinIn } from "../features/guides/earlyWin";
import { momentLine } from "../shared/moment/moment";
import { carriedPlan } from "../features/turn/carried";
import type { AccountApi } from "../shared/net/auth";
import { failureOf, type FailureKind, isReloading, isReported } from "../shared/net/http";
import { plannable } from "../shared/words/acts";
import { isSaid, tidyLines } from "../shared/words/lines";
import { cardKey } from "../shared/ui/cardKey";
import { setNow } from "../shared/words/now";
import { say, sayCount } from "../shared/words/text";
import { uiText } from "../shared/words/ui";
import { forgetArranged } from "../shared/world/arranged";
import { forgetTaught } from "../shared/world/taught";
import { forgetLife } from "./ended";
import { swapsFor } from "./others";
import { playerName } from "./person";
import type { AuthorityEvent } from "./remote";

/** A number of the world at this tick as the store holds it: the fetched world's online, the local authority's offline; 0 before either is known. */
export function worldVar(state: Pick<GameState, "world" | "vars">, id: string): number {
  return state.world?.world.vars[id as keyof World["vars"]] ?? state.vars?.[id] ?? 0;
}

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
  /** R-SERVER-046: the prologue's preset played in one request, for an authority that plays it (the remote one). */
  preset?(request: Omit<PresetRequest, "basedOn">): Promise<PresetReply>;
  /** The month's clock as this authority keeps it, for one that reports no clock through events (the local one): when the next month comes (R-WORLD-027). */
  clock?(): ClockView | null;
  /** The world's numbers at this tick, for one whose world is not fetched (the local one): the season the meetings read (R-WORLD-020). */
  vars?(): Readonly<Record<string, number>>;
  /** R-CLOCK-032: the envelopes whose morning has come, each given once, for one that keeps them (the local one). */
  morning?(): Envelope[];
  /** The real time the life began, for one that keeps it (the local one): the band names the month of the year by it (R-WORLD-002). */
  beganAt?(): number;
}

export interface Shown {
  code: ServerCode;
  /** The player's words for it, from content. */
  words: string;
  /** The authority's own sentence, which names the slot or the thing refused. */
  detail?: string;
}

/** What the store needs beyond the contract to start a life, and to end one. */
interface LifeControls {
  newLife(scenario: Id<"scenario">): Promise<PlayerView>;
  /** R-ACCOUNT-030: ends the life for good; false when the authority refused. */
  endLife?(): Promise<boolean>;
}

/**
 * R-ENGINE-015: a request that brought no answer the game can read, by its kind, and what it was for: the view, a
 * command (kept, and sent again on Retry), or the life Begin starts. Shown as a card over the screen.
 */
export interface Trouble {
  kind: FailureKind;
  during: "view" | "command" | "life";
}

/** R-ENGINE-015: a failed view refresh tries again by itself after each of these pauses, then the card shows. */
export const VIEW_RETRY_MS: readonly number[] = [1_000, 3_000];

export interface GameState {
  view: PlayerView | null;
  /** Why the game could not go on, in the player's words, for a failure that is no request's (a fault in the game itself). */
  failed: string | null;
  /** R-ENGINE-015: the request that failed, until Retry brings its answer. */
  trouble: Trouble | null;
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
   * R-CLOCK-032: the results whose morning has come, given once by the authority, kept until the lock screen has told
   * them. Their lines join `monthLines` as they come, so each is told once with the month's.
   */
  opened: Envelope[];
  /**
   * One entry per free slot, null for an empty one, which rests (R-TURN-006). Only month-acts are planned: a now-act is
   * done at once and rest is what an empty slot does. The plan carries on across the month's end (R-WORLD-007).
   */
  plan: (SlotPick | null)[];
  /** True right after a month ends, so the report opens. */
  reportOpen: boolean;
  /**
   * The staged wins of the last accepted command, one full-screen moment each,
   * shown before the month report (docs/rules/text.md, "Money on screen").
   */
  moments: ReportLine[];
  /**
   * The screenshot moments still to show (docs/rules/moments.md R-MOMENT-001, 006): at most one card for each batch of
   * lines, each with the view it came with, so its figure is read from the life as it stood.
   */
  momentCards: MomentShot[];
  /** How many moment card screens are up. */
  momentScreens: number;
  /** The share card the player has closed, by `cardKey`, so the scenes after it know it has had its turn. */
  cardClosed: string | null;
  /** The chapter's share card a moment card told instead, by `cardKey` (R-MOMENT-006): kept in the gallery, never opened. */
  cardTold: string | null;
  /** True when the player should pick who to be: a new life, or one that replaced a lost save. */
  choosingLife: boolean;
  /** Why a life was replaced, as a words key, when it was. */
  notice: string | null;
  /** The server's clock from the last reply, or null for the local authority (R-CLOCK-003). Shown, never kept. */
  clock: ClockView | null;
  /** The world of the current tick, fetched on the schedule of R-CLOCK-019. */
  world: WorldReply | null;
  /** The local authority's world numbers at its tick, or null online, where `world` carries them. */
  vars: Readonly<Record<string, number>> | null;
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
   * The real time the life began (R-WORLD-002): month 0 of the life is that month of the year, so the band names the month.
   * Read from the authority as the life loads or starts; an authority that keeps none (online, until the account carries
   * it) leaves the time the game loaded.
   */
  beganAt: number;

  refresh: () => Promise<void>;
  /** R-CLOCK-032: the lock screen has told the opened results; they are let go. */
  morningShown: () => void;
  /** R-ENGINE-015: sends again what failed (the view, the command kept, or the life); its first caller gets the answer. */
  retry: () => Promise<void>;
  send: (command: PlayerCommand) => Promise<Reply | ServerRejection | null>;
  /**
   * R-SERVER-046, R-PROLOGUE-010: the prologue's preset sent as one request, its reply applied as a command's; `keep` is
   * handed the trail before the view lands, so the page reads it as it opens. Null where the authority plays no preset
   * (offline, where each answer goes as a command).
   */
  preset: ((request: Omit<PresetRequest, "basedOn">, keep?: (trail: PresetStep[]) => void) => Promise<PresetReply | null>) | null;
  /**
   * Ends the month with the commitments that carry on (R-WORLD-007), and the results open in the room. `rest`: the bed's
   * Sleep, the month's time left rested (R-TURN-010). The command does not carry it yet: the contract's `turn/end` has
   * no `rest` field, and the simulation gates nothing on the time spent (decision 0011), so the plain command is sent;
   * the bed's Sleep passes it already so the flag reaches the wire once the contract takes it.
   */
  endMonth: (rest?: true) => Promise<Reply | ServerRejection | null>;
  setSlot: (index: number, pick: SlotPick | null) => void;
  /** Puts a month-act in the first empty slot. False when every slot is full, or the pick is not one to plan. */
  addToPlan: (pick: SlotPick) => boolean;
  /** Stops a commitment: every pick of the activity (with this param, when given) leaves the plan (R-WORLD-007). */
  stopPick: (pick: SlotPick) => void;
  clearPlan: () => void;
  dismissRejection: () => void;
  /**
   * R-SERVER-003: the Retry of a `diverged` sheet. Fetches the view again and clears the sheet when it comes; while the
   * life still needs checking the sheet stays. Nothing for any other rejection.
   */
  recheck: () => Promise<void>;
  /** Moves on from the moment on screen to the next, or to the report. */
  nextMoment: () => void;
  /** Dismisses the moment card on screen (R-MOMENT-006). */
  nextMomentCard: () => void;
  /** A moment card screen stands up; the function it returns takes it down. */
  momentScreen: () => () => void;
  setReportOpen: (open: boolean) => void;
  closeCard: (key: string) => void;
  chooseLife: (scenario: Id<"scenario">) => Promise<void>;
  /** Null when this authority cannot start a life over from the chooser, as online, where the server holds the life. */
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
  /** Waits before a failed view is asked for again (R-ENGINE-015). A test's own clock; the browser's otherwise. */
  wait?: (ms: number) => Promise<void>;
}

export function rejectionWords(code: ServerCode): string {
  const key = `reject.${code}`;
  return text[key] ?? uiText[key] ?? code;
}

/** R-ENGINE-015: the failure in the player's words, by its kind, never the browser's own text; a fault that is no request's is said as ours. */
export function failureWords(error: unknown): string {
  return say(`ui.failed.why.${failureOf(error) ?? "server"}`);
}

const realWait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** A screenshot moment waiting its turn: its line, the view the line came with, and the one before it (R-MOMENT-002). */
export interface MomentShot {
  line: ReportLine;
  view: PlayerView;
  before: PlayerView | null;
  /** The month's lines up to and with the batch's own, where a figure told before it was paid (the deposit a pitch took). */
  told?: ReportLine[];
}

/**
 * The cards so far, with this batch's moment card after them, if the batch has one (R-MOMENT-001). `earlier`: the
 * month's lines told before the batch.
 */
function withMoment(cards: readonly MomentShot[], lines: readonly ReportLine[], view: PlayerView | null, before: PlayerView | null, earlier: readonly ReportLine[] = []): MomentShot[] {
  const line = view === null ? null : momentLine(lines, view, earlier);
  return line === null || view === null ? [...cards] : [...cards, { line, view, before, told: [...earlier, ...lines] }];
}

const CHAPTER_CLOSED = "line.chapter.closed";

/**
 * R-MOMENT-006: a chapter's close is told once. When a moment card was queued for a
 * chapter closing and the view's share card is that chapter's, the share card is put aside as closed: the results line
 * and the moment card tell it, and the card goes to the gallery (`CardView`) without opening.
 */
function chapterTold(before: readonly MomentShot[], after: readonly MomentShot[], view: PlayerView): Partial<GameState> {
  const told = after.length > before.length && after.slice(before.length).some((shot) => shot.line.key === CHAPTER_CLOSED);
  const key = view.card?.kind === "chapter" ? cardKey(view.card) : null;
  return told && key !== null ? { cardClosed: key, cardTold: key } : {};
}

/** The lines that get a moment of their own, once each payment is told once; an offer's answer said in its own words is one. */
function bigLines(lines: readonly ReportLine[]): ReportLine[] {
  return tidyLines(lines).filter((line) => line.big === true || isSaid(line));
}

/** R-GUIDE-014: the view or the lines just shown hold the early win. */
function wonEarly(view: PlayerView, lines: readonly ReportLine[], slots: readonly SlotPick[] | null): boolean {
  return view.chapter.done.length > 0 || view.goals.done.length > 0 || earlyWinIn(lines, slots) !== null;
}

/** True when a pick fills one of the month's slots: an activity whose `slot` is `none` fills none (R-TURN-006). */
function takesSlot(pick: SlotPick): boolean {
  return content.activity[pick.activity]?.slot !== "none";
}

/**
 * True when the pick is already in the plan, a commitment that carries on (R-WORLD-007): its chip reads "Ongoing" with
 * a stop, and its card's button is shut, since planning it again would only take more of the free time.
 */
export function plannedShut(plan: readonly (SlotPick | null)[], pick: SlotPick): boolean {
  if (content.activity[pick.activity] === undefined) return false;
  return plan.some((held) => held !== null && held.activity === pick.activity && (held.param ?? "") === (pick.param ?? ""));
}

/** The picks that fill slots, empty slots among them: the plan's first part. */
function slotted(plan: readonly (SlotPick | null)[]): (SlotPick | null)[] {
  return plan.filter((pick) => pick === null || takesSlot(pick));
}

/**
 * Keeps the month-acts that still fit, and pads with empty slots up to the count. A now-act or rest kept from before
 * is dropped: neither is ever planned (R-TURN-006, R-ACTIVITY-015).
 */
function fitPlan(plan: readonly (SlotPick | null)[], slots: number): (SlotPick | null)[] {
  const kept = plan.filter((pick) => pick === null || plannable(pick.activity)).slice(0, slots);
  while (kept.length < slots) kept.push(null);
  return kept;
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
  /** The results opened and not yet told on the lock screen (R-CLOCK-032): the authority gives each once. */
  opened?: Envelope[];
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

/** False in private windows and full stores: the month is kept in memory alone. */
function writeMonth(memory: MonthMemory): boolean {
  try {
    localStorage.setItem(MONTH_KEY, JSON.stringify(memory));
    return true;
  } catch {
    return false;
  }
}

/** Drops what the browser remembers of the month: a new life, or a test's own load. */
function forgetMonth(): boolean {
  try {
    localStorage.removeItem(MONTH_KEY);
    return true;
  } catch {
    // Nothing kept, nothing to drop.
    return false;
  }
}

/** Puts the month the browser remembers back into the store, when it belongs to this very view. */
function rememberedMonth(view: PlayerView): Partial<GameState> {
  const memory = readMonth();
  if (memory === null || memory.v !== view.v || memory.scenario !== view.scenario) return {};
  return { plan: fitPlan(memory.plan, view.freeSlots), monthLines: memory.monthLines, lastMonthLines: memory.lastMonthLines, cardClosed: memory.cardClosed, opened: memory.opened ?? [] };
}

export function createGameStore(authority: StoreAuthority, options: GameStoreOptions = {}): GameStore {
  const store = makeStore(authority, options);
  // R-WORLD-007, R-WORLD-008: a reload keeps the month's plan and what was done in it.
  if (options.rememberMonth === true) store.subscribe((state, before) => {
    if (state.view === null) return;
    if (state.view.v === before.view?.v && state.plan === before.plan && state.monthLines === before.monthLines && state.lastMonthLines === before.lastMonthLines && state.cardClosed === before.cardClosed && state.opened === before.opened) return;
    writeMonth({ v: state.view.v, scenario: state.view.scenario, plan: state.plan, monthLines: state.monthLines, lastMonthLines: state.lastMonthLines, cardClosed: state.cardClosed, opened: state.opened });
  });
  // R-WORLD-002: the words tell a stamped month as months away from the view's month, kept beside them; and
  // R-PROLOGUE-002: a line's `{hometown}` names where this life is from.
  store.subscribe((state, before) => {
    if (state.view !== before.view) setNow(state.view?.month ?? null, state.view?.hometown ?? null, swapsFor(playerName(state.view)));
  });
  return store;
}

function makeStore(authority: StoreAuthority, options: GameStoreOptions): GameStore {
  const wait = options.wait ?? realWait;
  return createStore<GameState>()((set, get) => {
    /** What Retry runs: the request that failed, sent again, its answer handed to whoever waited on the first. */
    let again: (() => Promise<void>) | null = null;
    /** The refresh under way, so a focus, a page shown again and a nudge at once cost one request. */
    let refreshing: Promise<boolean> | null = null;

    /**
     * R-ENGINE-015: shows the card for a failed request and keeps it to send again. The promise settles with the
     * answer Retry brings, so whoever sent the first (a sheet, Begin) waits on with the player's choice intact. A failed
     * view never takes the place of a command or a life waiting to be sent again. A wall the page is already reloading
     * for (R-ACCOUNT-006) shows nothing and settles never: the page is going, and the login comes next.
     */
    function held<T>(kind: FailureKind, during: Trouble["during"], retry: () => Promise<T>, error?: unknown): Promise<T> {
      if (isReloading(error)) return new Promise<T>(() => undefined);
      const showing = get().trouble;
      if (during === "view" && showing !== null && showing.during !== "view") return Promise.resolve(undefined as T);
      return new Promise<T>((resolve, reject) => {
        again = async () => {
          set({ trouble: null });
          try {
            resolve(await retry());
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        };
        set({ trouble: { kind, during }, busy: false });
      });
    }

    /** A failure that is no request's: the game's own fault, said as ours, the screen replaced. */
    function broke(error: unknown): void {
      if (!isReported(error)) set({ failed: failureWords(error) });
    }

    /** When the life began, from an authority that keeps it: read once as the life loads, and again when one starts. */
    function began(): Partial<GameState> {
      const at = authority.beganAt?.();
      return at === undefined ? {} : { beganAt: at };
    }

    /** The authority's own clock, when it keeps one and reports none through events. */
    function ownClock(): Partial<GameState> {
      const clock = authority.clock?.();
      const vars = authority.vars?.();
      return { ...(clock === undefined ? {} : { clock }), ...(vars === undefined ? {} : { vars }) };
    }

    function take(view: PlayerView): void {
      // A fetch that set out before a command's reply can land after it: the older view is dropped.
      const held = get().view;
      if (held !== null && view.v < held.v) return;
      set({ view, plan: fitPlan(get().plan, view.freeSlots), earlyWin: get().earlyWin || wonEarly(view, view.report?.lines ?? [], null), ...(held === null && options.rememberMonth === true ? rememberedMonth(view) : {}), ...(held === null ? began() : {}), ...ownClock() });
    }

    /**
     * `basedOn` is the version the command was first sent on: a retry sends it on the same, so a command that landed
     * before its answer was lost comes back stale rather than being played twice.
     */
    async function send(command: PlayerCommand, basedOn?: number): Promise<Reply | ServerRejection | null> {
      const { view, busy } = get();
      if (view === null || busy) return null;
      const retried = basedOn !== undefined;
      const based = basedOn ?? view.v;
      set({ busy: true, rejection: null });
      try {
        const reply = await authority.send({ ...command, basedOn: based });
        if (reply.ok) {
          // One update: a month's report opens with the view it reports on, so nothing that
          // waits for the report (the share card, a scene) can open in between.
          const ended = command.type === "turn/end";
          const slots = command.type === "turn/end" ? command.slots : null;
          const cards = withMoment(get().momentCards, reply.lines, get().momentScreens > 0 ? reply.view : null, view, get().monthLines);
          set({
            earlyWin: get().earlyWin || wonEarly(reply.view, reply.lines, slots),
            view: reply.view,
            // R-WORLD-007: the commitments carry on into the next month.
            plan: fitPlan(ended ? carriedPlan(get().plan, reply.view) : get().plan, reply.view.freeSlots),
            lines: reply.lines,
            moments: bigLines(reply.lines),
            momentCards: cards,
            ...chapterTold(get().momentCards, cards, reply.view),
            ...(ended ? { reportOpen: true, lastMonthLines: get().monthLines, monthLines: [] } : { monthLines: [...get().monthLines, ...reply.lines] }),
            ...ownClock(),
          });
        } else {
          // A retried command that comes back stale most likely landed the first time: the latest view says so, and nothing is refused.
          if (!(retried && reply.code === "stale")) set({ rejection: { code: reply.code, words: rejectionWords(reply.code), ...("detail" in reply && typeof reply.detail === "string" ? { detail: reply.detail } : {}) } });
          // The state may have moved on (a stale command): show the latest.
          if (!get().signedOut) await viewAfter();
        }
        return reply;
      } catch (error) {
        const kind = failureOf(error);
        if (kind !== null) return held(kind, "command", () => send(command, based), error);
        broke(error);
        return null;
      } finally {
        // The month turns only when the life sleeps (R-WORLD-025; decision 0011): a spent month falls to night, never to a turn.
        set({ busy: false });
      }
    }

    /** R-SERVER-046: the preset in one request; a retry after a lost answer that comes back stale most likely landed, and refuses nothing. */
    async function playPreset(request: Omit<PresetRequest, "basedOn">, keep?: (trail: PresetStep[]) => void, retried = false): Promise<PresetReply | null> {
      const { view, busy } = get();
      if (authority.preset === undefined || view === null || busy) return null;
      set({ busy: true, rejection: null });
      try {
        const reply = await authority.preset(request);
        if (reply.ok) {
          keep?.(reply.trail);
          const cards = withMoment(get().momentCards, reply.lines, get().momentScreens > 0 ? reply.view : null, view, get().monthLines);
          const refused = reply.refusal;
          set({
            earlyWin: get().earlyWin || wonEarly(reply.view, reply.lines, null),
            view: reply.view,
            plan: fitPlan(get().plan, reply.view.freeSlots),
            lines: reply.lines,
            moments: bigLines(reply.lines),
            momentCards: cards,
            ...chapterTold(get().momentCards, cards, reply.view),
            monthLines: [...get().monthLines, ...reply.lines],
            // The steps before a refused answer stand; the refusal shows as a command's would, and its card with it.
            ...(refused === undefined ? {} : { rejection: { code: refused.code, words: rejectionWords(refused.code), detail: refused.detail } }),
            ...ownClock(),
          });
        } else {
          if (!(retried && reply.code === "stale")) set({ rejection: { code: reply.code, words: rejectionWords(reply.code), detail: reply.detail } });
          if (!get().signedOut) await viewAfter();
        }
        return reply;
      } catch (error) {
        const kind = failureOf(error);
        if (kind !== null) return held(kind, "command", () => playPreset(request, keep, true), error);
        broke(error);
        return null;
      } finally {
        set({ busy: false });
      }
    }

    /**
     * R-CLOCK-032: the results whose morning has come, from an authority that keeps them (the remote one keeps none).
     * Kept until the lock screen tells them; their lines join the month's, so each is told once.
     */
    function takeMorning(): void {
      if (!("morning" in authority) || typeof authority.morning !== "function" || get().view === null) return;
      const opened = authority.morning();
      if (opened.length === 0) return;
      // The lock screen tells the result as the office's notice; the month's report and News tell its line once, as any line (R-CLOCK-032).
      set({ opened: [...get().opened, ...opened] });
    }

    /**
     * R-ENGINE-015: the view, asked for again twice with a pause before the card; a fault that is no request's replaces
     * the screen. True when a view came.
     */
    async function fetchView(): Promise<boolean> {
      for (let attempt = 0; ; attempt += 1) {
        try {
          take(await authority.view());
          takeMorning();
          if (get().trouble?.during === "view") {
            again = null;
            set({ trouble: null });
          }
          return true;
        } catch (error) {
          const kind = failureOf(error);
          if (kind === null) {
            broke(error);
            return false;
          }
          const pause = VIEW_RETRY_MS[attempt];
          if (pause === undefined || isReloading(error)) {
            void held(kind, "view", refresh, error);
            return false;
          }
          await wait(pause);
        }
      }
    }

    /** One fetch of the view at a time; a second caller waits on the first. True when a view came. */
    function fetched(): Promise<boolean> {
      refreshing ??= fetchView().finally(() => {
        refreshing = null;
      });
      return refreshing;
    }

    function refresh(): Promise<void> {
      return fetched().then(() => undefined);
    }

    /** A view asked for after a refusal: one that set out before it may be older, so a new one follows it. True when it came. */
    async function viewAfter(): Promise<boolean> {
      if (refreshing !== null) await refreshing;
      return fetched();
    }

    return {
      view: null,
      failed: null,
      trouble: null,
      busy: false,
      rejection: null,
      lines: [],
      monthLines: [],
      lastMonthLines: [],
      opened: [],
      plan: [],
      reportOpen: false,
      moments: [],
      momentCards: [],
      momentScreens: 0,
      cardClosed: null,
      cardTold: null,
      choosingLife: options.choosingLife ?? false,
      notice: options.notice ?? null,
      clock: null,
      world: null,
      vars: null,
      presence: null,
      account: options.account ?? null,
      signedOut: false,
      accountNotice: null,
      earlyWin: false,
      messageNudges: 0,
      beganAt: Date.now(),

      refresh,
      morningShown() {
        if (get().opened.length > 0) set({ opened: [] });
      },
      async retry() {
        const run = again;
        again = null;
        if (run === null) set({ trouble: null });
        else await run();
      },
      send: (command) => send(command),
      preset: authority.preset === undefined ? null : (request, keep) => playPreset(request, keep),
      // `rest` waits for the contract (see the type above): the plain command is sent until `turn/end` carries it.
      async endMonth() {
        const slots = get().plan.filter((pick): pick is SlotPick => pick !== null);
        const reply = await send({ type: "turn/end", slots });
        if (reply?.ok === true) set({ reportOpen: true });
        return reply;
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
        if (!plannable(pick.activity)) return false;
        const empty = plan.indexOf(null);
        if (empty === -1) return false;
        plan[empty] = pick;
        set({ plan });
        return true;
      },
      stopPick(pick) {
        const plan = get().plan.map((held) => (held !== null && held.activity === pick.activity && (pick.param === null || held.param === pick.param) ? null : held));
        set({ plan: fitPlan(plan, slotted(plan).length) });
      },
      clearPlan() {
        set({ plan: fitPlan([], slotted(get().plan).length) });
      },
      dismissRejection() {
        set({ rejection: null });
      },
      async recheck() {
        if (get().rejection?.code !== "diverged") return;
        const came = await viewAfter();
        if (came && get().rejection?.code === "diverged") set({ rejection: null });
      },
      nextMoment() {
        set({ moments: get().moments.slice(1) });
      },
      nextMomentCard() {
        set({ momentCards: get().momentCards.slice(1) });
      },
      momentScreen() {
        set({ momentScreens: get().momentScreens + 1 });
        return () => set({ momentScreens: get().momentScreens - 1, ...(get().momentScreens === 1 ? { momentCards: [] } : {}) });
      },
      setReportOpen(open) {
        set({ reportOpen: open });
      },
      closeCard(key) {
        set({ cardClosed: key });
      },
      async chooseLife(scenario) {
        if (options.life === undefined) return;
        let view: PlayerView;
        try {
          view = await options.life.newLife(scenario);
        } catch (error) {
          // R-ENGINE-015: Begin is one request; until it is answered the door keeps the run and Retry sends it again.
          const kind = failureOf(error);
          if (kind === null) throw error;
          return held(kind, "life", () => get().chooseLife(scenario), error);
        }
        forgetMonth();
        // A new life is taught afresh: its first chapter's title, its places' labels, its home (R-CHAPTER-011).
        forgetTaught();
        // A new life's rooms stand as their files set them.
        forgetArranged();
        set({ view, plan: fitPlan([], view.freeSlots), choosingLife: false, notice: null, lines: [], moments: [], momentCards: [], rejection: null, monthLines: [], lastMonthLines: [], opened: [], cardClosed: null, cardTold: null, ...began() });
      },
      openLifeChooser: options.life === undefined || options.lifeAgain === false ? null : () => set({ choosingLife: true }),
      endLife:
        options.life?.endLife === undefined
          ? null
          : async () => {
              const life = options.life;
              if (life?.endLife === undefined || get().busy) return false;
              set({ busy: true, rejection: null });
              let ended: boolean;
              try {
                ended = await life.endLife();
              } catch (error) {
                const kind = failureOf(error);
                set({ busy: false });
                if (kind !== null) return held(kind, "command", async () => (await get().endLife?.()) ?? false, error);
                broke(error);
                return false;
              }
              try {
                if (!ended) return false;
                forgetMonth();
                forgetLife();
                set({ view: null, choosingLife: true, notice: null, plan: [], lines: [], moments: [], momentCards: [], monthLines: [], lastMonthLines: [], opened: [], cardClosed: null, cardTold: null, reportOpen: false, earlyWin: false, clock: null, world: null, presence: null });
                options.afterLifeEnded?.();
                return true;
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
          case "diverged":
            // R-SERVER-003: its own words and a Retry, never the line for a failure of the server's.
            set({ rejection: { code: "diverged", words: rejectionWords("diverged") } });
            return;
          case "lines":
            // The authority's own lines (a draw paid while away): staged as the command's are, never as a report.
            set({ moments: [...get().moments, ...bigLines(event.lines)], momentCards: withMoment(get().momentCards, event.lines, get().momentScreens > 0 ? get().view : null, null), earlyWin: get().earlyWin || earlyWinIn(event.lines, null) !== null });
            return;
          default: {
            const never: never = event;
            throw new Error(`Unknown authority event: ${JSON.stringify(never)}`);
          }
        }
      },
      async signedIn() {
        set({ signedOut: false, accountNotice: null, failed: null, trouble: null });
        await get().refresh();
      },
      heardMessages() {
        set({ messageNudges: get().messageNudges + 1 });
      },
      leave(notice) {
        set({ signedOut: true, accountNotice: notice, view: null, clock: null, world: null, presence: null, rejection: null, lines: [], moments: [], momentCards: [] });
      },
    };
  });
}
