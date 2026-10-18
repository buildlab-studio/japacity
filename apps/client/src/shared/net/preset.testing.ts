// The server's preset route as a test's faked server plays it (server:server-plays-prologue-preset): `prologue/choose` at each card
// with content's `presetAnswer`, through the real game, until the prologue closes, a card has no open answer, or an answer
// is refused. The real route is tested in apps/server; this holds a faked server to its reply.
import type { ClockView, PresetReply, PresetRequest, PresetStep } from "@japacity/api";
import { presetAnswer } from "@japacity/content";
import type { Command, ReportLine } from "@japacity/sim";
import type { Game } from "@japacity/sim/testing";

/** The most steps one request plays (apps/server/src/config.ts `limits.presetSteps`). */
const PRESET_STEPS = 20;

/** Plays `request` on `game` as the server's route does; `sent` collects every command stepped. */
export function playPresetOn(game: Game, request: PresetRequest, clock: ClockView, sent: Command[] = []): PresetReply {
  if (!game.state.prologue.open) return { ok: false, code: "not-legal", detail: "There is no prologue open.", clock };
  const trail: PresetStep[] = [];
  const lines: ReportLine[] = [];
  while (trail.length < PRESET_STEPS) {
    const card = game.view().prologue;
    if (card === null) break;
    const answer = presetAnswer(request.archetype, request.age, request.home, card.step, card.answers);
    if (answer === null) break;
    const command: Command = { type: "prologue/choose", step: card.step, answer, basedOn: game.state.v };
    sent.push(command);
    const result = game.send(command);
    if (!result.ok) return trail.length === 0 ? { ...result, clock } : { ok: true, view: game.view(), lines, clock, stepped: trail.length, trail, refusal: result };
    trail.push({ step: card.step, answer, draw: game.state.prologue.draw, outcome: game.state.prologue.lastOutcome });
    lines.push(...result.lines);
  }
  return { ok: true, view: game.view(), lines, clock, stepped: trail.length, trail };
}
