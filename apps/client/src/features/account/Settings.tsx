// The account settings: the username and its change (R-ACCOUNT-024), the
// reminder and the way to keep a guest life (R-ACCOUNT-027), a passkey once
// the life is kept (R-ACCOUNT-003, 023), any setting the shell places in it,
// sign out, and delete the account (R-ACCOUNT-016) through the server's
// `DELETE /api/account`. Deleting needs a session signed in within the last 10
// minutes; when the server says it is older, the player signs in again or
// sends the code the server's email carries along with the deletion. A guest
// has no other way in, so its own session confirms it. The account opens from its own row at the head of the phone's
// Settings: the name's initial, the name, the username and the way the life is kept, the whole row one tap; its sheet names the username and the name as two plain rows, then the way in and the passkeys
// (R-ACCOUNT-024, R-ACCOUNT-027).
import type { AccountView } from "@japacity/api";
import { ChevronRight } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { useGame } from "../../authority/GameProvider";
import { pageOf } from "../../shared/datapage/PageSheet";
import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { GoogleButton } from "../../shared/ui/GoogleButton";
import { Sheet } from "../../shared/ui/Sheet";
import { say, sayCount } from "../../shared/words/text";
import { counting, setUsageCounts } from "../../shared/analytics/start";
import { CodeForm, failureWords } from "./CodeForm";
import { LegalLinks } from "../../shared/ui/LegalLinks";
import { GuestReminder } from "./Secure";
import { refreshAccount, useAccountView } from "./standing";

/**
 * R-ANALYTICS-006: "Send usage counts", stored on the account and on by
 * default. Off stops the interface counters at once; the server's own game
 * counters go on, as the rule says.
 */
export function UsageCounts({ account }: { account: AccountApi }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void account.usageCounts().then((kept) => {
      if (!live) return;
      const value = kept ?? true;
      setOn(value);
      setUsageCounts(value);
    });
    return () => {
      live = false;
    };
  }, [account]);

  async function change(next: boolean) {
    setBusy(true);
    setProblem(null);
    const saved = await account.setUsageCounts(next);
    setBusy(false);
    if (!saved) return setProblem(say("ui.account.usage.failed"));
    setOn(next);
    setUsageCounts(next);
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="size-5 accent-ink" checked={on ?? true} disabled={on === null || busy} onChange={(event) => void change(event.target.checked)} />
        {say("ui.account.usage")}
      </label>
      <p className="text-sm text-text-2">{say("ui.account.usage.help")}</p>
      {problem === null ? null : (
        <p role="alert" className="text-sm text-bad">
          {problem}
        </p>
      )}
    </div>
  );
}

/** A guest's ways back in: none but its own session (R-ACCOUNT-021). */
const NO_WAYS: AccountView["ways"] = { google: null, email: null, passkeys: 0 };

/** The account's ways back in; none from a server older than `ways`. */
function waysOf(view: AccountView): AccountView["ways"] {
  return (view as Partial<AccountView>).ways ?? NO_WAYS;
}

/**
 * The way the life is kept, in one line (R-ACCOUNT-023, 027): Google by its address where Google is linked, else the
 * email. `full`: the email's address too, as the sheet says it; the row says it short. A guest's life is on this phone.
 */
function keptLine(view: AccountView, full: boolean): string {
  if (view.state === "guest") return say("ui.account.ways.guest");
  const { google, email } = waysOf(view);
  if (google !== null) return say("ui.account.ways.google", { email: google });
  if (email === null) return "";
  return full ? say("ui.account.ways.email", { email }) : say("ui.account.ways.email.short");
}

/** The character's name as given at the door, or "" while there is none. */
function useLifeName(): string {
  const view = useGame((state) => state.view);
  return view === null ? "" : pageOf(view).name;
}

