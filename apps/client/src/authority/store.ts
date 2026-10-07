// The game store: the current view, the month being planned, and the last
// thing the authority said. Screens read from here and send through here, so
// none of them ever holds a state, a seed or a version number of its own.
import { text } from "@japacity/content";
import type { Authority, Command, Id, PlayerView, RejectionCode, Reply, ReportLine, SlotPick } from "@japacity/sim";
import { createStore, type StoreApi } from "zustand/vanilla";

/** A command as a screen writes it: the store adds the version it is based on. */
export type PlayerCommand = Command extends infer C
  ? C extends { basedOn: number; type: infer T }
    ? T extends "turns/grant"
      ? never
      : Omit<C, "basedOn">
    : never
  : never;

export interface Shown {
  code: RejectionCode;
  /** The player's words for it, from content. */
  words: string;
}

/** What the store needs beyond the contract to start a life over. Local only. */
export interface LifeControls {
  newLife(scenario: Id<"scenario">): Promise<PlayerView>;
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
  /** One entry per free slot. Null is an empty slot, which rests. */
  plan: (SlotPick | null)[];
  /** True right after a month ends, so the report opens. */
  reportOpen: boolean;
  /** True when the player should pick who to be: a new life, or one that replaced a lost save. */
  choosingLife: boolean;
  /** Why a life was replaced, as a words key, when it was. */
  notice: string | null;

  refresh: () => Promise<void>;
  send: (command: PlayerCommand) => Promise<Reply | null>;
  endMonth: () => Promise<Reply | null>;
  setSlot: (index: number, pick: SlotPick | null) => void;
  /** Puts a pick in the first empty slot. False when every slot is full. */
  addToPlan: (pick: SlotPick) => boolean;
  sameAgain: () => void;
  clearPlan: () => void;
  dismissRejection: () => void;
  setReportOpen: (open: boolean) => void;
  chooseLife: (scenario: Id<"scenario">) => Promise<void>;
  /** Null when this authority cannot start a life over: the server will own that. */
  openLifeChooser: (() => void) | null;
  closeLifeChooser: () => void;
}

export type GameStore = StoreApi<GameState>;

export interface GameStoreOptions {
  life?: LifeControls;
  choosingLife?: boolean;
  notice?: string | null;
}

export function rejectionWords(code: RejectionCode): string {
  return text[`reject.${code}`] ?? code;
}

/** Keeps the picks that still fit, and pads with empty slots up to the count. */
function fitPlan(plan: readonly (SlotPick | null)[], slots: number): (SlotPick | null)[] {
  const kept = plan.slice(0, slots);
  while (kept.length < slots) kept.push(null);
  return kept;
}

export function createGameStore(authority: Authority, options: GameStoreOptions = {}): GameStore {
  return createStore<GameState>()((set, get) => {
    function take(view: PlayerView): void {
      set({ view, plan: fitPlan(get().plan, view.freeSlots) });
    }

    async function send(command: PlayerCommand): Promise<Reply | null> {
      const { view, busy } = get();
      if (view === null || busy) return null;
      set({ busy: true, rejection: null });
      try {
        const reply = await authority.send({ ...command, basedOn: view.v });
        if (reply.ok) {
          take(reply.view);
          set({ lines: reply.lines });
        } else {
          set({ rejection: { code: reply.code, words: rejectionWords(reply.code) } });
          // The state may have moved on (a stale command): show the latest.
          take(await authority.view());
        }
        return reply;
      } catch (error) {
        set({ failed: error instanceof Error ? error.message : String(error) });
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
      plan: [],
      reportOpen: false,
      choosingLife: options.choosingLife ?? false,
      notice: options.notice ?? null,

      async refresh() {
        try {
          take(await authority.view());
        } catch (error) {
          set({ failed: error instanceof Error ? error.message : String(error) });
        }
      },
      send,
      async endMonth() {
        const slots = get().plan.filter((pick): pick is SlotPick => pick !== null);
        const reply = await send({ type: "turn/end", slots });
        if (reply?.ok === true) set({ plan: fitPlan([], reply.view.freeSlots), reportOpen: true });
        return reply;
      },
      setSlot(index, pick) {
        const plan = [...get().plan];
        if (index < 0 || index >= plan.length) return;
        plan[index] = pick;
        set({ plan });
      },
      addToPlan(pick) {
        const plan = [...get().plan];
        const empty = plan.indexOf(null);
        if (empty === -1) return false;
        plan[empty] = pick;
        set({ plan });
        return true;
      },
      sameAgain() {
        const view = get().view;
        if (view === null) return;
        set({ plan: fitPlan(view.lastSlots, view.freeSlots) });
      },
      clearPlan() {
        set({ plan: fitPlan([], get().plan.length) });
      },
      dismissRejection() {
        set({ rejection: null });
      },
      setReportOpen(open) {
        set({ reportOpen: open });
      },
      async chooseLife(scenario) {
        if (options.life === undefined) return;
        const view = await options.life.newLife(scenario);
        set({ view, plan: fitPlan([], view.freeSlots), choosingLife: false, notice: null, lines: [], rejection: null });
      },
      openLifeChooser: options.life === undefined ? null : () => set({ choosingLife: true }),
      closeLifeChooser() {
        set({ choosingLife: false });
      },
    };
  });
}
