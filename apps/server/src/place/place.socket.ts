// The plain parts of the place object: what a socket's attachment holds, the
// numbers the object runs on, and the only texts a socket carries. Nothing
// here needs the Workers runtime, so the router and the Node tests import it.
import type { Nudge, PresenceMember } from "@japacity/store";

import { productionConfig } from "../config";

/** What the place object reads from its bindings. */
export interface PlaceEnv {
  /** R-SERVER-027: the rate-limit binding for socket messages. */
  SOCKET_10S: RateLimit;
}

/** R-CLOCK-026, R-CLOCK-029: the limits the router sends with each socket, from the server's config. */
export interface SocketLimits {
  maxPerObject: number;
  attachmentBytes: number;
}

/** A member shows in the place; a listener only receives its account's nudges and is neither shown nor counted. */
export type Attachment =
  | { kind: "member"; socket: string; member: PresenceMember }
  | { kind: "listener"; socket: string; account: string };

/** What a room answers the router: its members, whether the asker is one, and a sample. */
export interface RoomLook {
  members: number;
  holds: boolean;
  sample: PresenceMember[];
}

export const ATTACHMENT_HEADER = "x-place-attachment";
export const LIMITS_HEADER = "x-place-limits";
/** R-CLOCK-024: the client's ping and the automatic reply. */
export const PING = "ping";
export const PONG = "pong";
/** RFC 6455: a normal close. */
export const CLOSE_NORMAL = 1000;
/** RFC 6455: policy violation. */
export const CLOSE_POLICY = 1008;
/** The object's refusal of a member when the room is full. */
export const STATUS_FULL = 503;
/** The refusal of an attachment over `attachmentBytes` (R-CLOCK-026). */
export const STATUS_TOO_LARGE = 413;

const ENCODER = new TextEncoder();

/**
 * R-CLOCK-028: the presence nudge's window. The object reads it from the
 * production config because a socket's close reaches the object with no
 * request to carry a test server's number.
 */
export const NUDGE_EVERY_MS = productionConfig.presence.nudgeEveryMs;

/** Reads the limits the router sent, or null for anything else. */
export function parseLimits(raw: string | null): SocketLimits | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const { maxPerObject, attachmentBytes } = value;
    if (typeof maxPerObject !== "number" || typeof attachmentBytes !== "number") return null;
    return { maxPerObject, attachmentBytes };
  } catch {
    return null;
  }
}

/** R-CLOCK-026: the size of an attachment as stored. */
export function attachmentBytes(attachment: Attachment): number {
  return ENCODER.encode(JSON.stringify(attachment)).length;
}

function isText(value: unknown): value is string {
  return typeof value === "string";
}

/** Reads an attachment the router sent, or null for anything else. */
export function parseAttachment(raw: string | null): Attachment | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const held = value as Record<string, unknown>;
  if (!isText(held.socket) || held.socket === "") return null;
  if (held.kind === "listener") return isText(held.account) ? { kind: "listener", socket: held.socket, account: held.account } : null;
  if (held.kind !== "member" || typeof held.member !== "object" || held.member === null) return null;
  const member = held.member as Record<string, unknown>;
  if (!isText(member.account) || !isText(member.name) || !isText(member.look) || !isText(member.place) || typeof member.joinedAt !== "number") return null;
  return {
    kind: "member",
    socket: held.socket,
    member: { account: member.account, name: member.name, look: member.look, place: member.place, joinedAt: member.joinedAt },
  };
}

function accountOf(attachment: Attachment): string {
  return attachment.kind === "member" ? attachment.member.account : attachment.account;
}

/** Tags let a nudge find an account's sockets, and a leave find one socket, without a list in memory. */
export function tagsFor(attachment: Attachment): string[] {
  return [attachment.kind, `account:${accountOf(attachment)}`, `socket:${attachment.socket}`];
}

/** R-CLOCK-020: the only text a socket ever carries from the server. */
export function nudgeText(nudge: Nudge): string {
  switch (nudge.nudge) {
    case "view":
      return JSON.stringify({ nudge: "view", v: nudge.v });
    case "messages":
      return JSON.stringify({ nudge: "messages" });
    case "presence":
      return JSON.stringify({ nudge: "presence" });
    default: {
      const never: never = nudge;
      return never;
    }
  }
}
