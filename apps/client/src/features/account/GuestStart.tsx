// The guest start (account:guest-and-secured-states, account:bot-check-on-guest-creation, account:username-and-unconfirmed-email, account:guest-reminded-to-secure, account:start-screen-over-live-city,
// account:username-typed-and-checked). Online, Begin on the page makes the guest life: the username the player typed in a box
// that starts empty, checked with the server while they type, goes to `POST /api/guest` with the token of the bot check
// that ran unseen on the page; Begin's answer is the one that counts. No email and no sign-in method: those come later, when the player keeps the life.
// The guest line is said once, on the page. Inside the invite page, where the card makes the life, the same fields
// stand under the age screen with a button of their own. A bot check that could not load, or that failed in this
// browser, is said as that and not as "try again"; a session lost a second time in a row, or cookies off, is said as a
// browser that keeps no sign-in (account:bot-check-on-guest-creation).
import { USERNAME, USERNAME_LONGEST as LONGEST } from "@japacity/api";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import type { AccountApi, FreeAnswer, GuestFailure } from "../../shared/net/auth";
import { isReported } from "../../shared/net/http";
import { Button } from "../../shared/ui/Button";
import { say } from "../../shared/words/text";
import type { LoadTurnstile } from "./Turnstile";
import { useUnseenCheck } from "./useUnseenCheck";

/** account:username-typed-and-checked: how long the typing rests before the box asks the server whether the name is free. */
export const CHECK_AFTER_MS = 350;

/** What the box says under it for each answer of the check. */
const FREE_WORDS: Record<FreeAnswer, string> = {
  free: "ui.account.name.available",
  taken: "ui.account.name.taken",
  format: "ui.account.name.format",
  reserved: "ui.account.name.reserved",
  blocked: "ui.account.name.blocked",
};

/** How many lost sessions or age answers in a row tell that the browser keeps no sign-in. */
export const LAPSES_TOLD = 2;

/** The browser says it keeps no cookies at all. */
export function cookiesOff(): boolean {
  return typeof navigator !== "undefined" && navigator.cookieEnabled === false;
}

/** What the player is told when the guest start is refused. */
const GUEST_WORDS: Record<GuestFailure, string> = {
  format: "ui.account.name.format",
  reserved: "ui.account.name.reserved",
  blocked: "ui.account.name.blocked",
  taken: "ui.account.name.taken",
  wait: "ui.account.name.format",
  "bot-check": "ui.account.bot.failed",
  "too-many": "ui.account.guest.too-many",
  expired: "ui.account.guest.expired",
  full: "ui.account.guest.full",
  unreachable: "ui.account.fail.unreachable",
  refused: "ui.account.fail.refused",
};

/** Why a username cannot be sent as typed: empty, or not account:username-and-unconfirmed-email's shape. */
function usernameProblem(username: string): string | null {
  if (username.trim() === "") return say("ui.account.name.empty");
  return USERNAME.test(username.trim()) ? null : say("ui.account.name.format");
}

/** The guest start as the page uses it; the door holds the username's text and Begin, the rest is here. */
export interface GuestDoor {
  /** Why the username cannot be sent as typed, or null. */
  check: (username: string) => string | null;
  /** The username field, empty until typed and checked as it is typed, its rule's words, the guest line and the unseen check, for the page. */
  fields: (value: string, onChange: (username: string) => void, problem: string | null) => ReactNode;
  /** Makes the guest life with this username, as typed. Resolves to null once the life is made (or was made already), else to what to say. */
  start: (username: string) => Promise<string | null>;
  /** account:username-typed-and-checked: whether a name is free, as the box asks while the player types. */
  ask: (username: string) => Promise<FreeAnswer | null>;
  /** The unseen check's widget, mounted on the page. */
  widget: ReactNode;
  /** After Begin started the character: the game opens onto it. */
  started: () => Promise<void>;
  /**
   * After Begin made the guest, the character's start failed. When the server said the session is gone, the next
   * Begin makes the guest again and this resolves to what to say; any other failure keeps the guest made, and null.
   */
  lost: (error: unknown) => string | null;
}

export interface GuestDoorOptions {
  account: AccountApi;
  sitekey: string | null;
  load: LoadTurnstile;
  /** The age answer ran out: ask it again. */
  onExpired: () => void;
  /** Sign-ups closed meanwhile: the full screen. */
  onFull: () => void;
  onStarted: () => Promise<void>;
  botWaitMs?: number;
  /** The sessions and age answers found gone in a row so far, and the call that counts one more. */
  lapses?: number;
  onLapse?: () => void;
}

/** What a refused bot check is told as: why the check gave no pass, when the page knows. */
const BOT_WORDS = { unloaded: "ui.account.bot.unloaded", error: "ui.account.bot.error" } as const;

