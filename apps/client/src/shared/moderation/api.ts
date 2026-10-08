// The moderation calls: block, unblock and report (the pair side's routes),
// the player's standing and appeal, and feedback. Null when the game runs
// without a server, where there is no one to block and no team to tell.
import { authorityMode } from "../../authority/mode";
import type { BlockReply, BlockRequest, CiteReportRequest, PairReportRequest, ReportReply, ServerRejection } from "../net/contract";
import { api, type Api } from "../net/http";

/** Read from apps/server/src/moderation/standing.ts (R-MODERATION-007, R-MODERATION-016): `GET /api/moderation/standing`. */
export interface Standing {
  actions: {
    entry: string;
    action: "warn" | "mute" | "suspend" | "ban";
    reason: string;
    at: number;
    until: number | null;
    appeal: { status: "open" | "decided"; outcome?: "upheld" | "overturned" } | null;
  }[];
  mutedUntil: number | null;
  suspendedUntil: number | null;
  banned: boolean;
  reports: { id: string; at: number; status: "open" | "decided"; outcome?: "acted" | "no-action" }[];
}

/** Read from apps/server/src/routes/feedback.ts: `POST /api/feedback` (R-MODERATION-020). */
export interface FeedbackRequest {
  text: string;
  build: string;
  screen: string;
  mode: "low" | "high";
}

export type ReportRequest = PairReportRequest | CiteReportRequest;

export type Done = { ok: true } | ServerRejection;

export interface ModerationApi {
  block: (target: BlockRequest) => Promise<BlockReply>;
  unblock: (target: BlockRequest) => Promise<BlockReply>;
  report: (report: ReportRequest) => Promise<ReportReply>;
  standing: () => Promise<{ ok: true; standing: Standing } | ServerRejection>;
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
    report: (report) => settle(server.post("/api/moderation/report", report)),
    standing: () => settle(server.get("/api/moderation/standing")),
    appeal: (entry) => settle(server.post("/api/moderation/appeal", { action: entry })),
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
 * R-MODERATION-020: the build number, set at build time from `VITE_BUILD`
 * (`VITE_BUILD=$(git rev-parse --short HEAD) pnpm build`); a dev build says so.
 */
export function buildNumber(): string {
  const build = import.meta.env.VITE_BUILD;
  return build === undefined || build === "" ? "dev" : build;
}
