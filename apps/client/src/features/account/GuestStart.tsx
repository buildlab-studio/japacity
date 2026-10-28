// The guest start (account:guest-and-secured-states, account:bot-check-on-guest-creation, account:username-and-unconfirmed-email, account:guest-reminded-to-secure, account:start-screen-over-live-city,
// account:username-typed-and-checked). Online, Begin on the page makes the guest life: the username the player typed in a box
// that starts empty, checked with the server while they type, goes to `POST /api/guest` with the token of the bot check
// that ran unseen on the page; Begin's answer is the one that counts. No email and no sign-in method: those come later, when the player keeps the life.
// The guest line is said once, on the page. Inside the invite page, where the card makes the life, the same fields
// stand under the age screen with a button of their own. A bot check that could not load, or that failed in this
// browser, is said as that and not as "try again"; a session lost a second time in a row, or cookies off, is said as a
// browser that keeps no sign-in (account:bot-check-on-guest-creation).
import { USERNAME, USERNAME_LONGEST as LONGEST } from "@japacity/api";
import { Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";

import type { AccountApi, FreeAnswer, GuestFailure, NewLifeEmail } from "../../shared/net/auth";
import { isReported } from "../../shared/net/http";
import { Button } from "../../shared/ui/Button";
import { say } from "../../shared/words/text";
import type { LoadTurnstile } from "./Turnstile";
import { useUnseenCheck } from "./useUnseenCheck";

/** account:username-typed-and-checked: how long the typing rests before the box asks the server whether the name is free. */
export const CHECK_AFTER_MS = 350;

/** What the box says under it for each answer of the check: the door's box and the rename box in Settings alike. */
export const FREE_WORDS: Record<FreeAnswer, string> = {
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

/** The guest start's refusals that are about the name itself, which the player fixes in the box (account:username-typed-and-checked). */
const NAME_REFUSALS: readonly GuestFailure[] = ["format", "reserved", "blocked", "taken", "wait"];

/**
 * account:username-typed-and-checked: a Begin refused brings the box into view with its reason under it, and, when the name is the
 * reason, focuses it. Centred, so the reason under the box stays in view with a phone's keyboard up; a refusal that is not
 * the name's leaves the focus where it was, so no keyboard rises over it.
 */
function bringBoxIntoView(box: HTMLInputElement | null, focus: boolean): void {
  if (box === null) return;
  if (focus) box.focus({ preventScroll: true });
  if (typeof box.scrollIntoView === "function") box.scrollIntoView({ block: "center" });
}

/** Enter as the player means it: not while a word is being composed, and with no modifier held. */
function plainEnter(event: KeyboardEvent<HTMLInputElement>): boolean {
  return event.key === "Enter" && !event.nativeEvent.isComposing && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;
}

/** Why a username cannot be sent as typed: empty, or not account:username-and-unconfirmed-email's shape. */
function usernameProblem(username: string): string | null {
  if (username.trim() === "") return say("ui.account.name.empty");
  return USERNAME.test(username.trim()) ? null : say("ui.account.name.format");
}

/** The guest start as the page uses it; the door holds the username's text and Begin, the rest is here. */
export interface GuestDoor {
  /** Why the username cannot be sent as typed, or null. */
  check: (username: string) => string | null;
  /** The username field, empty until typed and checked as it is typed, its rule's words, the guest line and the unseen check, for the page; Enter in it is `onEnter`. */
  fields: (value: string, onChange: (username: string) => void, problem: string | null, onEnter?: () => void) => ReactNode;
  /** account:username-typed-and-checked: a Begin refused for the name as typed brings the box into view and focuses it. */
  reveal: () => void;
  /** The username box, for the page that holds it. */
  box: RefObject<HTMLInputElement | null>;
  /** The life starts kept by a proved email (account:guest-secures-the-life): the guest line is not said. */
  kept?: boolean;
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
  /** The life is made: with the email it was born kept by, or the word that an account took that address meanwhile (account:guest-secures-the-life). */
  onStarted: (email: NewLifeEmail | null) => Promise<void>;
  botWaitMs?: number;
  /** The sessions and age answers found gone in a row so far, and the call that counts one more. */
  lapses?: number;
  onLapse?: () => void;
  /** This browser holds a proof of a new life's address: the life starts kept (account:guest-secures-the-life). */
  kept?: boolean;
}

/** What a refused bot check is told as: why the check gave no pass, when the page knows. */
const BOT_WORDS = { unloaded: "ui.account.bot.unloaded", error: "ui.account.bot.error" } as const;

export function useGuestDoor({ account, sitekey, load, onExpired, onFull, onStarted, botWaitMs, lapses = 0, onLapse, kept = false }: GuestDoorOptions): GuestDoor {
  const check = useUnseenCheck(sitekey, load, botWaitMs);
  // The script is fetched while the door's first screens show, so the widget is up by the page.
  useEffect(() => {
    if (sitekey !== null) load().catch(() => undefined);
  }, [sitekey, load]);
  // Made once: a Begin pressed again after the character failed to start goes straight on, unless the session went with it.
  const made = useRef(false);
  // What the guest start said of a proved address (account:guest-secures-the-life), for the line over the world.
  const email = useRef<NewLifeEmail | null>(null);
  const box = useRef<HTMLInputElement | null>(null);

  async function once(username: string): Promise<GuestFailure | null> {
    const bot = await check.token();
    const answer = await account.startGuest(username, bot);
    // The server judges the username before the token, so only a request that got past it spent one.
    const nameRefused = !answer.ok && ["format", "reserved", "blocked", "taken", "wait"].includes(answer.why);
    if (bot !== null && !nameRefused) check.spent();
    if (answer.ok) email.current = answer.email ?? null;
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
    // The age screen or the full screen takes the page's place for those two; every other refusal is said under the box.
    if (why !== "expired" && why !== "full") bringBoxIntoView(box.current, NAME_REFUSALS.includes(why));
    const trouble = check.trouble();
    if (why === "bot-check" && trouble !== null) return say(BOT_WORDS[trouble]);
    return say(GUEST_WORDS[why]);
  };

  // Kept the same across renders, so a render while the typing rests does not put the check off again.
  const ask = useCallback((username: string) => account.usernameFree(username), [account]);
  return {
    check: usernameProblem,
    fields: (value, onChange, problem, onEnter) => <GuestFields box={box} value={value} onChange={onChange} problem={problem} ask={ask} widget={check.widget} kept={kept} {...(onEnter === undefined ? {} : { onEnter })} />,
    reveal: () => bringBoxIntoView(box.current, true),
    box,
    kept,
    start,
    ask,
    widget: check.widget,
    started: () => onStarted(email.current),
    lost: (error) => {
      if (!made.current || !isReported(error) || (error as { reported?: unknown }).reported !== "signed-out") return null;
      made.current = false;
      onLapse?.();
      return say(cookiesOff() || lapses + 1 >= LAPSES_TOLD ? "ui.account.cookies" : "ui.account.guest.lost");
    },
  };
}

const FIELD = "h-12 w-full min-w-0 rounded-[6px] border-2 border-sheet-line bg-sheet-muted px-3 text-[17px] font-bold text-text focus:border-action";

/**
 * account:username-typed-and-checked: what the box says of the name being typed. Nothing while it is empty; the shape's words for a
 * name not of the rule's shape, with nothing asked; otherwise the server's answer once the typing rests, for the name
 * still in the box. An answer the server could not give says nothing. `own`, in the rename box: the player's current
 * name, in any capitals, which is neither free nor taken and is never asked.
 */
export function useFreeCheck(value: string, ask: (username: string) => Promise<FreeAnswer | null>, own: string | null = null): FreeAnswer | null {
  const name = value.trim();
  const shaped = USERNAME.test(name);
  const theirs = own !== null && name.toLowerCase() === own.toLowerCase();
  const [heard, setHeard] = useState<{ name: string; answer: FreeAnswer | null } | null>(null);
  useEffect(() => {
    if (!shaped || theirs) return;
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
  }, [name, shaped, theirs, ask]);
  if (name === "" || theirs) return null;
  if (!shaped) return "format";
  return heard?.name === name ? heard.answer : null;
}

/**
 * The username on the page, its rule, the check as it is typed, and the guest line said once (account:username-and-unconfirmed-email,
 * account:username-typed-and-checked, account:guest-reminded-to-secure); a life that starts kept by a proved email says no guest line
 * and nothing in its place (account:guest-secures-the-life).
 */
function GuestFields({ box, value, onChange, onEnter, problem, ask, widget, kept = false }: { box: RefObject<HTMLInputElement | null>; value: string; onChange: (username: string) => void; onEnter?: () => void; problem: string | null; ask: (username: string) => Promise<FreeAnswer | null>; widget: ReactNode; kept?: boolean }) {
  const free = useFreeCheck(value, ask);
  return (
    <section className="mt-3 flex flex-col" data-guest-fields>
      <label className="label block text-text-2" htmlFor="guest-username">
        {say("ui.account.name.label")}
      </label>
      <input
        ref={box}
        id="guest-username"
        className={`mt-1.5 ${FIELD}`}
        enterKeyHint="go"
        value={value}
        maxLength={LONGEST}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-invalid={problem !== null || (free !== null && free !== "free")}
        aria-describedby="guest-username-check guest-username-said"
        onChange={(event) => onChange(event.target.value)}
        // account:username-typed-and-checked: Enter in the box is Begin; inside the invite page's form it submits on its own.
        onKeyDown={(event) => {
          if (onEnter === undefined || !plainEnter(event)) return;
          event.preventDefault();
          onEnter();
        }}
      />
      {/* Polite, so the answer is heard as the player types; Begin's own refusal below is the alert. */}
      {/* A free name in money in's green with a tick, read on the sheet by day and by night (world:reach-and-read). */}
      <p id="guest-username-check" role="status" className={`text-[13px] font-bold ${free === null || problem !== null ? "" : "mt-1.5"} ${free === "free" ? "text-in" : "text-text"}`} data-username-check={free ?? ""}>
        {free === "free" && problem === null ? <Check size={14} strokeWidth={3} className="mr-1 inline-block align-[-2px]" aria-hidden /> : null}
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
      {kept ? null : (
        <p className="mt-2 text-[13px] leading-snug" data-guest-line>
          {say("ui.guest.reminder")}
        </p>
      )}
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
      door.reveal();
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
      <GuestFields box={door.box} value={username} onChange={setUsername} problem={problem} ask={door.ask} widget={door.widget} kept={door.kept === true} />
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
