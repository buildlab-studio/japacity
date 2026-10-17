// R-MODERATION-008, R-MODERATION-014 to 019: an admin closes a report or
// decides an appeal; every action is logged first, a close lifts the hold,
// and a ban bars the sign-in identities and ends every session.
import type { AdminAction, AppealRow, ModerationLogEntry } from "@japacity/store";

import { requestDeletion } from "../account/deletion";
import { generatedUsername } from "../account/username";
import { rollbackCheck } from "../admin/rollback";
import type { ServerDeps } from "../deps";
import type { ServerCode } from "../types";
import { banIdentities, type Identities } from "./identities";
import { REPORT_REASONS, type Report, type ReportQueueStore, type ReportReason } from "./reports";
import { TOLD } from "./standing";

/** What the admin view is given beside the deps: the pair side's report store and the auth library's identities. */
export interface ModerationPorts {
  reports: ReportQueueStore;
  /** Null when the server runs without the auth library; a ban is then refused. */
  identities: Identities | null;
}

/** R-MODERATION-014: the actions a report can be closed with. The advert actions are the advert queue's; `rollback` opens the tool and leaves the report open. */
const ON_REPORT = ["dismiss", "warn", "mute", "suspend", "ban", "reset-name", "refer", "rollback"] as const satisfies readonly AdminAction[];

type ReportAction = (typeof ON_REPORT)[number];

/** A generated name is drawn again while the store finds it taken; past this many the reset fails loudly. */
const NAME_DRAWS = 8;

/** Actions that need the subject to be an account, not an advert's campaign. */
const ON_ACCOUNT: readonly ReportAction[] = ["warn", "mute", "suspend", "ban", "reset-name", "rollback"];

/** R-MODERATION-017: an upheld `underage` report closes the account; a lesser action does not uphold it. */
const NOT_FOR_UNDERAGE: readonly ReportAction[] = ["warn", "mute", "suspend", "reset-name"];

const MAX_DAYS = 3650;
const MAX_NOTE = 1000;
const MAX_BODY = 200;

export type Decided =
  | { ok: true; entry: ModerationLogEntry; report?: Report; appeal?: AppealRow; rollback?: unknown }
  | { ok: false; status: 400 | 403 | 404 | 409; code: ServerCode; detail: string };

function refused(status: 400 | 403 | 404 | 409, code: ServerCode, detail: string): Decided {
  return { ok: false, status, code, detail };
}

