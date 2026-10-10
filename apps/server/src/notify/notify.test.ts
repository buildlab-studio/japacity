import { content } from "@japacity/content";
import { newState, time } from "@japacity/sim";
import type { PushSubscriptionJson } from "@japacity/store";
import { afterEach, describe, expect, test, vi } from "vitest";

import { harness } from "../auth/testing";
import { sendAuthority } from "../authority/command";
import type { TestServer } from "../authority/testing";
import { newLife, restMonth, send, testServer, view } from "../authority/testing";
import { productionConfig } from "../config";
import { turnClock } from "../clock/view";
import { runDeletions } from "../jobs/deletion";
import { notifyJob } from "../jobs/notify";
import { TICKS_CRON } from "../jobs/ticks";
import type { NotifyReply } from "../routes/notify";
import { readEndpoint } from "./device";
import { fullAtOf } from "./fill";
import { noticePayload } from "./notice";
import { notifyText } from "./notify.text";
import type { PushKeys } from "./webpush";
import { concat, fromBase64Url, label, pushRequest, recordKeys, toBase64Url } from "./webpush";

const { epoch, turnRefillMs } = productionConfig.clock;
const cap = content.tuning.turn.cap;
const decoder = new TextDecoder();

/** A browser's side of a subscription: what it sends, and the private key that opens what it is sent. */
interface TestDevice {
  json: PushSubscriptionJson;
  privateKey: CryptoKey;
}

async function testDevice(name: string): Promise<TestDevice> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const point = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { json: { endpoint: `https://fcm.googleapis.com/fcm/send/${name}`, keys: { p256dh: toBase64Url(point), auth: toBase64Url(auth) } }, privateKey: pair.privateKey };
}

interface Sent {
  url: string;
  init: RequestInit;
}

/** The deployment's VAPID pair, made afresh, with a push service that answers `status` for an endpoint and 201 otherwise. */
async function testKeys(status: Record<string, number> = {}): Promise<{ keys: PushKeys; sent: Sent[]; verify: CryptoKey }> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const point = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  const sent: Sent[] = [];
  const keys: PushKeys = {
    publicKey: toBase64Url(point),
    privateKey: jwk.d ?? "",
    subject: "mailto:owner@example.test",
    numbers: productionConfig.notify,
    fetch: (url, init) => {
      sent.push({ url, init });
      return Promise.resolve(new Response(null, { status: status[url] ?? 201 }));
    },
  };
  return { keys, sent, verify: pair.publicKey };
}

/** RFC 8291 from the browser's side: the header read, the same keys derived, the record opened and its delimiter taken off. */
async function open(device: TestDevice, body: Uint8Array): Promise<string> {
  const salt = body.slice(0, 16);
  const idLength = body[20] ?? 0;
  const sender = body.slice(21, 21 + idLength);
  const theirs = await crypto.subtle.importKey("raw", sender, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const agreement = { name: "ECDH", public: theirs } as unknown as SubtleCryptoDeriveKeyAlgorithm;
  const shared = new Uint8Array(await crypto.subtle.deriveBits(agreement, device.privateKey, 256));
  const { key, nonce } = await recordKeys(shared, fromBase64Url(device.json.keys.auth), fromBase64Url(device.json.keys.p256dh), sender, salt);
  const opening = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, opening, body.slice(21 + idLength)));
  expect(plain.at(-1)).toBe(2);
  return decoder.decode(plain.slice(0, -1));
}

function headerOf(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name);
}

async function request(server: TestServer, method: "GET" | "PUT" | "POST" | "DELETE", path: string, account: string | null, body?: unknown): Promise<{ status: number; body: NotifyReply }> {
  const headers: Record<string, string> = { "cf-connecting-ip": "203.0.113.9", "content-type": "application/json" };
  if (account !== null) headers["x-test-account"] = account;
  const reply = await server.app.request(path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: reply.status, body: await reply.json<NotifyReply>() };
}

function subscribe(server: TestServer, account: string, device: TestDevice) {
  return request(server, "POST", "/api/notify/subscribe", account, { subscription: device.json });
}

