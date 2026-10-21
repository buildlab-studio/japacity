// The game's routes: a command, the view, the world, the prologue's preset, a
// new character and the presence sample. Every route is under /api, answers
// JSON, and needs a signed-in session unless it says otherwise.
import type { Command, Id, PlayerView, PrologueSlice, Rejection, ReportLine, World } from "@japacity/sim";
import type { KeptPerson } from "@japacity/store";

import type { ClockView, ServerRejection } from "./reply";

/** server:commands-only-through-route: `POST /api/command`. The client sends the command and the version it saw, never a tick, a state or a world. */
export interface CommandRequest {
  command: Command;
  basedOn: number;
}

/** server:server-plays-prologue-preset: `POST /api/prologue/preset`. The archetype's id, the age step and the home chosen at the door, and the version seen. */
export interface PresetRequest {
  archetype: string;
  age: number;
  home: string;
  basedOn: number;
}

/** server:server-plays-prologue-preset, prologue:printed-page-hands-over: one step the preset played: its answer, the draw once made, and the outcome its draw gave. */
export interface PresetStep {
  step: string;
  answer: string;
  draw: PrologueSlice["draw"];
  outcome: string | null;
}

/**
 * server:server-plays-prologue-preset: the view after the last step, its lines, the clock, the count stepped and the trail; `refusal` when an
 * answer was refused after some steps stood. Refused at the first step, nothing is written and the reply is the
 * rejection with the clock, as a command's.
 */
export type PresetReply = { ok: true; view: PlayerView; lines: ReportLine[]; clock: ClockView; stepped: number; trail: PresetStep[]; refusal?: Rejection } | (Rejection & { clock: ClockView }) | ServerRejection;

/**
 * account:person-kept-with-character: the person built at the door as it travels with `POST /api/character` and back with the
 * view: its first name, its look, the archetype it started as and its colours, never the page's photo, at most 1 KB as JSON
 * (content's `readKeptPerson`). The stored row's own declaration (decision 0027).
 */
export type KeptPersonWire = KeptPerson;

/**
 * `GET /api/view`, with `?since=<version>` for the authority's lines after it: the view, the lines since the client's last fetch are not kept (server:client-never-predicts), and the clock.
 * `person` is the one kept with the character (account:person-kept-with-character), left out when the life was made without one.
 */
export type ViewReply = { ok: true; view: PlayerView; lines: ReportLine[]; clock: ClockView; person?: KeptPersonWire | null } | ServerRejection;

/** clock:client-gets-current-world-only, clock:world-fetch-is-jittered: `GET /api/world`, the same for everyone, kept in the server's cache by its tick until the next tick (server:public-replies-cached). Needs no session. */
export interface WorldReply {
  tick: number;
  world: World;
  nextTickAt: number;
}

/** `POST /api/character`: a new character for the account (account:one-character-per-account, server:hidden-values-made-once). */
export interface NewCharacterRequest {
  scenario: Id<"scenario">;
  /** account:person-kept-with-character: the person built at the door, kept with the character. */
  person?: KeptPersonWire;
}

/** `POST /api/character` answers as `GET /api/view`. */
export type NewCharacterReply = ViewReply;

/** `GET /api/place/:place`: the presence sample (clock:presence-is-a-sample) and some seen there today (city:players-shown-present-not-tracked). The socket is upgraded from `GET /api/place/:place/socket` (clock:socket-only-nudges, clock:moving-switches-place-socket, clock:presence-is-not-contact). */
export interface PresenceReply {
  place: string;
  others: { name: string; look: string }[];
  today: { name: string; look: string }[];
}
