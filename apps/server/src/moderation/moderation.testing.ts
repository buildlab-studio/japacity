// The moderation tests' harness: the routes over memory stores, a report
// store stand-in with reports and holds, and stand-in identities.
import type { ConversationRow } from "@japacity/sim";
import { Hono } from "hono";

import { testDeps } from "../app.testing";
import { testConfig } from "../config";
import { testSession, type ServerDeps } from "../deps";
import { adminModerationRoutes } from "../routes/admin-moderation";
import type { Identities } from "./identities";
import { memoryReportQueue, type Hold, type Report } from "./reports";

export const ADMIN = "account.admin";
export const SECOND_ADMIN = "account.admin-2";
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export const as = (account: string | null, init: RequestInit = {}): RequestInit =>
  account === null ? init : { ...init, headers: { ...init.headers, "x-test-account": account, "content-type": "application/json" } };

export const post = (account: string | null, body: unknown): RequestInit => as(account, { method: "POST", body: JSON.stringify(body) });

export function report(id: string, over: Partial<Report> = {}): Report {
  return {
    id,
    reporter: "account.reporter",
    subject: { account: "account.reported" },
    reason: "harassment",
    cites: { messages: [`${id}.m1`] },
    unverified: false,
    at: 0,
    status: "open",
    ...over,
  };
}

export function message(id: string, sentAt: number, sender = "account.reported"): ConversationRow {
  return { id, conversation: "conversation.1", sender, phrase: "phrase.hello", fill: null, sentAt, readAt: null };
}

interface FakeIdentities extends Identities {
  ended: string[];
  known: Map<string, string[]>;
}

function fakeIdentities(known: Record<string, string[]> = {}): FakeIdentities {
  const ended: string[] = [];
  const map = new Map(Object.entries(known));
  return {
    ended,
    known: map,
    of: (account) => Promise.resolve(map.get(account) ?? []),
    endSessions: (account) => {
      ended.push(account);
      return Promise.resolve();
    },
  };
}

export interface ModerationHarness {
  deps: ServerDeps;
  queue: ReturnType<typeof memoryReportQueue>;
  identities: FakeIdentities;
  app: Hono;
  /** Moves the server's clock. */
  at: (ms: number) => void;
}

export function moderationHarness(seed: { reports?: Report[]; holds?: Hold[]; messages?: ConversationRow[]; admins?: string[]; now?: number; identities?: Record<string, string[]> } = {}): ModerationHarness {
  const config = testConfig({ testing: { testLogin: true }, admin: { accounts: seed.admins ?? [ADMIN] } });
  let now = seed.now ?? DAY;
  const deps = testDeps({ config, session: testSession(config), now: () => now });
  const queue = memoryReportQueue(seed);
  const identities = fakeIdentities(seed.identities);
  const app = new Hono().route("/", adminModerationRoutes(deps, { reports: queue, identities }));
  return {
    deps,
    queue,
    identities,
    app,
    at: (ms) => {
      now = ms;
    },
  };
}