/** A player who agreed on `devices`, looked at the full bank, then spent `spent` turns at the epoch. The bank fills `spent` refills later. */
async function playerAway(server: TestServer, account: string, devices: TestDevice[], spent: number): Promise<string> {
  const character = await newLife(server, account);
  for (const device of devices) expect((await subscribe(server, account, device)).body).toMatchObject({ ok: true, on: true });
  const first = await view(server, account);
  if (!first.body.ok) throw new Error(first.body.detail);
  let v = first.body.view.v;
  for (let month = 0; month < spent; month += 1) {
    const sent = await send(server, account, restMonth({ v }));
    if (!sent.body.ok) throw new Error(sent.body.detail);
    v = sent.body.view.v;
  }
  return character;
}

describe("the push message", () => {
  test("[R-CLOCK-031] given a device's keys, when the notice is sealed, then only that device's private key opens it, to the bank-full words", async () => {
    const device = await testDevice("one");
    const other = await testDevice("two");
    const { keys } = await testKeys();

    const init = await pushRequest(keys, device.json, noticePayload(), epoch, crypto.getRandomValues(new Uint8Array(16)));
    const body = init.body as Uint8Array;

    expect(JSON.parse(await open(device, body))).toEqual({ title: "Japacity", body: notifyText["notify.bank-full"], tag: "notify.bank-full" });
    expect(new DataView(body.buffer, body.byteOffset).getUint32(16)).toBe(4096);
    await expect(open({ ...other, json: device.json }, body)).rejects.toThrow();
  });

  test("[R-CLOCK-031] given the deployment's keys, when a push request is made, then its token is signed for the endpoint's origin, lives twelve hours and names the maintainer, beside the coding and the TTL", async () => {
    const device = await testDevice("one");
    const { keys, verify } = await testKeys();

    const init = await pushRequest(keys, device.json, "words", epoch + 999, crypto.getRandomValues(new Uint8Array(16)));

    const authorization = headerOf(init, "authorization") ?? "";
    const [, token = "", key = ""] = /^vapid t=([^,]+), k=(.+)$/.exec(authorization) ?? [];
    expect(key).toBe(keys.publicKey);
    const [header = "", claims = "", signature = ""] = token.split(".");
    const signed = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, verify, fromBase64Url(signature), new TextEncoder().encode(`${header}.${claims}`));
    expect(signed).toBe(true);
    expect(JSON.parse(decoder.decode(fromBase64Url(header)))).toEqual({ typ: "JWT", alg: "ES256" });
    expect(JSON.parse(decoder.decode(fromBase64Url(claims)))).toEqual({ aud: "https://fcm.googleapis.com", exp: Math.floor((epoch + 999) / time.SECOND_MS) + 12 * 3600, sub: "mailto:owner@example.test" });
    expect(headerOf(init, "content-encoding")).toBe("aes128gcm");
    expect(headerOf(init, "ttl")).toBe("86400");
    expect(concat(label("ab"))).toEqual(Uint8Array.of(97, 98, 0));
  });
});

describe("the bank's fill", () => {
  const clock = turnClock(productionConfig, cap);
  const state = (banked: number, ended = false) => {
    const start = newState("scenario.ada", "fill-seed", content);
    return { ...start, turn: { ...start.turn, banked, ended } };
  };

  test("[R-CLOCK-031] given a bank one and two short of the cap, when its fill is worked out, then it is that many refills after refilledAt", () => {
    expect(fullAtOf(state(cap - 1), epoch + 5, epoch + 9, "player", clock)).toBe(epoch + 5 + turnRefillMs);
    expect(fullAtOf(state(cap - 2), epoch + 5, epoch + 9, "authority", clock)).toBe(epoch + 5 + 2 * turnRefillMs);
  });

  test("[R-CLOCK-031] given a full bank, when the player's request saw it, then there is no fill to tell of; when the authority filled it, the fill is now", () => {
    expect(fullAtOf(state(cap), epoch, epoch + 9, "player", clock)).toBeNull();
    expect(fullAtOf(state(cap), epoch, epoch + 9, "authority", clock)).toBe(epoch + 9);
  });

  test("[R-CLOCK-031] given a life that is over, when its fill is worked out, then it never fills", () => {
    expect(fullAtOf(state(0, true), epoch, epoch + 9, "authority", clock)).toBeNull();
  });
});

