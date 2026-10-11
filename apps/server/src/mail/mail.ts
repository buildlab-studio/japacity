// How the email codes and the notices leave the server (account.md R-ACCOUNT-014, R-ACCOUNT-002,
// R-ACCOUNT-003). The transport is chosen in this order. The local stack alone (server.md R-SERVER-038)
// sets MAIL_TRANSPORT=mailpit: each mail is then posted to Mailpit's HTTP send API, since a Worker
// cannot open SMTP, and the inbox is read at Mailpit's page; Mailpit's address must be on this machine,
// so a stray setting on a deployment still sends nothing anywhere. Otherwise a deployment with the MAIL
// binding sends through Cloudflare Email Service (decision 0031), from the game's one sender only. With
// neither, every send is refused, as it always was.
// https://mailpit.axllent.org/docs/api-v1/view.html#post-/api/v1/send
// https://developers.cloudflare.com/email-service/api/send-emails/workers-api/
import type { AuthNotice, OtpMessage } from "../auth/auth";

export const NO_PROVIDER = "No email provider is configured.";
export const NOT_LOCAL = "Mailpit is for the local stack only: MAILPIT_URL must be on this machine.";
/** What a refused send says: the binding's error code at most, never its message, which may name the address. */
export const REFUSED = "Email Service refused the mail";

/**
 * The game's one sender (decision 0031): the address is the maintainer's pick. The MAIL
 * binding in wrangler.jsonc allows this address alone (`allowed_sender_addresses`), and a test holds the two equal.
 */
export const SENDER = { email: "game@mail.japacity.app", name: "Japacity" } as const;
/** Where a reply to any game mail goes: a monitored inbox, since the sending subdomain has none. */
export const REPLY_TO = "hello@japacity.app";

/** One mail as the binding takes it: the structured form, both parts, one recipient. */
export interface BindingMail {
  from: { email: string; name: string };
  replyTo: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** The part of the `send_email` binding the seam uses (`SendEmail` in @cloudflare/workers-types). */
export interface MailBinding {
  send: (message: BindingMail) => Promise<{ messageId: string }>;
}

/** The bindings the transport is chosen by. */
export interface MailSettings {
  MAIL_TRANSPORT?: string;
  MAILPIT_URL?: string;
  /** Decision 0031: Cloudflare Email Service's `send_email` binding, on the deployments. */
  MAIL?: MailBinding;
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

/** One mail's words: the subject, the text part and the HTML part, which says the same plainly. */
export interface Letter {
  subject: string;
  text: string;
  html: string;
}

/** The sender Mailpit shows. A local name; it never leaves this machine. */
export const LOCAL_SENDER = { Email: "game@localhost", Name: "Japacity" } as const;

const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** An Email Service error code, as the binding throws it (`E_RATE_LIMIT_EXCEEDED` and the like). */
const ERROR_CODE = /^E_[A-Z_]{1,64}$/;

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

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** The HTML part: the text's paragraphs as paragraphs, and nothing else (no picture, no link, no style). */
export function plainHtml(text: string): string {
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`);
  return `<!doctype html><html lang="en"><body>${paragraphs.join("")}</body></html>`;
}

function letter(subject: string, text: string): Letter {
  return { subject, text, html: plainHtml(text) };
}

/** The code's mail, its words from content. */
export function codeMail(message: OtpMessage, mail: MailWords): Letter {
  const params = { code: message.otp, minutes: String(Math.floor(mail.codeSeconds / 60)) };
  return letter(words(mail.text, "mail.code.subject", params), words(mail.text, "mail.code.body", params));
}

/** R-ACCOUNT-003: the notice's mail. The time is said in UTC, the same for every reader. */
export function noticeMail(notice: AuthNotice, mail: MailWords): Letter {
  const params = { date: new Date(notice.at).toUTCString() };
  return letter(words(mail.text, `mail.${notice.kind}.subject`, params), words(mail.text, `mail.${notice.kind}.body`, params));
}

function refuse(why: string): Mail {
  return { sendOtp: () => Promise.reject(new Error(why)), sendNotice: () => Promise.reject(new Error(why)) };
}

async function post(fetch: MailFetch, base: string, to: string, mail: Letter): Promise<void> {
  const reply = await fetch(new URL("/api/v1/send", base).href, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ From: LOCAL_SENDER, ReplyTo: [{ Email: REPLY_TO }], To: [{ Email: to }], Subject: mail.subject, Text: mail.text, HTML: mail.html }),
  });
  if (!reply.ok) throw new Error(`Mailpit refused the mail: ${String(reply.status)}`);
}

/** The binding's error code when it gave one we know the shape of; nothing else of what it threw. */
function errorCode(thrown: unknown): string | null {
  if (typeof thrown !== "object" || thrown === null || !("code" in thrown)) return null;
  const { code } = thrown;
  return typeof code === "string" && ERROR_CODE.test(code) ? code : null;
}

/**
 * Sends one mail through the binding. A refusal throws a new error that carries only the binding's error
 * code (R-SERVER-015: the auth library logs what a background send throws, so neither the address nor the
 * code may be in it); the original error is dropped, not chained, since its message may name the address.
 */
async function send(binding: MailBinding, to: string, mail: Letter): Promise<void> {
  const refused = await binding.send({ from: { ...SENDER }, replyTo: REPLY_TO, to, subject: mail.subject, text: mail.text, html: mail.html }).then(
    () => null,
    (thrown: unknown) => ({ code: errorCode(thrown) }),
  );
  if (refused === null) return;
  throw new Error(refused.code === null ? `${REFUSED}.` : `${REFUSED}: ${refused.code}`);
}

/** The transport the bindings name: Mailpit on this machine, else the MAIL binding when bound, else the refusing seam. */
export function mailFor(settings: MailSettings, mail: MailWords, fetch: MailFetch): Mail {
  if (settings.MAIL_TRANSPORT === "mailpit") {
    const base = settings.MAILPIT_URL;
    if (base === undefined || !isLocal(base)) return refuse(NOT_LOCAL);
    return {
      sendOtp: (message) => post(fetch, base, message.email, codeMail(message, mail)),
      sendNotice: (notice) => post(fetch, base, notice.email, noticeMail(notice, mail)),
    };
  }
  const binding = settings.MAIL;
  if (binding === undefined) return refuse(NO_PROVIDER);
  return {
    sendOtp: (message) => send(binding, message.email, codeMail(message, mail)),
    sendNotice: (notice) => send(binding, notice.email, noticeMail(notice, mail)),
  };
}
