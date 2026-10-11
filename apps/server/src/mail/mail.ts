// How the email codes and the notices leave the server (account.md R-ACCOUNT-014, R-ACCOUNT-002,
// R-ACCOUNT-003). The production provider is the maintainer's to choose; until then every send is refused,
// as it always was. The local stack alone (server.md R-SERVER-038) sets MAIL_TRANSPORT=mailpit: each
// mail is then posted to Mailpit's HTTP send API, since a Worker cannot open SMTP, and the inbox is
// read at Mailpit's page. Mailpit's address must be on this machine, so a stray setting on a
// deployment still sends nothing anywhere.
// https://mailpit.axllent.org/docs/api-v1/view.html#post-/api/v1/send
import type { AuthNotice, OtpMessage } from "../auth/auth";

export const NO_PROVIDER = "No email provider is configured.";
export const NOT_LOCAL = "Mailpit is for the local stack only: MAILPIT_URL must be on this machine.";

/** The bindings the transport is chosen by. */
export interface MailSettings {
  MAIL_TRANSPORT?: string;
  MAILPIT_URL?: string;
}

export interface Mail {
  sendOtp: (message: OtpMessage) => Promise<void>;
  sendNotice: (notice: AuthNotice) => Promise<void>;
}

export type MailFetch = (input: string, init: RequestInit) => Promise<Response>;

/** The words and the one number the mails need: content's text table and the code's life in seconds. */
export interface MailWords {
  text: Record<string, string>;
  codeSeconds: number;
}

/** The sender Mailpit shows. A local name; it never leaves this machine. */
export const LOCAL_SENDER = { Email: "game@localhost", Name: "Japacity" } as const;

const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isLocal(address: string | undefined): boolean {
  if (address === undefined) return false;
  try {
    return LOCAL_HOSTS.has(new URL(address).hostname);
  } catch {
    return false;
  }
}

function words(text: Record<string, string>, key: string, params: Record<string, string>): string {
  const found = text[key];
  if (found === undefined) throw new Error(`No words for ${key}`);
  return found.replace(/\{(\w+)\}/g, (whole, name: string) => params[name] ?? whole);
}

/** The code's mail, its words from content. */
export function codeMail(message: OtpMessage, mail: MailWords): { subject: string; body: string } {
  const params = { code: message.otp, minutes: String(Math.floor(mail.codeSeconds / 60)) };
  return { subject: words(mail.text, "mail.code.subject", params), body: words(mail.text, "mail.code.body", params) };
}

/** R-ACCOUNT-003: the notice's mail. The time is said in UTC, the same for every reader. */
export function noticeMail(notice: AuthNotice, mail: MailWords): { subject: string; body: string } {
  const params = { date: new Date(notice.at).toUTCString() };
  return { subject: words(mail.text, `mail.${notice.kind}.subject`, params), body: words(mail.text, `mail.${notice.kind}.body`, params) };
}

function refuse(why: string): Mail {
  return { sendOtp: () => Promise.reject(new Error(why)), sendNotice: () => Promise.reject(new Error(why)) };
}

async function post(fetch: MailFetch, base: string, to: string, mail: { subject: string; body: string }): Promise<void> {
  const reply = await fetch(new URL("/api/v1/send", base).href, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ From: LOCAL_SENDER, To: [{ Email: to }], Subject: mail.subject, Text: mail.body }),
  });
  if (!reply.ok) throw new Error(`Mailpit refused the mail: ${String(reply.status)}`);
}

/** The transport the bindings name: Mailpit on this machine, or the refusing seam everywhere else. */
export function mailFor(settings: MailSettings, mail: MailWords, fetch: MailFetch): Mail {
  if (settings.MAIL_TRANSPORT !== "mailpit") return refuse(NO_PROVIDER);
  const base = settings.MAILPIT_URL;
  if (base === undefined || !isLocal(base)) return refuse(NOT_LOCAL);
  return {
    sendOtp: (message) => post(fetch, base, message.email, codeMail(message, mail)),
    sendNotice: (notice) => post(fetch, base, notice.email, noticeMail(notice, mail)),
  };
}
