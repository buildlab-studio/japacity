// The admin page's calls, one per admin route the server has. Every call
// settles: a refusal, a page the server does not have and a fetch that never
// arrived all come back as one shape the page shows as it is.
import type {
  AccountReply,
  AdminRefusal,
  AlarmsReply,
  CampaignReply,
  CampaignsReply,
  CheckName,
  ChecksReply,
  CloseReportBody,
  CreativeReply,
  DashboardReply,
  DecideAppealBody,
  DecidedReply,
  DialChange,
  FeedbackReply,
  LedgerReportReply,
  LightDecidedReply,
  LogReply,
  PendingLightsReply,
  QueueReply,
  RecheckReply,
  RejectionsReply,
  ReviewBody,
  RollbackCheck,
  StatsReply,
  SwitchesReply,
  SwitchLogReply,
  SwitchName,
} from "@japacity/api";

import { authorityMode } from "../../shared/net/authorityMode";
import { api, type Api } from "../../shared/net/http";
import { passkeyStepUp, type StepUp } from "./stepUp";

export type Outcome = "approve" | "refuse";

/**
 * moderation:admin-view-for-admin-list: where the account stands at /admin. `admin`: the page opens. `needs-passkey`: listed, and
 * the session has not shown a passkey recently. `add-passkey`: the same, with no passkey held. `not-admin`: anyone else, or no answer.
 */
export type AdminStanding = "admin" | "needs-passkey" | "add-passkey" | "not-admin";

export interface AdminApi {
  /** From `GET /api/account`. */
  standing: () => Promise<AdminStanding>;
  /** moderation:admin-view-for-admin-list: the passkey shown from this browser, which steps the session up. */
  stepUp: () => Promise<StepUp>;
  report: (day: number | null) => Promise<LedgerReportReply>;
  alarms: () => Promise<AlarmsReply>;
  /** admin:checks-have-three-states: every check with its state, value, what it found and its history. */
  checks: () => Promise<ChecksReply>;
  /** admin:check-handled-with-reason: the check is OK from now, with the reason in its history. */
  handleCheck: (check: CheckName, reason: string) => Promise<ChecksReply>;
  rejections: () => Promise<RejectionsReply>;
  rollback: (character: string) => Promise<RollbackCheck | AdminRefusal>;
  queue: () => Promise<QueueReply>;
  closeReport: (item: string, body: CloseReportBody) => Promise<DecidedReply>;
  decideAppeal: (item: string, body: DecideAppealBody) => Promise<DecidedReply>;
  log: (filter: { item?: string; account?: string }) => Promise<LogReply>;
  feedback: () => Promise<FeedbackReply>;
  /** moderation:dedication-lights-await-approval: the dedication lights whose names await a look, oldest first. */
  pendingLights: () => Promise<PendingLightsReply>;
  /** moderation:dedication-lights-await-approval: a light's name approved for everyone, or the light refused and put out. */
  decideLight: (account: string, outcome: Outcome) => Promise<LightDecidedReply>;
  analytics: (day: string | null) => Promise<DashboardReply>;
  /** analytics:admin-stats-for-admins-only: the numbers, live. */
  stats: () => Promise<StatsReply>;
  switches: () => Promise<SwitchesReply>;
  switchLog: () => Promise<SwitchLogReply>;
  setSwitch: (name: SwitchName, on: boolean, reason: string) => Promise<SwitchesReply>;
  setDial: (change: DialChange, reason: string) => Promise<SwitchesReply>;
  campaigns: () => Promise<CampaignsReply>;
  decideCampaign: (campaign: string, outcome: Outcome, body: ReviewBody) => Promise<CampaignReply>;
  decideCreative: (creative: string, version: number, outcome: Outcome, body: ReviewBody) => Promise<CreativeReply>;
  pull: (campaign: string) => Promise<CampaignReply>;
  recheck: (campaign: string) => Promise<RecheckReply>;
  /** advert:changes-return-to-review: where an admin sees any version's image, whatever its status. */
  imageUrl: (creative: string, version: number) => string;
}

