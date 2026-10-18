// The remote authority: the server holds the state and the seed, and this
// only carries commands there and views back (R-SERVER-001, R-ENGINE-015).
// It keeps the last view's version and the clock beside it, never a state, a
// seed or a world it was not sent, and predicts nothing (R-SERVER-019).
import type {
  ClockView,
  CommandRequest,
  NewCharacterReply,
  NewCharacterRequest,
  PresenceReply,
  PresetReply,
  PresetRequest,
  ServerRejection,
  ServerReply,
  ViewReply,
  WorldReply,
} from "@japacity/api";
import type { Command, Id, PlayerView, Reply, ReportLine } from "@japacity/sim";

import { api, reportedError, retryAfterMs, type Api, type Fetch } from "../shared/net/http";
import { pacer } from "../shared/net/pace";
import type { WallGuard } from "../shared/net/wall";

/** What the authority tells the store that the Authority type has no room for. */
export type AuthorityEvent =
  | { kind: "clock"; clock: ClockView }
  | { kind: "signed-out" }
  | { kind: "no-character" }
  | { kind: "rate-limited"; retryAfter: number }
  /** R-SERVER-003: the life replays to another hash on the server and waits for the rollback tool; the view is refused too. */
  | { kind: "diverged" }
  /** The authority's lines since the view the client held, from a fetched view (R-LOTTERY-013): an away winner's letter. */
  | { kind: "lines"; lines: ReportLine[] };

type AuthorityListener = (event: AuthorityEvent) => void;

export interface RemoteAuthorityOptions {
  baseUrl: string;
  fetch?: Fetch;
  /** Milliseconds since 1970 on the device. Only for holding off after `rate-limited`, never for the game's clock. */
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
  /** What a login wall sets off (R-ACCOUNT-006): the page's reload guard, or a test's. */
  wall?: WallGuard;
}

export interface RemoteAuthority {
  view(): Promise<PlayerView>;
  send(command: Command): Promise<Reply | ServerRejection>;
  /** `POST /api/prologue/preset` (R-SERVER-046): the prologue's preset played by the server in one request, on the version held. */
  preset(request: Omit<PresetRequest, "basedOn">): Promise<PresetReply>;
  /** `POST /api/character`: the account's one character (R-ACCOUNT-015). */
  newLife(scenario: Id<"scenario">): Promise<PlayerView>;
  /** `POST /api/character/end`: the account's character ended for good, so another may start (R-ACCOUNT-030). False when it was refused. */
  endLife(): Promise<boolean>;
  /** The version of the last view the server sent, or null before the first. */
  held(): number | null;
  /** The clock of the last reply, or null before the first (R-CLOCK-003). */
  clock(): ClockView | null;
  world(): Promise<WorldReply>;
  presence(place: string): Promise<PresenceReply>;
  listen(listener: AuthorityListener): () => void;
  readonly api: Api;
}

