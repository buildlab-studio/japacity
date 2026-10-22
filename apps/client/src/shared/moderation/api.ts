// The moderation calls: block, unblock, the blocked list and report (the pair side's routes),
// the player's standing and appeal, and feedback. Null when the game runs
// without a server, where there is no one to block and no team to tell.
import type { AppealRequest, BlockedListReply, BlockReply, BlockRequest, CiteReportRequest, FeedbackRequest, PairReportRequest, ReportReply, ServerRejection, StandingReply, UnblockRequest } from "@japacity/api";

import { authorityMode } from "../net/authorityMode";
import { api, type Api } from "../net/http";

export type ReportRequest = PairReportRequest | CiteReportRequest;

type Done = { ok: true } | ServerRejection;

export interface ModerationApi {
  block: (target: BlockRequest) => Promise<BlockReply>;
  unblock: (target: UnblockRequest) => Promise<BlockReply>;
  /** moderation:blocked-list-in-settings: every account the player blocked, newest first. */
  blocked: () => Promise<BlockedListReply>;
  report: (report: ReportRequest) => Promise<ReportReply>;
  standing: () => Promise<StandingReply>;
  appeal: (entry: string) => Promise<Done>;
  feedback: (feedback: FeedbackRequest) => Promise<Done>;
}

/** A failed fetch is a refusal like any other, so a screen shows one message for both. */
async function settle<T>(call: Promise<T>): Promise<T | ServerRejection> {
  try {
    return await call;
  } catch {
    return { ok: false, code: "not-legal", detail: "The server could not be reached." };
  }
}

export function moderationApi(server: Api): ModerationApi {
  return {
    block: (target) => settle(server.post("/api/moderation/block", target)),
    unblock: (target) => settle(server.post("/api/moderation/unblock", target)),
    blocked: () => settle(server.get("/api/moderation/blocked")),
    report: (report) => settle(server.post("/api/moderation/report", report)),
    standing: () => settle(server.get("/api/moderation/standing")),
    appeal: (entry) => settle(server.post("/api/moderation/appeal", { action: entry } satisfies AppealRequest)),
    feedback: (feedback) => settle(server.post("/api/feedback", feedback)),
  };
}

let made: ModerationApi | null | undefined;

/** The build's own: the server's when the build names one, else none. */
export function buildModerationApi(): ModerationApi | null {
  if (made === undefined) {
    const mode = authorityMode();
    made = mode.authority === "remote" ? moderationApi(api({ baseUrl: mode.baseUrl })) : null;
  }
  return made;
}

/**
 * moderation:feedback-box-in-settings: the build number, set at build time from `VITE_BUILD`
 * (`VITE_BUILD=$(git rev-parse --short HEAD) pnpm build`); a dev build says so.
 */
export function buildNumber(): string {
  const build = import.meta.env.VITE_BUILD;
  return build === undefined || build === "" ? "dev" : build;
}