describe("the bank-full notices", () => {
  test("[R-CLOCK-031] given a player away on two devices, when the job runs one ms before the bank fills and at the fill, then nothing goes before it, one push to each device at it, and nothing on the next run", async () => {
    const server = testServer();
    const devices = [await testDevice("a"), await testDevice("b")];
    const { keys, sent } = await testKeys();
    await playerAway(server, "acc-1", devices, 2);

    server.wait(2 * turnRefillMs - 1);
    expect(await notifyJob(server.deps, keys, TICKS_CRON)).toMatchObject({ told: [] });
    expect(sent).toHaveLength(0);

    server.wait(1);
    const run = await notifyJob(server.deps, keys, TICKS_CRON);
    expect(run?.told).toHaveLength(1);
    expect(sent.map((each) => each.url)).toEqual(devices.map((device) => device.json.endpoint));
    const [first] = sent;
    if (first === undefined || devices[0] === undefined) throw new Error("No push was sent.");
    expect(JSON.parse(await open(devices[0], first.init.body as Uint8Array))).toMatchObject({ body: notifyText["notify.bank-full"] });

    server.wait(5 * time.MINUTE_MS);
    await notifyJob(server.deps, keys, TICKS_CRON);
    expect(sent).toHaveLength(2);
  });

  test("[R-CLOCK-031] given a fill already told, when the player comes back, spends a turn and goes away until it fills again, then exactly one more push goes", async () => {
    const server = testServer();
    const { keys, sent } = await testKeys();
    await playerAway(server, "acc-1", [await testDevice("a")], 1);
    server.wait(turnRefillMs);
    await notifyJob(server.deps, keys, TICKS_CRON);
    expect(sent).toHaveLength(1);

    const back = await view(server, "acc-1");
    if (!back.body.ok) throw new Error(back.body.detail);
    expect(back.body.view.turns.banked).toBe(cap);
    await notifyJob(server.deps, keys, TICKS_CRON);
    expect(sent).toHaveLength(1);
    await send(server, "acc-1", restMonth(back.body.view));
    server.wait(turnRefillMs);
    await notifyJob(server.deps, keys, TICKS_CRON);
    await notifyJob(server.deps, keys, TICKS_CRON);
    expect(sent).toHaveLength(2);
  });

  test("[R-CLOCK-031] given a bank that filled while the player was looking, when the job runs, then nothing is sent", async () => {
    const server = testServer();
    const { keys, sent } = await testKeys();
    await playerAway(server, "acc-1", [await testDevice("a")], 1);
    server.wait(turnRefillMs);

    const full = await view(server, "acc-1");
    if (!full.body.ok) throw new Error(full.body.detail);
    expect(full.body.view.turns.banked).toBe(cap);
    await notifyJob(server.deps, keys, TICKS_CRON);

    expect(sent).toHaveLength(0);
  });

  test("[R-CLOCK-031] given the setting turned off, when the bank fills, then nothing is sent and no device is kept", async () => {
    const server = testServer();
    const { keys, sent } = await testKeys();
    await playerAway(server, "acc-1", [await testDevice("a")], 1);

    expect((await request(server, "PUT", "/api/notify", "acc-1", { on: false })).body).toEqual({ ok: true, on: false, reaskDays: productionConfig.notify.reaskDays });
    server.wait(turnRefillMs);
    const run = await notifyJob(server.deps, keys, TICKS_CRON);

    expect(sent).toHaveLength(0);
    expect(run?.quiet).toHaveLength(1);
    expect(await server.deps.stores.push.forAccount("acc-1")).toEqual([]);
  });

  test("[R-CLOCK-031] given the setting on with the device's row still there, when the account row says off, then the job sends nothing", async () => {
    const server = testServer();
    const { keys, sent } = await testKeys();
    await playerAway(server, "acc-1", [await testDevice("a")], 1);
    await server.deps.stores.account.setNotify("acc-1", false);

    server.wait(turnRefillMs);
    await notifyJob(server.deps, keys, TICKS_CRON);

    expect(sent).toHaveLength(0);
  });

  test("[R-CLOCK-031] given an apology's grant that fills the bank while the player is away, when the job runs, then the notice goes at once", async () => {
    const server = testServer();
    const { keys, sent } = await testKeys();
    const character = await playerAway(server, "acc-1", [await testDevice("a")], 1);

    server.wait(10);
    expect((await sendAuthority(server.deps, character, { type: "turns/grant", count: 1, basedOn: 0 })).kind).toBe("done");
    await notifyJob(server.deps, keys, TICKS_CRON);

    expect(sent).toHaveLength(1);
  });

  test("[R-CLOCK-031] given a device the push service no longer knows, when the notice goes to it, then its row is removed and the other device keeps its own", async () => {
    const server = testServer();
    const gone = await testDevice("gone");
    const kept = await testDevice("kept");
    const { keys, sent } = await testKeys({ [gone.json.endpoint]: 410 });
    await playerAway(server, "acc-1", [gone, kept], 1);

    server.wait(turnRefillMs);
    const run = await notifyJob(server.deps, keys, TICKS_CRON);

    expect(sent).toHaveLength(2);
    expect(run?.gone).toEqual([gone.json.endpoint]);
    expect(await server.deps.stores.push.forAccount("acc-1")).toEqual([kept.json]);
  });

  test("[R-CLOCK-031] given no push keys, or another cron, when the job is asked to run, then it claims nothing, and with the keys the fill is still told", async () => {
    const server = testServer();
    const { keys, sent } = await testKeys();
    await playerAway(server, "acc-1", [await testDevice("a")], 1);
    server.wait(turnRefillMs);

    expect(await notifyJob(server.deps, null, TICKS_CRON)).toBeNull();
    expect(await notifyJob(server.deps, keys, "0 0 * * *")).toBeNull();
    await notifyJob(server.deps, keys, TICKS_CRON);

    expect(sent).toHaveLength(1);
  });
});

