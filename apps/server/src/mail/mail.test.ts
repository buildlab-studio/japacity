import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { text } from "@japacity/content";
import { afterEach, describe, expect, test, vi } from "vitest";

import { NEW_LIFE_MARK } from "../account/newlife";
import { harness, makeJar } from "../auth/auth.testing";
import { productionConfig } from "../config";
import { type BindingMail, codeMail, LOCAL_SENDER, type MailBinding, mailFor, type MailFetch, NO_PROVIDER, noticeMail, NOT_LOCAL, plainHtml, REFUSED, REPLY_TO, SENDER } from "./mail";

const WORDS = { text, codeSeconds: productionConfig.auth.otp.expiresIn };
const MAILPIT = "http://localhost:8025";

afterEach(() => {
  vi.restoreAllMocks();
});

/** A stand-in for the MAIL binding that keeps what it was given, or throws what a refusal throws. Nothing is sent. */
function binding(refusal?: Error): MailBinding & { given: BindingMail[] } {
  const given: BindingMail[] = [];
  return {
    given,
    send: (message) => {
      given.push(message);
      return refusal === undefined ? Promise.resolve({ messageId: "m-1" }) : Promise.reject(refusal);
    },
  };
}

/** Every console line written while `run` runs, joined, with the console kept quiet. */
async function consoleDuring(run: () => Promise<unknown>): Promise<string> {
  const lines: string[] = [];
  const keep = (...args: unknown[]) => {
    lines.push(args.map((arg) => (arg instanceof Error ? `${arg.name} ${arg.message} ${String(arg.stack)} ${String(arg.cause)}` : typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "));
  };
  for (const method of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, method).mockImplementation(keep);
  await run();
  return lines.join("\n");
}

/** A stand-in for Mailpit's send API that keeps what it was sent. */
function inbox(status = 200): { fetch: MailFetch; sent: { url: string; body: unknown }[] } {
  const sent: { url: string; body: unknown }[] = [];
  return {
    sent,
    fetch: (url, init) => {
      sent.push({ url, body: JSON.parse(typeof init.body === "string" ? init.body : "null") });
      return Promise.resolve(new Response(JSON.stringify({ ID: "m-1" }), { status }));
    },
  };
}

describe("the mail transport", () => {
  test("[account:sign-in-routes-rate-limited] given MAIL_TRANSPORT=mailpit with Mailpit on this machine, when a code is sent, then it is posted to Mailpit's send API with the reply-to, a subject that leads with the code and a body naming the code and its minutes", async () => {
    const box = inbox();
    const mail = mailFor({ MAIL_TRANSPORT: "mailpit", MAILPIT_URL: MAILPIT }, WORDS, box.fetch);
    await mail.sendOtp({ email: "ada@example.com", otp: "481516", type: "sign-in" });
    expect(box.sent).toEqual([
      {
        url: `${MAILPIT}/api/v1/send`,
        body: { From: LOCAL_SENDER, ReplyTo: [{ Email: "hello@japacity.app" }], To: [{ Email: "ada@example.com" }], Subject: "481516 is your Japacity code", Text: expect.stringContaining("481516") as unknown, HTML: expect.stringContaining("481516") as unknown },
      },
    ]);
    expect(codeMail({ email: "ada@example.com", otp: "481516", type: "sign-in" }, WORDS).text).toContain(`${String(productionConfig.auth.otp.expiresIn / 60)} minutes`);
  });

  test("[account:passkey-needs-signed-in-session] [account:sign-in-routes-rate-limited] given the local transport, when a passkey's notice is sent, then Mailpit gets content's notice with the time in UTC and where to remove it", async () => {
    const box = inbox();
    const mail = mailFor({ MAIL_TRANSPORT: "mailpit", MAILPIT_URL: MAILPIT }, WORDS, box.fetch);
    await mail.sendNotice({ email: "ada@example.com", kind: "passkey-added", at: Date.UTC(2026, 9, 11, 9, 53) });
    expect(box.sent[0]?.body).toMatchObject({ Subject: text["mail.passkey-added.subject"], Text: expect.stringContaining("Sun, 11 Oct 2026 09:53:00 GMT") as unknown });
    expect(box.sent[0]?.body).toMatchObject({ Text: expect.stringContaining("to remove it and sign out on every phone") as unknown });
  });

  // A deployment sends through its MAIL binding (decision 0007); one without it sends nothing.
  test("[account:sign-in-routes-rate-limited] given no MAIL_TRANSPORT and no MAIL binding, when a code or a notice is sent, then the send is refused and nothing is fetched", async () => {
    const box = inbox();
    const mail = mailFor({ MAILPIT_URL: MAILPIT }, WORDS, box.fetch);
    await expect(mail.sendOtp({ email: "ada@example.com", otp: "481516", type: "sign-in" })).rejects.toThrow(NO_PROVIDER);
    await expect(mail.sendNotice({ email: "ada@example.com", kind: "passkey-added", at: 0 })).rejects.toThrow(NO_PROVIDER);
    const other = mailFor({ MAIL_TRANSPORT: "smtp", MAILPIT_URL: MAILPIT }, WORDS, box.fetch);
    await expect(other.sendOtp({ email: "ada@example.com", otp: "481516", type: "sign-in" })).rejects.toThrow(NO_PROVIDER);
    expect(box.sent).toEqual([]);
  });

  test("[account:sign-in-routes-rate-limited] given MAIL_TRANSPORT=mailpit with Mailpit's address missing or not on this machine, when a code is sent, then it is refused and nothing is fetched", async () => {
    const box = inbox();
    for (const MAILPIT_URL of [undefined, "https://mail.example.com", "http://10.0.0.5:8025", "not an address"]) {
      const mail = mailFor(MAILPIT_URL === undefined ? { MAIL_TRANSPORT: "mailpit" } : { MAIL_TRANSPORT: "mailpit", MAILPIT_URL }, WORDS, box.fetch);
      await expect(mail.sendOtp({ email: "ada@example.com", otp: "481516", type: "sign-in" })).rejects.toThrow(NOT_LOCAL);
    }
    expect(box.sent).toEqual([]);
  });

  test("[account:sign-in-routes-rate-limited] given Mailpit refuses the mail, when a code is sent, then the send rejects", async () => {
    const mail = mailFor({ MAIL_TRANSPORT: "mailpit", MAILPIT_URL: MAILPIT }, WORDS, inbox(500).fetch);
    await expect(mail.sendOtp({ email: "ada@example.com", otp: "481516", type: "sign-in" })).rejects.toThrow("500");
  });

  test("[account:sign-in-routes-rate-limited] [server:production-and-staging] given MAIL_TRANSPORT=mailpit on the local stack, where wrangler dev also binds MAIL, when a code is sent, then Mailpit gets it and the binding is never called; a Mailpit off this machine is refused, never handed to the binding", async () => {
    const box = inbox();
    const mail = binding();
    await mailFor({ MAIL_TRANSPORT: "mailpit", MAILPIT_URL: MAILPIT, MAIL: mail }, WORDS, box.fetch).sendOtp({ email: "ada@example.com", otp: "481516", type: "sign-in" });
    expect(box.sent).toHaveLength(1);
    const stray = mailFor({ MAIL_TRANSPORT: "mailpit", MAILPIT_URL: "https://mail.example.com", MAIL: mail }, WORDS, box.fetch);
    await expect(stray.sendOtp({ email: "ada@example.com", otp: "481516", type: "sign-in" })).rejects.toThrow(NOT_LOCAL);
    expect(mail.given).toEqual([]);
    expect(box.sent).toHaveLength(1);
  });

  test("[account:sign-in-routes-rate-limited] [server:production-and-staging] given the deployed config, when it is read, then no environment names a mail transport or Mailpit", () => {
    const config = readFileSync(fileURLToPath(new URL("../../wrangler.jsonc", import.meta.url).href), "utf8");
    expect(config).not.toContain("MAIL_TRANSPORT");
    expect(config).not.toContain("MAILPIT");
  });
});

describe("Cloudflare Email Service, the MAIL binding (decision 0007)", () => {
  test("[account:sign-in-routes-rate-limited] [account:email-code-is-short-lived] given the MAIL binding and no MAIL_TRANSPORT, as on a deployment, when a code is sent, then the binding gets one mail from the game's one sender, replies to the monitored inbox, to the one address, with a subject that leads with the code and a text part and an HTML part that both say the code, and nothing is fetched", async () => {
    const box = inbox();
    for (const MAIL_TRANSPORT of [undefined, "", "smtp"]) {
      const mail = binding();
      const settings = MAIL_TRANSPORT === undefined ? { MAIL: mail } : { MAIL_TRANSPORT, MAIL: mail };
      await mailFor(settings, WORDS, box.fetch).sendOtp({ email: "ada@example.com", otp: "481516", type: "sign-in" });
      const letter = codeMail({ email: "ada@example.com", otp: "481516", type: "sign-in" }, WORDS);
      expect(mail.given).toEqual([{ from: { email: "game@mail.japacity.app", name: "Japacity" }, replyTo: "hello@japacity.app", to: "ada@example.com", subject: "481516 is your Japacity code", text: letter.text, html: letter.html }]);
      expect(letter.text).toContain("481516");
      expect(letter.html).toContain("<p>Your code is 481516.");
    }
    expect(box.sent).toEqual([]);
  });

  test("[account:passkey-needs-signed-in-session] [account:sign-in-routes-rate-limited] given the MAIL binding, when a passkey's notice is sent, then the binding gets content's notice from the one sender with the same reply-to, the time in UTC in both parts", async () => {
    const mail = binding();
    const notice = { email: "ada@example.com", kind: "passkey-added", at: Date.UTC(2026, 9, 11, 9, 53) } as const;
    await mailFor({ MAIL: mail }, WORDS, inbox().fetch).sendNotice(notice);
    const letter = noticeMail(notice, WORDS);
    expect(mail.given).toEqual([{ from: SENDER, replyTo: REPLY_TO, to: "ada@example.com", subject: text["mail.passkey-added.subject"], text: letter.text, html: letter.html }]);
    expect(letter.text).toContain("Sun, 11 Oct 2026 09:53:00 GMT");
    expect(letter.html).toContain("Sun, 11 Oct 2026 09:53:00 GMT");
  });

  test("[account:sign-in-routes-rate-limited] given a mail's words, when its HTML part is made, then it is the text's paragraphs as plain paragraphs, escaped, with no picture, link, style or script", () => {
    expect(plainHtml("One <b>&</b> two.\nStill one.\n\nThree.")).toBe('<!doctype html><html lang="en"><body><p>One &lt;b&gt;&amp;&lt;/b&gt; two.<br>Still one.</p><p>Three.</p></body></html>');
    for (const letter of [codeMail({ email: "ada@example.com", otp: "481516", type: "sign-in" }, WORDS), noticeMail({ email: "ada@example.com", kind: "passkey-added", at: 0 }, WORDS)]) {
      expect(letter.html).not.toMatch(/<(img|a|style|script|link)\b/);
      expect(letter.text).not.toContain("<");
    }
  });

  test("[account:sign-in-routes-rate-limited] [server:secrets-stay-on-server] given the binding refuses a send with its error code and a message naming the address, when a code is sent, then the send rejects with the code alone: no address, no code, no chained error, and nothing is written to the console; an error with no code of that shape rejects with no code at all", async () => {
    const refusal = Object.assign(new Error("Recipient ada@example.com is suppressed"), { code: "E_RECIPIENT_SUPPRESSED" });
    const mail = mailFor({ MAIL: binding(refusal) }, WORDS, inbox().fetch);
    let thrown: unknown;
    const logged = await consoleDuring(async () => {
      thrown = await mail.sendOtp({ email: "ada@example.com", otp: "481516", type: "sign-in" }).catch((error: unknown) => error);
    });
    expect(thrown).toBeInstanceOf(Error);
    const error = thrown as Error;
    expect(error.message).toBe(`${REFUSED}: E_RECIPIENT_SUPPRESSED`);
    expect(error.cause).toBeUndefined();
    expect(`${error.message} ${String(error.stack)}`).not.toMatch(/ada@|example\.com|481516/);
    expect(logged).toBe("");
    for (const odd of [new Error("ada@example.com"), Object.assign(new Error("ada@example.com"), { code: "ada@example.com" }), Object.assign(new Error("ada@example.com"), { code: 42 })]) {
      await expect(mailFor({ MAIL: binding(odd) }, WORDS, inbox().fetch).sendNotice({ email: "ada@example.com", kind: "passkey-added", at: 0 })).rejects.toThrow(new Error(`${REFUSED}.`));
    }
  });

  test("[account:email-code-is-short-lived] [account:sign-in-routes-rate-limited] [server:secrets-stay-on-server] given the binding refuses, when a code is asked for through the auth library's route, then the route answers as for any failed send (200, the send left to the background), the background task settles, and no console line carries the address or the code", async () => {
    const mail = mailFor({ MAIL: binding(Object.assign(new Error("Recipient ada@example.com refused"), { code: "E_DELIVERY_FAILED" })) }, WORDS, inbox().fetch);
    const h = harness({ sendOtp: mail.sendOtp });
    const jar = makeJar();
    let reply: Response | undefined;
    const logged = await consoleDuring(async () => {
      // No account uses the address, so the send carries a new life's mark (account:sign-in-without-secret).
      reply = await h.call("/api/auth/email-otp/send-verification-otp", { method: "POST", jar, json: { email: "ada@example.com", type: "sign-in", [NEW_LIFE_MARK]: true } });
      await Promise.all(h.background);
    });
    expect(reply?.status).toBe(200);
    expect(await reply?.json()).toEqual({ success: true });
    expect(h.sent).toHaveLength(1);
    const code = h.sent[0]?.otp ?? "";
    expect(code).toMatch(/^\d{6}$/);
    expect(logged).toContain(`${REFUSED}: E_DELIVERY_FAILED`);
    expect(logged).not.toContain("ada@");
    expect(logged).not.toContain(code);
  });

  test("[account:sign-in-routes-rate-limited] [server:production-and-staging] given the deployed config, when it is read, then production and staging each bind MAIL to Email Service allowed the game's one sender alone, the same address as the seam's SENDER", () => {
    const raw = readFileSync(fileURLToPath(new URL("../../wrangler.jsonc", import.meta.url).href), "utf8");
    type Worker = { send_email?: unknown; env?: Record<string, { send_email?: unknown }> };
    const config = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, "")) as Worker;
    const bound = [{ name: "MAIL", allowed_sender_addresses: [SENDER.email] }];
    expect(config.send_email).toEqual(bound);
    expect(config.env?.["staging"]?.send_email).toEqual(bound);
    expect(SENDER).toEqual({ email: "game@mail.japacity.app", name: "Japacity" });
    expect(REPLY_TO).toBe("hello@japacity.app");
  });
});
