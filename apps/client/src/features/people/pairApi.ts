// The server's people routes, as the people screens reach them: the invite
// link, the pair record and its conversation; block and report go through the
// shared moderation control. Only online: the local authority has no second
// player, so offline the screens get null and hide what needs the server
// (R-PAIR-014 "wired to the server routes when online and hidden offline").
import type { Id } from "@japacity/sim";
import { createContext, createElement, use, useMemo, type ReactNode } from "react";

import { authorityMode } from "../../authority/mode";
import type { ConversationReply, InviteReply, PairReply, SayReply } from "../../shared/net/contract";
import { api, type Api, type Fetch } from "../../shared/net/http";

export interface PairApi {
  invite(slot: string): Promise<InviteReply>;
  /** The record as this side reads it: who the other side is, for telling rows apart (R-PAIR-006). */
  pair(pair: string): Promise<PairReply>;
  conversation(pair: string, after: string | null): Promise<ConversationReply>;
  say(pair: string, phrase: Id<"phrase">, fill: string | null): Promise<SayReply>;
  /** The address a friend opens to take a card, on this server. */
  inviteLink(code: string): string;
}

export function pairApi(server: Api, origin: string): PairApi {
  const at = (pair: string) => `/api/pair/${encodeURIComponent(pair)}`;
  return {
    invite: (slot) => server.post("/api/invite", { slot }),
    pair: (pair) => server.get(at(pair)),
    conversation: (pair, after) => server.get(`${at(pair)}/conversation${after === null ? "" : `?after=${encodeURIComponent(after)}`}`),
    say: (pair, phrase, fill) => server.post(`${at(pair)}/say`, fill === null ? { phrase } : { phrase, fill }),
    inviteLink: (code) => `${origin.replace(/\/+$/, "")}/invite/${encodeURIComponent(code)}`,
  };
}

/** Builds the online routes against a server, for tests that answer for it. */
export function pairApiFor(baseUrl: string, fetch?: Fetch): PairApi {
  return pairApi(fetch === undefined ? api({ baseUrl }) : api({ baseUrl, fetch }), globalThis.location?.origin ?? baseUrl);
}

/** Undefined: decide from the build. Null: offline. */
const PairApiContext = createContext<PairApi | null | undefined>(undefined);

/** Gives the screens below a set of routes, or null to play offline. Tests and the shell use it. */
export function PairApiProvider({ value, children }: { value: PairApi | null; children: ReactNode }) {
  return createElement(PairApiContext, { value }, children);
}

/** The server's people routes when the build plays online, else null. */
export function usePairApi(): PairApi | null {
  const given = use(PairApiContext);
  const built = useMemo(() => {
    if (given !== undefined) return null;
    const mode = authorityMode();
    return mode.authority === "remote" ? pairApiFor(mode.baseUrl) : null;
  }, [given]);
  return given === undefined ? built : given;
}
