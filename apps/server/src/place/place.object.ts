// The place object (clock:presence-held-in-memory, clock:attachments-rebuild-presence, clock:moving-switches-place-socket, clock:presence-is-a-sample and clock:busy-place-splits-rooms): one per room of a place, holding who
// is there in memory only, through hibernatable sockets. Its storage holds
// one thing, the day's seen list (city:players-shown-present-not-tracked).
// Sources, read on 8 Oct 2026:
// https://developers.cloudflare.com/durable-objects/api/state/ (acceptWebSocket, getWebSockets, tags, setWebSocketAutoResponse)
// https://developers.cloudflare.com/durable-objects/api/websockets/ (serializeAttachment, at most 16,384 bytes)
// https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/ (rebuild from attachments in the constructor)
// https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/ (memory is dropped on hibernation)
// https://developers.cloudflare.com/durable-objects/best-practices/websockets/ (pings do not end hibernation)
// https://developers.cloudflare.com/durable-objects/api/alarms/ (one alarm per object)
// https://developers.cloudflare.com/durable-objects/api/storage-api/ (get, put and delete survive eviction)
import { PING, PONG } from "@japacity/api";
import { DurableObject } from "cloudflare:workers";
import { memoryPresenceStore } from "@japacity/store";
import type { Nudge, PresenceMember, PresenceStore } from "@japacity/store";

import {
  ATTACHMENT_HEADER,
  attachmentBytes,
  CLOSE_NORMAL,
  CLOSE_POLICY,
  LIMITS_HEADER,
  NUDGE_EVERY_MS,
  nudgeText,
  parseAttachment,
  parseLimits,
  STATUS_FULL,
  STATUS_TOO_LARGE,
  tagsFor,
} from "./place.socket";
import type { PlaceEnv, RoomLook } from "./place.socket";
import { drawToday, forgetSeen, lagosDay, listOn, parseTodayList, recordSeen, TODAY_KEY } from "./place.today";
import type { TodayList } from "./place.today";

function send(socket: WebSocket, text: string): boolean {
  // Best effort (clock:nudges-are-best-effort): a socket that is closing must not stop the others.
  try {
    socket.send(text);
    return true;
  } catch {
    return false;
  }
}

function close(socket: WebSocket, code: number, reason: string): void {
  try {
    socket.close(code, reason);
  } catch {
    return;
  }
}

/**
 * Cloudflare requires a class for a Durable Object; the rules live in the
 * plain functions above and in the store it holds.
 */
export class Place extends DurableObject<PlaceEnv> {
  /** clock:attachments-rebuild-presence: rebuilt from the open sockets on every wake. */
  private readonly members: PresenceStore = memoryPresenceStore();
  private readonly held = new Map<string, PresenceMember>();

  constructor(ctx: DurableObjectState, env: PlaceEnv) {
    super(ctx, env);
    // clock:client-sends-only-pings: answered by the runtime without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
    void ctx.blockConcurrencyWhile(async () => {
      for (const socket of ctx.getWebSockets("member")) {
        const attachment = parseAttachment(JSON.stringify(socket.deserializeAttachment()));
        if (attachment?.kind === "member") await this.join(attachment.socket, attachment.member);
      }
    });
  }

