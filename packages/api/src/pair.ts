// People: invite links, pairs and conversations (pair.md; person.md). Every
// refusal is a ServerRejection: the pair routes' codes are all in ServerCode.
import type { ConversationRow, Id, InviteCard, PairView } from "@japacity/sim";

import type { ServerRejection } from "./reply";

/** The body of `POST /api/invite`: the slot the card offers. */
export interface InviteRequest {
  slot: string;
}

/** `POST /api/invite`: the link made for a card. */
export interface InviteMade {
  ok: true;
  code: string;
  slot: string;
  expires: number;
  card: InviteCard;
}

/** `GET /api/invite/:code`: what the link shows, before sign-up. */
export interface InviteShown {
  ok: true;
  slot: string;
  looking: "partner" | "sibling";
  expires: number;
  card: InviteCard;
}

/** `POST /api/invite/:code/accept`: the pair made, as the friend sees it. */
export interface InviteAccepted {
  ok: true;
  pair: string;
  character: string;
  view: PairView | null;
}

/** The body of `POST /api/invite/:code/accept`: the slot the card offers, and the scenario when the friend needs a new character. */
export interface AcceptRequest {
  slot: string;
  scenario?: Id<"scenario">;
}

export type InviteReply = InviteMade | ServerRejection;
export type InviteShownReply = InviteShown | ServerRejection;
export type AcceptReply = InviteAccepted | ServerRejection;

/** `GET /api/pair/:pair`. */
export interface PairRead {
  ok: true;
  pair: PairView;
}

/** `POST /api/pair/:pair/say`. */
export interface Said {
  ok: true;
  message: ConversationRow;
}

/** `GET /api/pair/:pair/conversation?after=`. */
export interface ConversationRead {
  ok: true;
  pair: string;
  messages: ConversationRow[];
}

/** The body of `POST /api/pair/:pair/say`: the phrase and its fill-in, when it has one. */
export interface SayRequest {
  phrase: Id<"phrase">;
  fill?: string;
}

export type PairReply = PairRead | ServerRejection;
/** A refused phrase names only the check that failed, as its code (pair:phrase-checks-before-send). */
export type SayReply = Said | ServerRejection;
export type ConversationReply = ConversationRead | ServerRejection;