/** A plain labelled row: the label small above the value. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-sm text-text-2">{label}</p>
      <p className="text-[17px] font-bold break-words">{children}</p>
    </div>
  );
}

/** R-ACCOUNT-024: the username, and its change: the first free, then one after each wait the server sets. */
function Username({ account }: { account: AccountApi }) {
  const me = useAccountView();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  if (me === null) return null;
  const waiting = me.renameFrom > Date.now();

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    const answer = await account.rename(name.trim());
    setBusy(false);
    if (!answer.ok) {
      setProblem(answer.why === "unreachable" || answer.why === "refused" ? say(`ui.account.fail.${answer.why}`) : say(`ui.account.name.${answer.why}`, { date: dayOf(me?.renameFrom ?? 0) }));
      return;
    }
    setEditing(false);
    setMessage(say("ui.account.name.changed", { name: name.trim() }));
    void refreshAccount(account);
  }

  return (
    <div className="flex flex-col gap-2" data-username>
      <Row label={say("ui.account.name.label")}>{say("ui.account.name.current", { name: me.username })}</Row>
      {waiting ? <p className="text-sm text-text-2">{say("ui.account.name.wait", { date: dayOf(me.renameFrom) })}</p> : null}
      {!waiting && !editing ? (
        <div className="flex flex-col gap-1">
          <div>
            <Button small onClick={() => (setName(me.username), setEditing(true), setMessage(null))}>
              {say("ui.account.name.change")}
            </Button>
          </div>
          {me.renameFrom === 0 ? <p className="text-sm text-text-2">{say("ui.account.name.free")}</p> : null}
        </div>
      ) : null}
      {editing ? (
        <form className="flex flex-col gap-2" onSubmit={(event) => void save(event)} noValidate>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{say("ui.account.name.label")}</span>
            <input className="min-h-11 rounded-lg border border-sheet-line bg-sheet-2 px-3 text-base" autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={20} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={busy}>
              {say("ui.account.name.change.go")}
            </Button>
            <Button disabled={busy} onClick={() => setEditing(false)}>
              {say("ui.account.delete.keep")}
            </Button>
          </div>
        </form>
      ) : null}
      {message === null ? null : <p role="status">{message}</p>}
      {problem === null ? null : (
        <p role="alert" className="text-bad">
          {problem}
        </p>
      )}
    </div>
  );
}

