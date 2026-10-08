// A stand-in for the moderation calls that keeps each call as text, for the
// tests of the block and report control and of the moderation menu.
import type { ModerationApi } from "../moderation/api";

export function fakeModeration(over: Partial<ModerationApi> = {}): ModerationApi & { calls: string[] } {
  const calls: string[] = [];
  const log =
    <T,>(name: string, answer: T) =>
    (...args: unknown[]) => {
      calls.push(`${name}(${args.map((arg) => JSON.stringify(arg)).join(",")})`);
      return Promise.resolve(answer);
    };
  return {
    calls,
    block: log("block", { ok: true } as const),
    unblock: log("unblock", { ok: true } as const),
    report: log("report", { ok: true, report: "report-1" } as const),
    appeal: log("appeal", { ok: true } as const),
    feedback: log("feedback", { ok: true } as const),
    standing: () => Promise.resolve({ ok: true, standing: { actions: [], mutedUntil: null, suspendedUntil: null, banned: false, reports: [] } }),
    ...over,
  };
}
