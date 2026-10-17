// The guest start (R-ACCOUNT-021, 013, 024, 027, 029). Online, Begin on the page makes the guest life: the username,
// filled in from the name on the page and changed there, goes to `POST /api/guest` with the token of the bot check
// that ran unseen on the page. No email and no sign-in method: those come later, when the player keeps the life.
// The guest line is said once, on the page. Inside the invite page, where the card makes the life, the same fields
// stand under the age screen with a button of their own.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import type { AccountApi, GuestFailure } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { say } from "../../shared/words/text";
import type { LoadTurnstile } from "./Turnstile";
import { useUnseenCheck } from "./unseenCheck";

/** R-ACCOUNT-024's shape, as the server holds it (apps/server/src/account/username.ts); the lists stay the server's. */
const USERNAME = /^[A-Za-z0-9_]{3,20}$/;
const LONGEST = 20;
const SHORTEST = 3;

/** How many digits a filled-in username gains when the plain one is taken. */
const TAKEN_DIGITS = 3;

/** The username a name on the page fills in: its letters and digits, the words joined by underscores. */
export function usernameFrom(name: string): string {
  const plain = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, LONGEST)
    .replace(/_+$/, "");
  if (plain.length >= SHORTEST) return plain;
  return plain === "" ? "player" : `${plain}_${"0".repeat(SHORTEST - 1)}`;
}

/** A filled-in username with digits after it, cut so the whole stays within the longest. */
export function withDigits(username: string, digits: string): string {
  return `${username.slice(0, LONGEST - digits.length - 1).replace(/_+$/, "")}_${digits}`;
}

function someDigits(): string {
  return String(Math.floor(Math.random() * 10 ** TAKEN_DIGITS)).padStart(TAKEN_DIGITS, "0");
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

/** Why a username cannot be sent as typed: empty, or not R-ACCOUNT-024's shape. */
function usernameProblem(username: string): string | null {
  if (username.trim() === "") return say("ui.account.name.empty");
  return USERNAME.test(username.trim()) ? null : say("ui.account.name.format");
}

/** The guest start as the page uses it; the door holds the username's text and Begin, the rest is here. */
export interface GuestDoor {
  /** The username a name fills in. */
  fill: (name: string) => string;
  /** Why the username cannot be sent as typed, or null. */
  check: (username: string) => string | null;
  /** The username field, its rule's words, the guest line and the unseen check, for the page. */
  fields: (value: string, onChange: (username: string) => void, problem: string | null) => ReactNode;
  /**
   * Makes the guest life with this username. `filled`: the page filled it in, so a taken one may gain digits
   * once. Resolves to null once the life is made (or was made already), else to what to say.
   */
  start: (username: string, filled: boolean) => Promise<string | null>;
  /** The unseen check's widget, mounted on the page. */
  widget: ReactNode;
  /** After Begin started the character: the game opens onto it. */
  started: () => Promise<void>;
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
}

export function useGuestDoor({ account, sitekey, load, onExpired, onFull, onStarted, botWaitMs }: GuestDoorOptions): GuestDoor {
  const check = useUnseenCheck(sitekey, load, botWaitMs);
  // The script is fetched while the door's first screens show, so the widget is up by the page.
  useEffect(() => {
    if (sitekey !== null) load().catch(() => undefined);
  }, [sitekey, load]);
  // Made once: a Begin pressed again after the character failed to start goes straight on.
  const made = useRef(false);

  async function once(username: string): Promise<GuestFailure | null> {
    const bot = await check.token();
    const answer = await account.startGuest(username, bot);
    // The server judges the username before the token, so only a request that got past it spent one.
    const nameRefused = !answer.ok && ["format", "reserved", "blocked", "taken", "wait"].includes(answer.why);
    if (bot !== null && !nameRefused) check.spent();
    return answer.ok ? null : answer.why;
  }

  const start = async (username: string, filled: boolean): Promise<string | null> => {
    if (made.current) return null;
    let why = await once(username.trim());
    if (why === "taken" && filled) why = await once(withDigits(username.trim(), someDigits()));
    if (why === null) {
      made.current = true;
      return null;
    }
    if (why === "expired") onExpired();
    if (why === "full") onFull();
    return say(GUEST_WORDS[why]);
  };

  return {
    fill: usernameFrom,
    check: usernameProblem,
    fields: (value, onChange, problem) => <GuestFields value={value} onChange={onChange} problem={problem} widget={check.widget} />,
    start,
    widget: check.widget,
    started: onStarted,
  };
}

const FIELD = "h-12 w-full min-w-0 rounded-[6px] border-2 border-sheet-line bg-sheet-muted px-3 text-[17px] font-bold text-text outline-none focus:border-action";

/** The username on the page, its rule, and the guest line said once (R-ACCOUNT-024, R-ACCOUNT-027). */
function GuestFields({ value, onChange, problem, widget }: { value: string; onChange: (username: string) => void; problem: string | null; widget: ReactNode }) {
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
        aria-invalid={problem !== null}
        aria-describedby="guest-username-said"
        onChange={(event) => onChange(event.target.value)}
      />
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
      {/* Unseen unless Cloudflare needs a tap (R-ACCOUNT-029). */}
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
    const said = await door.start(username, false);
    setBusy(false);
    if (said === null) await door.started();
    else setProblem(said);
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => void start(event)} noValidate data-guest-form>
      <GuestFields value={username} onChange={setUsername} problem={problem} widget={door.widget} />
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