  /** Upgrades the router's request to a hibernatable socket carrying its attachment. */
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return new Response("expected a socket", { status: 426 });
    const attachment = parseAttachment(request.headers.get(ATTACHMENT_HEADER));
    const limits = parseLimits(request.headers.get(LIMITS_HEADER));
    if (attachment === null || limits === null) return new Response("bad attachment", { status: 400 });
    if (attachmentBytes(attachment) > limits.attachmentBytes) return new Response("attachment too large", { status: STATUS_TOO_LARGE });
    if (attachment.kind === "member" && this.held.size >= limits.maxPerObject) return new Response("room full", { status: STATUS_FULL });

    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server, tagsFor(attachment));
    server.serializeAttachment(attachment);
    if (attachment.kind === "member") {
      await this.join(attachment.socket, attachment.member);
      await this.seen(attachment.member, limits.todayMax);
      await this.presenceChanged();
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  /** clock:busy-place-splits-rooms: how many members the room holds, for the router. */
  count(): number {
    return this.held.size;
  }

  /**
   * clock:presence-is-a-sample, city:players-shown-present-not-tracked: the room's answer to a presence fetch. Those seen
   * today fill only what the live sample leaves of `n`, and never anyone here now nor the asker, by `askerName`.
   */
  async look(place: string, asker: string | null, n: number, seed: number, now: number | null = null, askerName: string | null = null): Promise<RoomLook> {
    const here = [...this.held.values()];
    const holds = asker !== null && here.some((member) => member.account === asker);
    const sample = await this.members.sample(place, n, asker, seed);
    const today = now === null ? [] : drawToday(listOn(await this.stored(), lagosDay(now)), here, n - sample.length, seed, askerName);
    return { members: this.held.size, holds, sample, today };
  }

  /** clock:socket-only-nudges: sends the nudge to every socket of the account here, and says how many it reached. */
  nudge(account: string, nudge: Nudge): { reached: number; members: number } {
    const text = nudgeText(nudge);
    const reached = this.ctx.getWebSockets(`account:${account}`).filter((socket) => send(socket, text)).length;
    return { reached, members: this.held.size };
  }

  /** clock:moving-switches-place-socket: closes one socket from the server's side and drops it from the list at once. */
  async leave(socket: string): Promise<{ found: boolean; members: number }> {
    const found = this.ctx.getWebSockets(`socket:${socket}`);
    for (const each of found) close(each, CLOSE_NORMAL, "left");
    await this.drop(socket);
    return { found: found.length > 0, members: this.held.size };
  }

  /**
   * account:player-deletes-account, moderation:fixed-admin-actions: closes every socket of the account here from the server's
   * side, drops its members at once, and takes `name` off the day's list (city:players-shown-present-not-tracked). Answers how
   * many members the room held before, so the router walks on past a room the account alone was in.
   */
  async forget(account: string, name: string): Promise<{ members: number }> {
    const members = this.held.size;
    for (const socket of this.ctx.getWebSockets(`account:${account}`)) {
      const attachment = parseAttachment(JSON.stringify(socket.deserializeAttachment()));
      close(socket, CLOSE_NORMAL, "left");
      if (attachment !== null) await this.drop(attachment.socket);
    }
    const stored = await this.stored();
    const kept = forgetSeen(stored, name);
    if (kept !== stored && kept !== undefined) await this.ctx.storage.put(TODAY_KEY, kept);
    return { members };
  }

  override async webSocketMessage(socket: WebSocket): Promise<void> {
    // server:noisy-socket-closed: pings answered by the automatic reply never reach here, so only these are counted.
    const attachment = parseAttachment(JSON.stringify(socket.deserializeAttachment()));
    if (attachment === null) return;
    const { success } = await this.env.SOCKET_10S.limit({ key: `socket:${attachment.socket}` });
    if (success) return;
    close(socket, CLOSE_POLICY, "too many messages");
    await this.drop(attachment.socket);
  }

  override async webSocketClose(socket: WebSocket): Promise<void> {
    await this.dropSocket(socket);
  }

  override async webSocketError(socket: WebSocket): Promise<void> {
    await this.dropSocket(socket);
  }

  /** clock:presence-is-a-sample: one presence nudge to every member, at most once a window. city:players-shown-present-not-tracked: a past day's list goes. */
  override async alarm(): Promise<void> {
    const text = nudgeText({ nudge: "presence" });
    for (const socket of this.ctx.getWebSockets("member")) send(socket, text);
    const stored = await this.stored();
    if (stored !== undefined && stored.day !== lagosDay(Date.now())) await this.ctx.storage.delete(TODAY_KEY);
  }

  private async join(socket: string, member: PresenceMember): Promise<void> {
    this.held.set(socket, member);
    await this.members.join(member.place, socket, member);
  }

  /** city:players-shown-present-not-tracked: a socket that joins puts its member on the day of its joining, by name and look only. */
  private async seen(member: PresenceMember, todayMax: number): Promise<void> {
    const list = recordSeen(await this.stored(), lagosDay(member.joinedAt), member, todayMax);
    await this.ctx.storage.put(TODAY_KEY, list);
  }

  private async stored(): Promise<TodayList | undefined> {
    return parseTodayList(await this.ctx.storage.get(TODAY_KEY));
  }

  private async dropSocket(socket: WebSocket): Promise<void> {
    const attachment = parseAttachment(JSON.stringify(socket.deserializeAttachment()));
    if (attachment !== null) await this.drop(attachment.socket);
  }

  private async drop(socket: string): Promise<void> {
    const member = this.held.get(socket);
    if (member === undefined) return;
    this.held.delete(socket);
    await this.members.leave(member.place, socket);
    await this.presenceChanged();
  }

  /** clock:presence-is-a-sample: the first change in a window sets the alarm; the rest find it set. */
  private async presenceChanged(): Promise<void> {
    if ((await this.ctx.storage.getAlarm()) !== null) return;
    await this.ctx.storage.setAlarm(Date.now() + NUDGE_EVERY_MS);
  }
}