describe("the notice's routes", () => {
  test("[R-CLOCK-031] given no session, when the setting or a device is asked for or sent, then each is refused as signed out", async () => {
    const server = testServer();
    const device = await testDevice("a");

    for (const [method, path, body] of [
      ["GET", "/api/notify", undefined],
      ["PUT", "/api/notify", { on: true }],
      ["POST", "/api/notify/subscribe", { subscription: device.json }],
      ["DELETE", "/api/notify/subscribe", { endpoint: device.json.endpoint }],
    ] as const) {
      expect(await request(server, method, path, null, body)).toMatchObject({ status: 401, body: { ok: false, code: "signed-out" } });
    }
  });

  test("[R-CLOCK-031] given a new account, when the setting is read, then it is off with the re-ask wait, and a device turns it on", async () => {
    const server = testServer();
    await newLife(server, "acc-1");

    expect((await request(server, "GET", "/api/notify", "acc-1")).body).toEqual({ ok: true, on: false, reaskDays: productionConfig.notify.reaskDays });
    await subscribe(server, "acc-1", await testDevice("a"));
    expect((await request(server, "GET", "/api/notify", "acc-1")).body).toMatchObject({ on: true });
  });

  test("[R-CLOCK-031] given subscriptions that are not a browser's, when they are sent, then each is refused and nothing is kept", async () => {
    const server = testServer();
    await newLife(server, "acc-1");
    const { json } = await testDevice("a");

    for (const subscription of [
      null,
      { ...json, endpoint: "http://fcm.googleapis.com/fcm/send/a" },
      { ...json, endpoint: "not an address" },
      { ...json, keys: { ...json.keys, p256dh: json.keys.auth } },
      { ...json, keys: { ...json.keys, auth: json.keys.p256dh } },
      { endpoint: json.endpoint },
    ]) {
      expect(await request(server, "POST", "/api/notify/subscribe", "acc-1", { subscription })).toMatchObject({ status: 400, body: { code: "not-legal" } });
    }
    expect(await server.deps.stores.push.forAccount("acc-1")).toEqual([]);
  });

  test("[R-CLOCK-031] given push addresses on hosts that are no known push service, when each is sent, then each is refused with the bad-address answer and nothing is kept", async () => {
    const server = testServer();
    await newLife(server, "acc-1");
    const { json } = await testDevice("a");
    for (const endpoint of [
      "https://push.example.test/a",
      "https://evil.example/fcm.googleapis.com/a",
      "https://fcm.googleapis.com.evil.example/a",
      "https://notfcm.googleapis.com/a",
      "https://user@fcm.googleapis.com/a",
      "https://fcm.googleapis.com:8443/a",
      "https://192.0.2.1/a",
    ]) {
      expect({ endpoint, reply: await request(server, "POST", "/api/notify/subscribe", "acc-1", { subscription: { ...json, endpoint } }) }).toMatchObject({ endpoint, reply: { status: 400, body: { code: "not-legal" } } });
    }
    expect(await server.deps.stores.push.forAccount("acc-1")).toEqual([]);
  });

  test("[R-CLOCK-031] given the push addresses Google's, Apple's, Mozilla's and Microsoft's services give, when each is read, then each is kept as sent", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/abc:def",
      "https://web.push.apple.com/QAbc",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
      "https://wns2-par02p.notify.windows.com/w/?token=BQYAAA",
    ]) {
      expect(readEndpoint(endpoint)).toBe(endpoint);
    }
  });

  test("[R-CLOCK-031] given an account at the most devices, when one more subscribes, then it is refused, and a device already held may subscribe again", async () => {
    const server = testServer();
    await newLife(server, "acc-1");
    const devices: TestDevice[] = [];
    for (let count = 0; count < productionConfig.notify.maxDevices; count += 1) devices.push(await testDevice(`d${String(count)}`));
    for (const device of devices) expect((await subscribe(server, "acc-1", device)).status).toBe(200);

    expect((await subscribe(server, "acc-1", await testDevice("one-more"))).status).toBe(400);
    const again = devices[0];
    if (again === undefined) throw new Error("No device.");
    expect((await subscribe(server, "acc-1", again)).status).toBe(200);
  });

  test("[R-CLOCK-031] given two devices, when one is removed, then only the other is kept and the setting stays on", async () => {
    const server = testServer();
    await newLife(server, "acc-1");
    const [one, two] = [await testDevice("a"), await testDevice("b")];
    await subscribe(server, "acc-1", one);
    await subscribe(server, "acc-1", two);

    expect((await request(server, "DELETE", "/api/notify/subscribe", "acc-1", { endpoint: one.json.endpoint })).body).toMatchObject({ ok: true, on: true });

    expect(await server.deps.stores.push.forAccount("acc-1")).toEqual([two.json]);
  });
});

describe("the notice and the account's deletion", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("[R-ACCOUNT-017] [R-CLOCK-031] given an account with two devices, when it is deleted, then its devices go at once with the setting, and none is left after the deletion job", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(epoch);
    const h = harness();
    const { jar, account } = await h.signUp("ada@example.com");
    await h.deps.stores.push.subscribe(account, (await testDevice("a")).json);
    await h.deps.stores.push.subscribe(account, (await testDevice("b")).json);
    await h.deps.stores.account.setNotify(account, true);
    await h.deps.stores.push.subscribe("someone-else", (await testDevice("c")).json);

    expect((await h.call("/api/account", { method: "DELETE", jar, ip: "192.0.2.71" })).status).toBe(200);
    expect(await h.deps.stores.push.forAccount(account)).toEqual([]);
    expect((await h.deps.stores.account.get(account))?.notifyBankFull).toBe(false);

    vi.setSystemTime(epoch + h.deps.config.account.deleteWithinDays * time.DAY_MS);
    expect(await runDeletions(h.deps, h.auth)).toBe(1);
    expect(await h.deps.stores.push.forAccount(account)).toEqual([]);
    expect(await h.deps.stores.push.forAccount("someone-else")).toHaveLength(1);
  });
});