export function newId(deps: Pick<ServerDeps, "randomBytes">, prefix: string): string {
  return `${prefix}.${[...deps.randomBytes(8)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

interface Common {
  /** the page asks for "a reason chosen from a list" and names none; the report reasons serve until it does. */
  reason: ReportReason;
  note?: string;
}

function readCommon(body: Record<string, unknown>): Common | string {
  const { reason, note } = body;
  if (typeof reason !== "string" || !(REPORT_REASONS as readonly string[]).includes(reason)) return `reason is one of ${REPORT_REASONS.join(", ")}.`;
  if (note !== undefined && (typeof note !== "string" || note.length > MAX_NOTE)) return `note is text of at most ${String(MAX_NOTE)} characters.`;
  return note === undefined || note === "" ? { reason: reason as ReportReason } : { reason: reason as ReportReason, note };
}

function asObject(body: unknown): Record<string, unknown> {
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
}

async function write(deps: ServerDeps, entry: Omit<ModerationLogEntry, "id">): Promise<ModerationLogEntry> {
  const written = await deps.stores.moderationLog.append({ id: newId(deps, "log"), ...entry });
  if (!written.ok) throw new Error(`The log refused an entry: ${written.detail}`);
  return written.value;
}

/** R-MODERATION-014 to 019: closes a report with one action. */
export async function closeReport(deps: ServerDeps, ports: ModerationPorts, admin: string, id: string, body: unknown): Promise<Decided> {
  const report = await ports.reports.get(id);
  if (report === null) return refused(404, "unknown-id", `No report ${id}.`);
  if (report.status !== "open") return refused(409, "ended", `Report ${id} is decided.`);

  const sent = asObject(body);
  const action = sent.action;
  if (typeof action !== "string" || !(ON_REPORT as readonly string[]).includes(action)) return refused(400, "not-legal", `action is one of ${ON_REPORT.join(", ")}.`);
  const act = action as ReportAction;
  const common = readCommon(sent);
  if (typeof common === "string") return refused(400, "not-legal", common);

  const params: Record<string, string | number> = {};
  const account = "account" in report.subject ? report.subject.account : null;
  if (ON_ACCOUNT.includes(act) && account === null) return refused(400, "not-legal", `${act} is taken on an account, and this report is about an advert.`);
  if (account !== null) params.account = account;
  if (report.reason === "underage" && NOT_FOR_UNDERAGE.includes(act)) return refused(400, "not-legal", "An upheld underage report closes the account: ban, refer or dismiss.");
  if (act === "mute" || act === "suspend") {
    if (!Number.isSafeInteger(sent.days) || (sent.days as number) < 1 || (sent.days as number) > MAX_DAYS) return refused(400, "not-legal", `days is a whole number from 1 to ${String(MAX_DAYS)}.`);
    params.days = sent.days as number;
  }
  if (act === "refer") {
    if (typeof sent.body !== "string" || sent.body.trim() === "" || sent.body.length > MAX_BODY) return refused(400, "not-legal", "body names the outside body the matter was passed to.");
    params.body = sent.body.trim();
  }
  if (act === "ban" && ports.identities === null) return refused(409, "not-legal", "A ban needs the sign-in library, and this server runs without it.");

  const entry = await write(deps, { admin, at: deps.now(), item: report.id, action: act, params, ...common });

  if (act === "rollback" && account !== null) {
    // R-MODERATION-019: the tool opens on the one account; the report stays open and held.
    const row = await deps.stores.account.get(account);
    return { ok: true, entry, rollback: row?.character === null || row === null ? { ok: false, code: "missing", detail: `Account ${account} has no character.` } : await rollbackCheck(deps, row.character) };
  }
  if (act === "reset-name" && account !== null) await resetName(deps, account);
  if ((act === "ban" || act === "suspend") && account !== null && ports.identities !== null) {
    if (act === "ban") {
      await banIdentities(deps, await ports.identities.of(account));
      await requestDeletion(deps, account);
    }
    await ports.identities.endSessions(account);
  }

  const closed = await ports.reports.close(report.id, act === "dismiss" ? "no-action" : "acted", deps.now());
  if (!closed.ok) return refused(409, "ended", closed.detail);
  await ports.reports.lift(report.id);
  return { ok: true, entry, report: closed.value };
}

/** Draws a generated name until one is free; an account already gone needs none (R-MODERATION-014 `reset-name`). */
async function resetName(deps: ServerDeps, account: string): Promise<void> {
  for (let draw = 0; draw < NAME_DRAWS; draw += 1) {
    const changed = await deps.stores.account.setUsername(account, generatedUsername(deps.randomBytes), deps.now());
    if (changed.ok || changed.code === "missing") return;
  }
  throw new Error(`No free generated name for ${account} after ${String(NAME_DRAWS)} draws.`);
}

/** R-MODERATION-016: decides an appeal, by an admin other than the one who acted when there is more than one. */
export async function decideAppeal(deps: ServerDeps, admin: string, id: string, body: unknown): Promise<Decided> {
  const appeal = await deps.stores.appeals.get(id);
  if (appeal === null) return refused(404, "unknown-id", `No appeal ${id}.`);
  if (appeal.status !== "open") return refused(409, "ended", `Appeal ${id} is decided.`);
  const sent = asObject(body);
  const outcome = sent.outcome;
  if (outcome !== "upheld" && outcome !== "overturned") return refused(400, "not-legal", "outcome is upheld or overturned.");
  const common = readCommon(sent);
  if (typeof common === "string") return refused(400, "not-legal", common);
  const acted = await deps.stores.moderationLog.get(appeal.entry);
  if (acted !== null && acted.admin === admin && deps.config.admin.accounts.length > 1) return refused(403, "not-yours", "Another admin decides an appeal against your own action.");

  // R-MODERATION-014 has no action for deciding an appeal; it is logged as `dismiss` on the appeal, with the outcome in its parameters.
  const entry = await write(deps, { admin, at: deps.now(), item: appeal.id, action: "dismiss", params: { account: appeal.account, entry: appeal.entry, outcome }, ...common });
  const decided = await deps.stores.appeals.decide(appeal.id, { outcome, by: admin, at: deps.now() });
  if (!decided.ok) return refused(409, "ended", decided.detail);
  return { ok: true, entry, appeal: decided.value };
}

/** R-MODERATION-016: a player appeals one action taken on their own account, once. */
export async function fileAppeal(deps: ServerDeps, account: string, body: unknown): Promise<{ ok: true; appeal: AppealRow } | { ok: false; status: 400 | 404 | 409; code: ServerCode; detail: string }> {
  const action = asObject(body).action;
  if (typeof action !== "string") return { ok: false, status: 400, code: "not-legal", detail: "action names the action appealed." };
  const entry = await deps.stores.moderationLog.get(action);
  const mine = entry !== null && entry.params.account === account && (TOLD as readonly string[]).includes(entry.action);
  if (!mine) return { ok: false, status: 404, code: "unknown-id", detail: `No action ${action} on this account.` };
  const filed = await deps.stores.appeals.file({ id: newId(deps, "appeal"), account, entry: action, at: deps.now() });
  if (!filed.ok) return { ok: false, status: 409, code: "not-legal", detail: "This action has been appealed already." };
  return { ok: true, appeal: filed.value };
}
