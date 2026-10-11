import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { productionConfig } from "../config";
import { codeMail, LOCAL_SENDER, mailFor, type MailFetch, NO_PROVIDER, NOT_LOCAL } from "./mail";

const WORDS = { text, codeSeconds: productionConfig.auth.otp.expiresIn };
const MAILPIT = "http://localhost:8025";

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
  test("[R-ACCOUNT-014] given MAIL_TRANSPORT=mailpit with Mailpit on this machine, when a code is sent, then it is posted to Mailpit's send API with content's subject and a body naming the code and its minutes", async () => {
    const box = inbox();
    const mail = mailFor({ MAIL_TRANSPORT: "mailpit", MAILPIT_URL: MAILPIT }, WORDS, box.fetch);
    await mail.sendOtp({ email: "ada@example.com", otp: "481516", type: "sign-in" });
    expect(box.sent).toEqual([
      {
        url: `${MAILPIT}/api/v1/send`,
        body: { From: LOCAL_SENDER, To: [{ Email: "ada@example.com" }], Subject: text["mail.code.subject"], Text: expect.stringContaining("481516") as unknown },
      },
    ]);
    expect(codeMail({ email: "ada@example.com", otp: "481516", type: "sign-in" }, WORDS).body).toContain(`${String(productionConfig.auth.otp.expiresIn / 60)} minutes`);
  });

  test("[R-ACCOUNT-003] [R-ACCOUNT-014] given the local transport, when a passkey's notice is sent, then Mailpit gets content's notice with the time in UTC", async () => {
    const box = inbox();
    const mail = mailFor({ MAIL_TRANSPORT: "mailpit", MAILPIT_URL: MAILPIT }, WORDS, box.fetch);
    await mail.sendNotice({ email: "ada@example.com", kind: "passkey-added", at: Date.UTC(2026, 9, 11, 9, 53) });
    expect(box.sent[0]?.body).toMatchObject({ Subject: text["mail.passkey-added.subject"], Text: expect.stringContaining("Sun, 11 Oct 2026 09:53:00 GMT") as unknown });
  });

  test("[R-ACCOUNT-014] given no MAIL_TRANSPORT, as on every deployment until the maintainer picks a provider, when a code or a notice is sent, then the send is refused and nothing is fetched", async () => {
    const box = inbox();
    const mail = mailFor({ MAILPIT_URL: MAILPIT }, WORDS, box.fetch);
    await expect(mail.sendOtp({ email: "ada@example.com", otp: "481516", type: "sign-in" })).rejects.toThrow(NO_PROVIDER);
    await expect(mail.sendNotice({ email: "ada@example.com", kind: "passkey-added", at: 0 })).rejects.toThrow(NO_PROVIDER);
    const other = mailFor({ MAIL_TRANSPORT: "smtp", MAILPIT_URL: MAILPIT }, WORDS, box.fetch);
    await expect(other.sendOtp({ email: "ada@example.com", otp: "481516", type: "sign-in" })).rejects.toThrow(NO_PROVIDER);
    expect(box.sent).toEqual([]);
  });

  test("[R-ACCOUNT-014] given MAIL_TRANSPORT=mailpit with Mailpit's address missing or not on this machine, when a code is sent, then it is refused and nothing is fetched", async () => {
    const box = inbox();
    for (const MAILPIT_URL of [undefined, "https://mail.example.com", "http://10.0.0.5:8025", "not an address"]) {
      const mail = mailFor(MAILPIT_URL === undefined ? { MAIL_TRANSPORT: "mailpit" } : { MAIL_TRANSPORT: "mailpit", MAILPIT_URL }, WORDS, box.fetch);
      await expect(mail.sendOtp({ email: "ada@example.com", otp: "481516", type: "sign-in" })).rejects.toThrow(NOT_LOCAL);
    }
    expect(box.sent).toEqual([]);
  });

  test("[R-ACCOUNT-014] given Mailpit refuses the mail, when a code is sent, then the send rejects", async () => {
    const mail = mailFor({ MAIL_TRANSPORT: "mailpit", MAILPIT_URL: MAILPIT }, WORDS, inbox(500).fetch);
    await expect(mail.sendOtp({ email: "ada@example.com", otp: "481516", type: "sign-in" })).rejects.toThrow("500");
  });

  test("[R-ACCOUNT-014] [R-SERVER-038] given the deployed config, when it is read, then no environment names a mail transport or Mailpit", () => {
    const config = readFileSync(fileURLToPath(new URL("../../wrangler.jsonc", import.meta.url).href), "utf8");
    expect(config).not.toContain("MAIL_TRANSPORT");
    expect(config).not.toContain("MAILPIT");
  });
});
