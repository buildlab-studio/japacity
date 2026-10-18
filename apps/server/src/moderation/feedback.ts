// R-MODERATION-020: the feedback a player sends, kept with the build, the
// screen, the graphics mode, the day and the region and nothing else, and
// dropped after `config.feedback.keepDays`.
import type { ServerCode } from "@japacity/api";
import { int, time } from "@japacity/sim";
import type { FeedbackRow } from "@japacity/store";

import { sha256Hex } from "../auth/hooks";
import type { ServerDeps } from "../deps";
import { newId } from "./decide";

const LABEL = /^[\w.:-]{1,64}$/;

/** Code points, so an emoji counts as one character, not two. */
export function characters(text: string): number {
  return [...text].length;
}

export type Sent = { ok: true } | { ok: false; status: 400 | 429; code: ServerCode; detail: string; retryAfter?: number };

/**
 * R-MODERATION-020: one feedback from a signed-in session. The sender's key
 * is a hash of the account and the day, counted apart from the rows, so the
 * day's limit holds while no row names who sent it.
 */
export async function sendFeedback(deps: ServerDeps, account: string, region: string | null, body: unknown): Promise<Sent> {
  const sent = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const { text, build, screen, mode } = sent;
  const { maxChars, perDay } = deps.config.feedback;
  if (typeof text !== "string" || text.trim() === "") return { ok: false, status: 400, code: "not-legal", detail: "text is the feedback itself." };
  if (characters(text.trim()) > maxChars) return { ok: false, status: 400, code: "not-legal", detail: `text is at most ${String(maxChars)} characters.` };
  if (typeof build !== "string" || !LABEL.test(build)) return { ok: false, status: 400, code: "not-legal", detail: "build is the client's build number." };
  if (typeof screen !== "string" || !LABEL.test(screen)) return { ok: false, status: 400, code: "not-legal", detail: "screen names the screen it was sent from." };
  if (mode !== "low" && mode !== "high") return { ok: false, status: 400, code: "not-legal", detail: "mode is low or high." };

  const now = deps.now();
  const day = time.dayName(time.utcDay(now));
  const sender = await sha256Hex(`feedback:${day}:${account}`);
  if (!(await deps.stores.feedback.take(sender, day, perDay))) {
    const nextDay = (int.divFloor(now, time.DAY_MS) + 1) * time.DAY_MS;
    return { ok: false, status: 429, code: "rate-limited", detail: `At most ${String(perDay)} a day.`, retryAfter: int.divCeil(nextDay - now, time.SECOND_MS) };
  }
  const row: FeedbackRow = { id: newId(deps, "feedback"), text: text.trim(), build, screen, mode, day, region: region ?? "XX" };
  const stored = await deps.stores.feedback.add(row);
  if (!stored.ok) throw new Error(`Feedback was not stored: ${stored.detail}`);
  return { ok: true };
}

/** R-MODERATION-020: a row is kept for `keepDays` days counting its own, and goes on the day after. */
function keptFrom(deps: Pick<ServerDeps, "config" | "now">): string {
  return time.dayName(time.utcDay(deps.now()) - (deps.config.feedback.keepDays - 1));
}

/** The daily job: drops feedback past `keepDays` and every send count before today. Answers how many rows went. */
export async function dropOldFeedback(deps: Pick<ServerDeps, "config" | "now" | "stores">): Promise<number> {
  const dropped = await deps.stores.feedback.drop(keptFrom(deps));
  await deps.stores.feedback.forget(time.dayName(time.utcDay(deps.now())));
  return dropped;
}