const realWait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export function remoteAuthority(options: RemoteAuthorityOptions): RemoteAuthority {
  const http = api({ baseUrl: options.baseUrl, ...(options.fetch === undefined ? {} : { fetch: options.fetch }), ...(options.wall === undefined ? {} : { wall: options.wall }) });
  const now = options.now ?? (() => Date.now());
  const wait = options.wait ?? realWait;
  const listeners = new Set<AuthorityListener>();
  /** R-SERVER-025: every request on the server's command limit leaves through this, at most eight in ten seconds. */
  const pace = pacer(now, wait);

  let version: number | null = null;
  let lastClock: ClockView | null = null;
  /** A view fetched after a `stale` rejection, handed to the next `view()` so the store's refetch costs no second request. */
  let fresh: PlayerView | null = null;
  let heldUntil = 0;

  const tell = (event: AuthorityEvent) => {
    for (const listener of listeners) listener(event);
  };

  function keep(reply: { view: PlayerView; clock: ClockView }): PlayerView {
    version = reply.view.v;
    lastClock = reply.clock;
    tell({ kind: "clock", clock: reply.clock });
    return reply.view;
  }

  /** Waits out a `retryAfter` the server gave earlier, so nothing is sent before it ends. */
  async function holdOff(): Promise<void> {
    const left = heldUntil - now();
    if (left > 0) await wait(left);
  }

  /** R-SERVER-025: tells the store how long to wait, then waits it. */
  async function limited(rejection: ServerRejection): Promise<void> {
    const ms = retryAfterMs(rejection);
    heldUntil = now() + ms;
    tell({ kind: "rate-limited", retryAfter: rejection.retryAfter ?? 1 });
    await wait(ms);
  }

  /** Tells the store about a refusal it must act on. True when it was told. */
  function report(rejection: ServerRejection): boolean {
    if (rejection.code === "signed-out" || rejection.code === "no-character") {
      tell({ kind: rejection.code });
      return true;
    }
    if (rejection.code === "rate-limited") {
      tell({ kind: "rate-limited", retryAfter: rejection.retryAfter ?? 1 });
      return true;
    }
    if (rejection.code === "diverged") {
      tell({ kind: "diverged" });
      return true;
    }
    return false;
  }

  function refuse(rejection: ServerRejection): never {
    if (report(rejection)) throw reportedError(rejection);
    throw new Error(rejection.detail);
  }

  /** The lines since the held version come with the view; none are asked for on the first fetch, so nothing old is told on load. */
  function viewPath(): string {
    return version === null ? "/api/view" : `/api/view?since=${String(version)}`;
  }

  function keepWithLines(reply: { view: PlayerView; lines: ReportLine[]; clock: ClockView }, asked: number | null): PlayerView {
    const view = keep(reply);
    const lines = asked === null ? [] : reply.lines;
    if (lines.length > 0) tell({ kind: "lines", lines });
    return view;
  }

  async function fetchView(): Promise<PlayerView> {
    await holdOff();
    const asked = version;
    const reply = await http.get<ViewReply>(viewPath());
    if (reply.ok) return keepWithLines(reply, asked);
    if (reply.code !== "rate-limited") refuse(reply);
    await limited(reply);
    const again = await http.get<ViewReply>(viewPath());
    return again.ok ? keepWithLines(again, asked) : refuse(again);
  }

  return {
    api: http,
    held: () => version,
    clock: () => lastClock,
    listen(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    view() {
      if (fresh !== null) {
        const view = fresh;
        fresh = null;
        return Promise.resolve(view);
      }
      return fetchView();
    },

    async send(command) {
      fresh = null;
      await holdOff();
      await pace.take();
      const basedOn = version ?? command.basedOn;
      const request: CommandRequest = { command: { ...command, basedOn }, basedOn };
      const reply = await http.post<ServerReply>("/api/command", request);
      if (reply.ok) return { ok: true, view: keep(reply), lines: reply.lines };
      if (reply.code === "stale") {
        // R-ENGINE-003: the state moved on. Fetch it once so the player can look again.
        fresh = await fetchView();
      } else if (reply.code === "rate-limited") {
        await limited(reply);
      } else {
        report(reply);
      }
      return reply;
    },

    async preset(request) {
      fresh = null;
      await holdOff();
      // R-SERVER-025: the whole preset is one request on the command limit.
      await pace.take();
      const body: PresetRequest = { ...request, basedOn: version ?? 0 };
      const reply = await http.post<PresetReply>("/api/prologue/preset", body);
      if (reply.ok) {
        keep(reply);
        return reply;
      }
      if (reply.code === "stale") fresh = await fetchView();
      else if (reply.code === "rate-limited") await limited(reply);
      else report(reply);
      return reply;
    },

    async newLife(scenario) {
      const request: NewCharacterRequest = { scenario };
      await pace.take();
      const reply = await http.post<NewCharacterReply>("/api/character", request);
      if (reply.ok) return keep(reply);
      // The account already has its one character: carry on with it.
      if (reply.code === "one-character") return fetchView();
      return refuse(reply);
    },

    async endLife() {
      await pace.take();
      const reply = await http.post<{ ok: true } | ServerRejection>("/api/character/end", {});
      // An account with no character has nothing left to end: the door is the answer either way.
      if (!reply.ok && reply.code !== "no-character") {
        if (reply.code === "signed-out") report(reply);
        return false;
      }
      version = null;
      lastClock = null;
      fresh = null;
      return true;
    },

    async world() {
      const reply = await http.get<WorldReply | ServerRejection>("/api/world");
      if ("ok" in reply) return refuse(reply);
      return reply;
    },

    async presence(place) {
      const reply = await http.get<PresenceReply | ServerRejection>(`/api/place/${encodeURIComponent(place)}`);
      if ("ok" in reply) return refuse(reply);
      return reply;
    },
  };
}
