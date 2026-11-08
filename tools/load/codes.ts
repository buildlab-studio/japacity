// The emailed code under load (account:sign-in-routes-rate-limited, account:play-starts-without-email).
// The code is never on the way to play, so it is
// measured apart from the commands: `POST /api/auth/email-otp/send-verification-otp`
// at a constant arrival rate, each to a new address from a new connection
// header, so the per-address and per-email limits are not what is measured.
// The send is handed to the background and never awaited (account:email-code-is-short-lived), so
// the reply's time is the server's and not the email provider's.
//
//   pnpm tsx tools/load/codes.ts --target http://127.0.0.1:8787 --rate 20 --seconds 60
//
// The target is a Worker with the accounts mounted (the load Worker has none)
// and the test server's email stand-in, so no email leaves this machine. Each send
// carries Cloudflare's dummy token, which the always-pass test secret passes on a
// local SITE_URL (account:bot-check-on-code-send).
import { int } from "@japacity/sim";
import { setTimeout as sleep } from "node:timers/promises";

import { argument, wholeArgument } from "./http";
import { config } from "./load.config";
import { ms, percentile } from "./pass";
import type { Check, Verdict } from "./pass";
import { isMain } from "../repo";

// No rule page gives the codes' target rate; 20 a second is a working value, a twentieth of the peak's commands.
export const CODES_PER_SECOND = 20;

/** Cloudflare's dummy Turnstile token, the one its test secrets answer. */
const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

export interface CodesResult {
  target: number;
  sent: number;
  ok: number;
  limited: number;
  serverErrors: number;
  otherRefusals: number;
  connectionErrors: number;
  p95Us: number;
  p99Us: number;
}

/** The pass rule, as load:main-scenario-pass-thresholds holds the commands to it: the rate kept, the times, no server error; a limit or a lost connection means the run is repeated. */
export function codesPassRule(result: CodesResult, thresholds: { p95Ms: number; p99Ms: number } = config.load): { verdict: Verdict; checks: Check[] } {
  const checks: Check[] = [
    { name: "Codes sent against the target", threshold: `at least 99% of ${String(result.target)}`, measured: String(result.sent), ok: result.sent * 100 >= result.target * 99 },
    { name: "Time per send, 95th percentile", threshold: `${String(thresholds.p95Ms)} ms or less`, measured: ms(result.p95Us), ok: result.p95Us <= thresholds.p95Ms * 1000 },
    { name: "Time per send, 99th percentile", threshold: `${String(thresholds.p99Ms)} ms or less`, measured: ms(result.p99Us), ok: result.p99Us <= thresholds.p99Ms * 1000 },
    { name: "Server errors (5xx)", threshold: "none", measured: String(result.serverErrors), ok: result.serverErrors === 0 },
    { name: "Other refusals", threshold: "none", measured: String(result.otherRefusals), ok: result.otherRefusals === 0 },
    { name: "Limited (429) or lost connections", threshold: "reported; any means repeat", measured: `${String(result.limited)} limited, ${String(result.connectionErrors)} lost`, ok: result.limited === 0 && result.connectionErrors === 0 },
  ];
  const failed = checks.slice(0, -1).some((check) => !check.ok);
  const verdict: Verdict = failed ? "fail" : result.limited > 0 || result.connectionErrors > 0 ? "repeat" : "pass";
  return { verdict, checks };
}

/** One send; status 0 when the connection failed. */
async function sendOne(base: string, index: number): Promise<{ status: number; us: number }> {
  const started = performance.now();
  try {
    const reply = await fetch(`${base}/api/auth/email-otp/send-verification-otp`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-captcha-response": DUMMY_TOKEN, "cf-connecting-ip": `10.${String(int.divFloor(index, 65536) % 256)}.${String(int.divFloor(index, 256) % 256)}.${String(index % 256)}` },
      // A new address has no account; the send mails it a code as it mails every address (account:sign-in-without-secret).
      body: JSON.stringify({ email: `load-${String(index)}@example.test`, type: "sign-in" }),
    });
    await reply.text();
    return { status: reply.status, us: Math.round((performance.now() - started) * 1000) };
  } catch {
    return { status: 0, us: Math.round((performance.now() - started) * 1000) };
  }
}

/** Sends `rate` codes a second for `seconds`, each on its own schedule so a slow reply never holds the next back. */
export async function runCodes(base: string, rate: number, seconds: number): Promise<CodesResult> {
  const target = rate * seconds;
  const replies: Promise<{ status: number; us: number }>[] = [];
  const begin = performance.now();
  for (let index = 0; index < target; index += 1) {
    const due = begin + int.divFloor(index * 1000, rate);
    const wait = due - performance.now();
    if (wait > 0) await sleep(wait);
    replies.push(sendOne(base, index));
  }
  const done = await Promise.all(replies);
  const times = done.map((reply) => reply.us).sort((left, right) => left - right);
  const count = (test: (status: number) => boolean) => done.filter((reply) => test(reply.status)).length;
  return {
    target,
    sent: done.length,
    ok: count((status) => status === 200),
    limited: count((status) => status === 429),
    serverErrors: count((status) => status >= 500),
    otherRefusals: count((status) => status >= 400 && status < 500 && status !== 429),
    connectionErrors: count((status) => status === 0),
    p95Us: percentile(times, 9500),
    p99Us: percentile(times, 9900),
  };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const result = await runCodes(argument(args, "target", "http://127.0.0.1:8787"), wholeArgument(args, "rate", CODES_PER_SECOND), wholeArgument(args, "seconds", 60));
  const { verdict, checks } = codesPassRule(result);
  for (const check of checks) console.log(`${check.ok ? "ok  " : "MISS"} ${check.name}: ${check.measured} (${check.threshold})`);
  console.log(`Verdict: ${verdict}`);
  process.exitCode = verdict === "pass" ? 0 : 1;
}