async function settle<T>(call: Promise<T>): Promise<T | AdminRefusal> {
  try {
    return await call;
  } catch {
    return { ok: false, code: "unreachable", detail: "The server did not answer with anything the page can read." };
  }
}

const part = encodeURIComponent;

function query(pairs: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(pairs)) if (value !== undefined && value !== "") params.set(name, value);
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
}

/** `stepUp`: the passkey's own call, the auth library's in the page; a test hands in its own. */
export function adminApi(server: Api, baseUrl: string, stepUp: () => Promise<StepUp> = passkeyStepUp(baseUrl)): AdminApi {
  const base = baseUrl.replace(/\/+$/, "");
  return {
    standing: async () => {
      const reply = await settle(server.get<AccountReply>("/api/account"));
      if (!reply.ok || !("account" in reply)) return "not-admin";
      if (reply.account.admin) return "admin";
      if (reply.account.adminNeedsPasskey !== true) return "not-admin";
      return reply.account.ways.passkeys > 0 ? "needs-passkey" : "add-passkey";
    },
    stepUp,
    report: (day) => settle(server.get(`/api/admin/report${query({ day: day === null ? undefined : String(day) })}`)),
    alarms: () => settle(server.get("/api/admin/alarms")),
    checks: () => settle(server.get("/api/admin/checks")),
    handleCheck: (check, reason) => settle(server.post(`/api/admin/checks/${part(check)}/handle`, { reason })),
    rejections: () => settle(server.get("/api/admin/rejections")),
    rollback: (character) => settle(server.get(`/api/admin/rollback/${part(character)}`)),
    queue: () => settle(server.get("/api/admin/moderation/queue")),
    closeReport: (item, body) => settle(server.post(`/api/admin/moderation/${part(item)}/close`, body)),
    decideAppeal: (item, body) => settle(server.post(`/api/admin/moderation/${part(item)}/close`, body)),
    log: (filter) => settle(server.get(`/api/admin/moderation/log${query(filter)}`)),
    feedback: () => settle(server.get("/api/admin/moderation/feedback")),
    pendingLights: () => settle(server.get("/api/admin/dedication/pending")),
    decideLight: (account, outcome) => settle(server.post(`/api/admin/dedication/${part(account)}/${outcome}`, {})),
    analytics: (day) => settle(server.get(`/api/admin/analytics${query({ day: day ?? undefined })}`)),
    stats: () => settle(server.get("/api/admin/stats")),
    switches: () => settle(server.get("/api/admin/switches")),
    switchLog: () => settle(server.get("/api/admin/switches/log")),
    setSwitch: (name, on, reason) => settle(server.post("/api/admin/switches", { name, on, reason })),
    setDial: (change, reason) => settle(server.post("/api/admin/dials", { ...change, reason })),
    campaigns: () => settle(server.get("/api/admin/adverts/campaigns")),
    decideCampaign: (campaign, outcome, body) => settle(server.post(`/api/admin/adverts/campaigns/${part(campaign)}/${outcome}`, body)),
    decideCreative: (creative, version, outcome, body) => settle(server.post(`/api/admin/adverts/creatives/${part(creative)}/${String(version)}/${outcome}`, body)),
    pull: (campaign) => settle(server.post(`/api/admin/adverts/campaigns/${part(campaign)}/pull`, {})),
    recheck: (campaign) => settle(server.post(`/api/admin/adverts/campaigns/${part(campaign)}/recheck`, {})),
    imageUrl: (creative, version) => `${base}/api/admin/adverts/creatives/${part(creative)}/${String(version)}/image`,
  };
}

let made: AdminApi | undefined;

/**
 * The build's own. With a server named it is that server's; without one the
 * page asks its own origin, where no account answers, so the page never mounts.
 */
export function buildAdminApi(): AdminApi {
  if (made === undefined) {
    const mode = authorityMode();
    const baseUrl = mode.authority === "remote" ? mode.baseUrl : "";
    made = adminApi(api({ baseUrl }), baseUrl);
  }
  return made;
}
