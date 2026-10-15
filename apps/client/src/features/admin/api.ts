// The admin page's calls, one per admin route the server has. Every call
// settles: a refusal, a page the server does not have and a fetch that never
// arrived all come back as one shape the page shows as it is.
import { authorityMode } from "../../authority/mode";
import type { AccountReply } from "../../shared/net/contract";
import { api, type Api } from "../../shared/net/http";
import type {
  AdminRefusal,
  AlarmsReply,
  CampaignReply,
  CampaignsReply,
  CloseReportBody,
  CreativeReply,
  DashboardReply,
  DecideAppealBody,
  DecidedReply,
  DialChange,
  FeedbackReply,
  LightDecidedReply,
  LogReply,
  PendingLightsReply,
  QueueReply,
  RecheckReply,
  RejectionsReply,
  ReportReply,
  ReviewBody,
  RollbackCheck,
  SwitchesReply,
  SwitchLogReply,
  StatsReply,
  SwitchName,
} from "./admin.contract";

export type Outcome = "approve" | "refuse";

export interface AdminApi {
  /** True only when `GET /api/account` answers and names the account as an admin. */
  isAdmin: () => Promise<boolean>;
  report: (day: number | null) => Promise<ReportReply>;
  alarms: () => Promise<AlarmsReply>;
  rejections: () => Promise<RejectionsReply>;
  rollback: (character: string) => Promise<RollbackCheck | AdminRefusal>;
  queue: () => Promise<QueueReply>;
  closeReport: (item: string, body: CloseReportBody) => Promise<DecidedReply>;
  decideAppeal: (item: string, body: DecideAppealBody) => Promise<DecidedReply>;
  log: (filter: { item?: string; account?: string }) => Promise<LogReply>;
  feedback: () => Promise<FeedbackReply>;
  /** R-MODERATION-021: the dedication lights whose names await a look, oldest first. */
  pendingLights: () => Promise<PendingLightsReply>;
  /** R-MODERATION-021: a light's name approved for everyone, or the light refused and put out. */
  decideLight: (account: string, outcome: Outcome) => Promise<LightDecidedReply>;
  analytics: (day: string | null) => Promise<DashboardReply>;
  /** R-ANALYTICS-012: the numbers, live. */
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
  /** R-ADVERT-011: where an admin sees any version's image, whatever its status. */
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

export function adminApi(server: Api, baseUrl: string): AdminApi {
  const base = baseUrl.replace(/\/+$/, "");
  return {
    isAdmin: async () => {
      const reply = await settle(server.get<AccountReply>("/api/account"));
      return reply.ok && "account" in reply && reply.account.admin === true;
    },
    report: (day) => settle(server.get(`/api/admin/report${query({ day: day === null ? undefined : String(day) })}`)),
    alarms: () => settle(server.get("/api/admin/alarms")),
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