/** A day as the player reads it, in their own calendar. */
function dayOf(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

type Step = "idle" | "warn" | "confirm";

/** The name given at the door, as its own row beside the username, so the two are never guessed at. */
function LifeName() {
  const name = useLifeName();
  if (name === "") return null;
  return (
    <div data-life-name>
      <Row label={say("ui.account.person.label")}>{name}</Row>
    </div>
  );
}

/** The ways in of a kept life (R-ACCOUNT-027): the way it is kept with its address, and the passkeys held. */
function WaysIn({ view }: { view: AccountView }) {
  if (view.state === "guest") return null;
  const { passkeys } = waysOf(view);
  return (
    <div className="flex flex-col gap-1" data-ways>
      <p>{keptLine(view, true)}</p>
      <p className="text-sm text-text-2" data-passkeys={passkeys}>
        {sayCount("ui.account.passkeys", passkeys, { count: passkeys })}
      </p>
    </div>
  );
}

export function AccountSettings({ account, more = null }: { account: AccountApi; more?: ReactNode }) {
  const leave = useGame((state) => state.leave);
  const me = useAccountView();
  const guest = me?.state === "guest";
  const [leaving, setLeaving] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  async function run(action: () => Promise<AuthResult>, after: (result: AuthResult) => void | Promise<void>) {
    setBusy(true);
    setProblem(null);
    setMessage(null);
    try {
      const result = await action();
      await after(result);
    } finally {
      setBusy(false);
    }
  }

  const gone = () => leave("ui.account.notice.deleted");

  const remove = () =>
    run(
      () => account.deleteAccount(null),
      async (result) => {
        if (result.ok) {
          gone();
          return;
        }
        if (result.why === "not-fresh") {
          setStep("confirm");
          setEmail(await account.email());
          return;
        }
        setProblem(failureWords(result));
      },
    );

  const signOut = async () => {
    setBusy(true);
    await account.signOut();
    leave("ui.account.notice.signed-out");
  };

  return (
    <div className="flex flex-col gap-6">
      <GuestReminder />
      <Username account={account} />
      <LifeName />
      {me === null ? null : <WaysIn view={me} />}
      <div className="flex flex-col gap-2">
        {guest ? null : (
        <div>
        <Button
          disabled={busy}
          onClick={() =>
            void run(
              () => account.addPasskey(),
              (result) => {
                if (!result.ok) return setProblem(failureWords(result));
                setMessage(say("ui.account.passkey.added"));
                // The passkeys held are read again, so the row above counts the new one.
                void refreshAccount(account);
              },
            )
          }
        >
          {say("ui.account.passkey.add")}
        </Button>
        </div>
        )}
        {/* R-ACCOUNT-021: a guest's session is its only way back, so signing out of it is said plainly first. */}
        {guest && !leaving ? (
          <Button disabled={busy} onClick={() => setLeaving(true)}>
            {say("ui.account.sign-out")}
          </Button>
        ) : (
          <>
            {guest ? <p role="alert">{say("ui.guest.sign-out")}</p> : null}
            <Button disabled={busy} onClick={() => void signOut()}>
              {say(guest ? "ui.guest.sign-out.go" : "ui.account.sign-out")}
            </Button>
          </>
        )}
      </div>

      <UsageCounts account={account} />

      {more}

      {/* Each step of leaving settles in where the last stood (R-WORLD-023). */}
      <div key={step} className={`flex flex-col gap-3 border-t border-sheet-line pt-4 ${step === "idle" ? "" : "motion-reveal"}`}>
        {step === "idle" ? (
          <div>
            <Button variant="quiet" disabled={busy} onClick={() => setStep("warn")}>
              {say("ui.account.delete")}
            </Button>
          </div>
        ) : null}
        {step === "warn" ? (
          <>
            <p>{say("ui.account.delete.warn")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={busy} onClick={() => void remove()}>
                {say("ui.account.delete.confirm")}
              </Button>
              <Button disabled={busy} onClick={() => setStep("idle")}>
                {say("ui.account.delete.keep")}
              </Button>
            </div>
          </>
        ) : null}
        {step === "confirm" ? (
          <>
            <p>{say("ui.account.delete.fresh")}</p>
            <Button disabled={busy} onClick={() => void run(() => account.signInWithPasskey(), (result) => (result.ok ? remove() : setProblem(failureWords(result))))}>
              {say("ui.account.passkey")}
            </Button>
            {email === null ? null : (
              <CodeForm
                account={account}
                email={email}
                sendLabel={say("ui.account.delete.code", { email })}
                confirm={(code) => account.deleteAccount(code)}
                goLabel={say("ui.account.delete.code.go")}
                onSignedIn={gone}
              />
            )}
            <GoogleButton label={say("ui.account.google")} disabled={busy} onClick={() => void run(() => account.signInWithGoogle(null), (result) => setProblem(failureWords(result)))} />
            <p className="text-sm text-text-2">{say("ui.account.delete.google")}</p>
            <div>
              <Button disabled={busy} onClick={() => setStep("idle")}>
                {say("ui.account.delete.keep")}
              </Button>
            </div>
          </>
        ) : null}
      </div>

      {message === null ? null : <p role="status">{message}</p>}
      {problem === null ? null : (
        <p role="alert" className="text-bad">
          {problem}
        </p>
      )}

      <LegalLinks />
    </div>
  );
}

/**
 * The way into the account from the phone's Settings: one row in the phone's dress, the whole of it the tap. The name's
 * initial in a round mark, the name and the username on two lines, the way the life is kept under them, and a chevron.
 * Nothing offline, so the phone's Settings shows no empty account then. `more`: another feature's
 * settings, placed by the shell.
 */
export function AccountButton({ more = null }: { more?: ReactNode }) {
  const account = useGame((state) => state.account);
  const me = useAccountView();
  const name = useLifeName();
  const [open, setOpen] = useState(false);
  if (account === null) return null;
  const username = me === null ? "" : say("ui.account.name.current", { name: me.username });
  const initial = (name === "" ? (me?.username ?? "") : name).charAt(0).toUpperCase();
  return (
    <>
      <button
        type="button"
        className="lively-card press mt-1 mb-3 flex w-full items-center gap-3 p-3 text-left"
        onClick={() => {
          counting().count("screen/opened", "settings");
          setOpen(true);
        }}
        data-account-row
      >
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-action text-[20px] font-bold text-action-text">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          {name === "" ? null : <span className="block truncate text-[17px] font-bold">{name}</span>}
          <span className={`block truncate ${name === "" ? "text-[17px] font-bold" : "text-[14px] text-text-2"}`}>{username === "" ? say("ui.account.settings") : username}</span>
          {me === null ? null : <span className="block text-[13px] leading-snug text-text-2">{keptLine(me, false)}</span>}
        </span>
        <ChevronRight size={20} className="shrink-0" aria-hidden />
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={say("ui.account.settings")}>
        <AccountSettings account={account} more={more} />
      </Sheet>
    </>
  );
}
