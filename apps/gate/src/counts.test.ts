/// <reference types="@cloudflare/vitest-plugin/types" />
import { env, exports } from "cloudflare:workers";
import { describe, expect, test } from "vitest";

import type { CountRow } from "./counts";
import { countsFor } from "./counts";

// The game's GateCounters entrypoint is a stand-in named in vitest.config.ts: it keeps what it was handed.
interface Counted {
  rows: CountRow[];
  country: string;
}
const game = env.GAME as unknown as { seen: () => Promise<Counted[]> };

const HOST = "https://japacity.app";

/** A visit from a made-up country, so this file reads only its own counts. */
function visit(path: string, country: string, init: RequestInit = {}): Promise<Response> {
  return exports.default.fetch(new Request(`${HOST}${path}`, { redirect: "manual", ...init, cf: { country } }));
}

/** What the game was handed from `country`, once the gate's background calls have landed. */
async function countedFrom(country: string, expected: number): Promise<CountRow[][]> {
  const found: Counted[] = [];
  for (let tries = 0; tries < 50 && found.length < expected; tries += 1) {
    found.push(...(await game.seen()).filter((each) => each.country === country));
    if (found.length < expected) await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return found.map((each) => each.rows);
}

async function admitted(): Promise<string> {
  const response = await exports.default.fetch(new Request(`${HOST}/invite/${encodeURIComponent(env.GATE_SECRET)}`, { redirect: "manual" }));
  return (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
}

describe("what the gate counts for the game", () => {
  test("[R-ANALYTICS-008] [R-ANALYTICS-007] given a visit to the holding screen, when it is served, then the game is handed the holding step and the country, and nothing else about the visitor", async () => {
    expect((await visit("/", "QA", { headers: { "user-agent": "Mozilla/5.0 test", cookie: "other=1" } })).status).toBe(200);
    const counted = await countedFrom("QA", 1);
    expect(counted).toEqual([[{ name: "funnel/step", key: "holding" }]]);
    expect(JSON.stringify(counted)).not.toContain("Mozilla");
  });

  test("[R-ANALYTICS-008] given the invite link with the right code, when it is opened, then the game is handed the invited step", async () => {
    expect((await visit(`/invite/${encodeURIComponent(env.GATE_SECRET)}`, "QB")).status).toBe(303);
    expect(await countedFrom("QB", 1)).toEqual([[{ name: "funnel/step", key: "invited" }]]);
  });

  test("[R-ANALYTICS-008] given a shared card's link, when it is opened without the cookie and with it, then each counts the card's arrival by kind, the first beside the holding step", async () => {
    await visit("/?card=send-off", "QC");
    const cookie = await admitted();
    expect(await (await visit("/?card=granted", "QC", { headers: { cookie } })).text()).toBe("game /");
    expect(await countedFrom("QC", 2)).toEqual([
      [
        { name: "funnel/step", key: "holding" },
        { name: "share/arrival", key: "send-off" },
      ],
      [{ name: "share/arrival", key: "granted" }],
    ]);
  });

  test("[R-ANALYTICS-008] given a bare refusal, a HEAD of the screen and a file, when they are answered, then nothing is counted", async () => {
    expect((await visit("/api/view?card=granted", "QD")).status).toBe(403);
    expect((await visit("/", "QD", { method: "HEAD" })).status).toBe(200);
    const cookie = await admitted();
    await visit("/assets/app.js?card=granted", "QD", { headers: { cookie } });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await countedFrom("QD", 0)).toEqual([]);
  });
});

describe("the counts one request makes", () => {
  const get = (path: string, method = "GET") => countsFor(new Request(`${HOST}${path}`, { method }), new URL(`${HOST}${path}`), "passed");

  test("[R-ANALYTICS-008] given card links of every form, when a passed request is read, then only a page load with a kind's shape counts an arrival", () => {
    expect(get("/?card=send-off")).toEqual([{ name: "share/arrival", key: "send-off" }]);
    expect(get("/play?card=granted")).toEqual([{ name: "share/arrival", key: "granted" }]);
    expect(get("/?card=")).toEqual([]);
    expect(get("/?card=<script>")).toEqual([]);
    expect(get(`/?card=${"a".repeat(33)}`)).toEqual([]);
    expect(get("/?card=granted", "POST")).toEqual([]);
    expect(get("/api/view?card=granted")).toEqual([]);
    expect(get("/card.png?card=granted")).toEqual([]);
  });
});