export function useGuestDoor({ account, sitekey, load, onExpired, onFull, onStarted, botWaitMs, lapses = 0, onLapse }: GuestDoorOptions): GuestDoor {
  const check = useUnseenCheck(sitekey, load, botWaitMs);
  // The script is fetched while the door's first screens show, so the widget is up by the page.
  useEffect(() => {
    if (sitekey !== null) load().catch(() => undefined);
  }, [sitekey, load]);
  // Made once: a Begin pressed again after the character failed to start goes straight on, unless the session went with it.
  const made = useRef(false);

  async function once(username: string): Promise<GuestFailure | null> {
    const bot = await check.token();
    const answer = await account.startGuest(username, bot);
    // The server judges the username before the token, so only a request that got past it spent one.
    const nameRefused = !answer.ok && ["format", "reserved", "blocked", "taken", "wait"].includes(answer.why);
    if (bot !== null && !nameRefused) check.spent();
    return answer.ok ? null : answer.why;
  }

  const start = async (username: string): Promise<string | null> => {
    if (made.current) return null;
    const why = await once(username.trim());
    if (why === null) {
      made.current = true;
      return null;
    }
    if (why === "expired") onExpired();
    if (why === "full") onFull();
    const trouble = check.trouble();
    if (why === "bot-check" && trouble !== null) return say(BOT_WORDS[trouble]);
    return say(GUEST_WORDS[why]);
  };

  // Kept the same across renders, so a render while the typing rests does not put the check off again.
  const ask = useCallback((username: string) => account.usernameFree(username), [account]);
  return {
    check: usernameProblem,
    fields: (value, onChange, problem) => <GuestFields value={value} onChange={onChange} problem={problem} ask={ask} widget={check.widget} />,
    start,
    ask,
    widget: check.widget,
    started: onStarted,
    lost: (error) => {
      if (!made.current || !isReported(error) || (error as { reported?: unknown }).reported !== "signed-out") return null;
      made.current = false;
      onLapse?.();
      return say(cookiesOff() || lapses + 1 >= LAPSES_TOLD ? "ui.account.cookies" : "ui.account.guest.lost");
    },
  };
}

const FIELD = "h-12 w-full min-w-0 rounded-[6px] border-2 border-sheet-line bg-sheet-muted px-3 text-[17px] font-bold text-text outline-none focus:border-action";

/**
 * account:username-typed-and-checked: what the box says of the name being typed. Nothing while it is empty; the shape's words for a
 * name not of the rule's shape, with nothing asked; otherwise the server's answer once the typing rests, for the name
 * still in the box. An answer the server could not give says nothing.
 */
function useFreeCheck(value: string, ask: (username: string) => Promise<FreeAnswer | null>): FreeAnswer | null {
  const name = value.trim();
  const shaped = USERNAME.test(name);
  const [heard, setHeard] = useState<{ name: string; answer: FreeAnswer | null } | null>(null);
  useEffect(() => {
    if (!shaped) return;
    let current = true;
    const timer = setTimeout(() => {
      void ask(name).then((answer) => {
        if (current) setHeard({ name, answer });
      });
    }, CHECK_AFTER_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [name, shaped, ask]);
  if (name === "") return null;
  if (!shaped) return "format";
  return heard?.name === name ? heard.answer : null;
}

/** The username on the page, its rule, the check as it is typed, and the guest line said once (account:username-and-unconfirmed-email, account:username-typed-and-checked, account:guest-reminded-to-secure). */
function GuestFields({ value, onChange, problem, ask, widget }: { value: string; onChange: (username: string) => void; problem: string | null; ask: (username: string) => Promise<FreeAnswer | null>; widget: ReactNode }) {
  const free = useFreeCheck(value, ask);
  return (
    <section className="mt-3 flex flex-col" data-guest-fields>
      <label className="label block text-text-2" htmlFor="guest-username">
        {say("ui.account.name.label")}
      </label>
      <input
        id="guest-username"
        className={`mt-1.5 ${FIELD}`}
        value={value}
        maxLength={LONGEST}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-invalid={problem !== null || (free !== null && free !== "free")}
        aria-describedby="guest-username-check guest-username-said"
        onChange={(event) => onChange(event.target.value)}
      />
      {/* Polite, so the answer is heard as the player types; Begin's own refusal below is the alert. */}
      <p id="guest-username-check" role="status" className={`text-[13px] font-bold ${free === null || problem !== null ? "" : "mt-1.5"} ${free === "free" ? "text-action" : "text-text"}`} data-username-check={free ?? ""}>
        {free === null || problem !== null ? null : say(FREE_WORDS[free])}
      </p>
      {problem === null ? (
        <p id="guest-username-said" className="mt-1 text-[12px] text-text-2">
          {say("ui.account.name.intro")}
        </p>
      ) : (
        <p id="guest-username-said" role="alert" className="mt-1.5 text-[13px] font-bold text-text">
          {problem}
        </p>
      )}
      <p className="mt-2 text-[13px] leading-snug" data-guest-line>
        {say("ui.guest.reminder")}
      </p>
      {/* Unseen unless Cloudflare needs a tap (account:start-screen-over-live-city). */}
      {widget}
    </section>
  );
}

export interface GuestFormProps {
  door: GuestDoor;
  onReturning: () => void;
}

/** Inside the invite page: the username and the guest line under the age screen, and a button that starts the guest life. */
export function GuestForm({ door, onReturning }: GuestFormProps) {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function start(event: FormEvent) {
    event.preventDefault();
    const typed = usernameProblem(username);
    if (typed !== null) {
      setProblem(typed);
      return;
    }
    setBusy(true);
    setProblem(null);
    const said = await door.start(username);
    setBusy(false);
    if (said === null) await door.started();
    else setProblem(said);
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => void start(event)} noValidate data-guest-form>
      <GuestFields value={username} onChange={setUsername} problem={problem} ask={door.ask} widget={door.widget} />
      <div>
        <Button type="submit" variant="primary" disabled={busy}>
          {say("ui.account.name.go")}
        </Button>
      </div>
      <div className="border-t border-sheet-line pt-3">
        <Button variant="quiet" onClick={onReturning}>
          {say("ui.account.start.returning")}
        </Button>
      </div>
    </form>
  );
}
