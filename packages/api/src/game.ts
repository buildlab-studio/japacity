// The game's routes: a command, the view, the world, the prologue's preset, a
// new character and the presence sample. Every route is under /api, answers
// JSON, and needs a signed-in session unless it says otherwise.
import type { Command, Id, PlayerView, PrologueSlice, Rejection, ReportLine, World } from "@japacity/sim";

import type { ClockView, ServerRejection } from "./reply";

/** R-SERVER-001: `POST /api/command`. The client sends the command and the version it saw, never a tick, a state or a world. */
export interface CommandRequest {
  command: Command;
  basedOn: number;
}

/** R-SERVER-046: `POST /api/prologue/preset`. The archetype's id, the age step and the home chosen at the door, and the version seen. */
export interface PresetRequest {
  archetype: string;
  age: number;
  home: string;
  basedOn: number;
}

/** R-SERVER-046, R-PROLOGUE-014: one step the preset played: its answer, the draw once made, and the outcome its draw gave. */
export interface PresetStep {
  step: string;
  answer: string;
  draw: PrologueSlice["draw"];
  outcome: string | null;
}

/**
 * R-SERVER-046: the view after the last step, its lines, the clock, the count stepped and the trail; `refusal` when an
 * answer was refused after some steps stood. Refused at the first step, nothing is written and the reply is the
 * rejection with the clock, as a command's.
 */
export type PresetReply = { ok: true; view: PlayerView; lines: ReportLine[]; clock: ClockView; stepped: number; trail: PresetStep[]; refusal?: Rejection } | (Rejection & { clock: ClockView }) | ServerRejection;

/** `GET /api/view`, with `?since=<version>` for the authority's lines after it: the view, the lines since the client's last fetch are not kept (R-SERVER-019), and the clock. */
export type ViewReply = { ok: true; view: PlayerView; lines: ReportLine[]; clock: ClockView } | ServerRejection;

/** R-CLOCK-018, R-CLOCK-019: `GET /api/world`, the same for everyone, kept in the server's cache by its tick until the next tick (R-SERVER-039). Needs no session. */
export interface WorldReply {
  tick: number;
  world: World;
  nextTickAt: number;
}

/** `POST /api/character`: a new character for the account (R-ACCOUNT-015, R-SERVER-016). */
export interface NewCharacterRequest {
  scenario: Id<"scenario">;
}

/** `POST /api/character` answers as `GET /api/view`. */
export type NewCharacterReply = ViewReply;

/** `GET /api/place/:place`: the presence sample (R-CLOCK-028) and some seen there today (R-CITY-036). The socket is upgraded from `GET /api/place/:place/socket` (R-CLOCK-020, R-CLOCK-027, R-CLOCK-030). */
export interface PresenceReply {
  place: string;
  others: { name: string; look: string }[];
  today: { name: string; look: string }[];
}
