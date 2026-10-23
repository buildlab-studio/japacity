// The account settings: the username and its change (account:username-and-unconfirmed-email), the
// reminder and the way to keep a guest life (account:guest-reminded-to-secure), the passkeys once
// the life is kept (PasskeyList, account:passkeys-listed-and-removed, account:guest-secures-the-life), any setting the shell places in it,
// sign out here or on every phone (account:sign-out-ends-the-session), and delete the account (account:player-deletes-account) through the server's
// `DELETE /api/account`. Deleting needs a session signed in within the last 10
// minutes; when the server says it is older, the player signs in again with one of the account's own passkeys or
// sends the code the server's email carries along with the deletion. A guest
// has no other way in, so its own session confirms it. The account opens from its own row at the head of the phone's
// Settings (AccountButton.tsx); its sheet names the username and the name as two plain rows, then the way in and the passkeys
// (account:username-and-unconfirmed-email, account:guest-reminded-to-secure). This file is the sheet: it and its words (content's
// ui/ui.accountSheet.text.ts) ride a chunk of their own, fetched by the row (engine:first-download-has-budget).
import type { AccountView } from "@japacity/api";
import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from "react";

import { useGame } from "../../authority/GameProvider";
import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { GoogleButton } from "../../shared/ui/GoogleButton";
import { say } from "../../shared/words/text";
import { setUsageCounts } from "../../shared/analytics/start";
import { keptLine, NO_WAYS, useLifeName, waysOf } from "./AccountButton";
import { CodeForm, failureWords } from "./CodeForm";
import { markDeleteTrip } from "./marks";
import { FREE_WORDS, useFreeCheck } from "./GuestStart";
import { LegalLinks } from "../../shared/ui/LegalLinks";
import { PasskeyList, usePasskeysWork } from "./PasskeyList";
import { GuestReminder } from "./Secure";
import { refreshAccount, useAccountView } from "./standing";

/**
 * analytics:player-can-stop-usage-counts: "Send usage counts", stored on the account and on by
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

/** A plain labelled row: the label small above the value. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-sm text-text-2">{label}</p>
      <p className="text-[17px] font-bold break-words">{children}</p>
    </div>
  );
}

/**
 * account:username-typed-and-checked: the rename box says whether the name being typed is free, with the door's own check;
 * saving is the check that counts, so once it refuses, its words stand alone.
 */
function RenameCheck({ id, account, name, own, quiet }: { id: string; account: AccountApi; name: string; own: string; quiet: boolean }) {
  const ask = useCallback((username: string) => account.usernameFree(username), [account]);
  const free = useFreeCheck(name, ask, own);
  const said = free === null || quiet ? null : say(FREE_WORDS[free]);
  return (
    <p id={id} role="status" className={`text-sm font-bold ${free === "free" ? "text-action" : "text-text"}`} data-rename-check={free ?? ""}>
      {said}
    </p>
  );
}

/** account:username-and-unconfirmed-email: the username, and its change: the first free, then one after each wait the server sets. */
function Username({ account }: { account: AccountApi }) {
  const me = useAccountView();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const checkId = useId();
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
            <input
              className="min-h-11 rounded-lg border border-sheet-line bg-sheet-2 px-3 text-base"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={20}
              value={name}
              aria-describedby={checkId}
              onChange={(event) => (setName(event.target.value), setProblem(null))}
            />
          </label>
          <RenameCheck id={checkId} account={account} name={name} own={me.username} quiet={problem !== null} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={busy}>
              {say("ui.account.name.change.go")}
            </Button>
            <Button disabled={busy} onClick={() => setEditing(false)}>
              {say("ui.account.name.change.cancel")}
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

/** The step a deletion stands at: Delete my account, the warning with its two choices, or the confirmation a stale session needs. */
export type DeleteStep = "idle" | "warn" | "confirm";

/**
 * account:player-deletes-account, world:costly-acts-confirmed: deleting the account. The warning's main button keeps the account and comes first; Delete for
 * good wears the warning colour, apart from it. A session older than the server allows is confirmed with one of the
 * account's own passkeys, the emailed code, or Google where Google is linked, whose trip comes back to this warning
 * (`opened`, from the world, with `onKept` to close it).
 */
export function DeleteAccount({ account, opened = "idle", onKept = null }: { account: AccountApi; opened?: DeleteStep; onKept?: (() => void) | null }) {
  const leave = useGame((state) => state.leave);
  const me = useAccountView();
  const ways = me === null ? NO_WAYS : waysOf(me);
  const works = usePasskeysWork(account);
  const [step, setStep] = useState<DeleteStep>(opened);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const keep = () => {
    setStep("idle");
    onKept?.();
  };

  async function run(action: () => Promise<AuthResult>, after: (result: AuthResult) => void | Promise<void>) {
    setBusy(true);
    setProblem(null);
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

  /** account:player-deletes-account: only one of this account's own passkeys confirms; a cancel says nothing. */
  const confirmWithPasskey = () =>
    run(
      () => account.confirmWithPasskey(),
      (result) => {
        if (result.ok) return remove();
        if (result.why !== "cancelled") setProblem(failureWords(result));
      },
    );

  /** The trip leaves marked with this account, so only it coming back reopens the warning. */
  const google = () =>
    run(
      () => {
        if (me !== null) markDeleteTrip(me.id);
        return account.signInWithGoogle(null, "delete");
      },
      (result) => setProblem(failureWords(result)),
    );

  return (
    <>
      {/* Each step of leaving settles in where the last stood (world:motions-under-half-second). */}
      <div key={step} className={`flex flex-col gap-3 border-t border-sheet-line pt-4 ${step === "idle" ? "" : "motion-reveal"}`} data-delete-step={step}>
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
            <div>
              <Button variant="primary" disabled={busy} onClick={keep}>
                {say("ui.account.delete.keep")}
              </Button>
            </div>
            <div className="mt-2 border-t border-sheet-line pt-4">
              <Button variant="warning" disabled={busy} onClick={() => void remove()}>
                {say("ui.account.delete.confirm")}
              </Button>
            </div>
          </>
        ) : null}
        {step === "confirm" ? (
          <>
            <p>{say("ui.account.delete.fresh")}</p>
            {ways.passkeys > 0 && works === true ? (
              <div>
                <Button disabled={busy} onClick={() => void confirmWithPasskey()}>
                  {say("ui.account.passkey")}
                </Button>
              </div>
            ) : null}
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
            {ways.google === null ? null : (
              <>
                <GoogleButton label={say("ui.account.google")} disabled={busy} onClick={() => void google()} />
                <p className="text-sm text-text-2">{say("ui.account.delete.google")}</p>
              </>
            )}
            <div>
              <Button variant="primary" disabled={busy} onClick={keep}>
                {say("ui.account.delete.keep")}
              </Button>
            </div>
          </>
        ) : null}
      </div>
      {problem === null ? null : (
        <p role="alert" className="text-bad">
          {problem}
        </p>
      )}
    </>
  );
}

/** account:sign-out-ends-the-session: signing out of every phone asks first. */
type Leaving = "no" | "guest" | "everywhere";

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

/** The ways in of a kept life (account:guest-reminded-to-secure): the way it is kept with its address; the passkeys held follow. */
function WaysIn({ view }: { view: AccountView }) {
  if (view.state === "guest") return null;
  return (
    <div className="flex flex-col gap-1" data-ways>
      <p>{keptLine(view, true)}</p>
    </div>
  );
}

export function AccountSettings({ account, more = null }: { account: AccountApi; more?: ReactNode }) {
  const leave = useGame((state) => state.leave);
  const me = useAccountView();
  const guest = me?.state === "guest";
  const ways = me === null ? NO_WAYS : waysOf(me);
  const [leaving, setLeaving] = useState<Leaving>("no");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

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

  /** account:sign-out-ends-the-session: the player leaves only once the server has ended the session; otherwise the sheet says so and stays. */
  const signOut = (everywhere: boolean) =>
    run(
      () => (everywhere ? account.signOutEverywhere() : account.signOut()),
      (result) => {
        if (result.ok) leave("ui.account.notice.signed-out");
        else setProblem(failureWords(result));
      },
    );

  return (
    <div className="flex flex-col gap-6">
      <GuestReminder />
      <Username account={account} />
      <LifeName />
      {me === null ? null : <WaysIn view={me} />}
      {guest ? null : <PasskeyList account={account} ways={ways} known={me !== null} />}
      <div className="flex flex-col gap-2">
        {/* account:guest-and-secured-states: a guest's session is its only way back, so signing out of it is said plainly first. */}
        {guest && leaving === "no" ? (
          <div>
            <Button disabled={busy} onClick={() => setLeaving("guest")}>
              {say("ui.account.sign-out")}
            </Button>
          </div>
        ) : null}
        {/* world:costly-acts-confirmed: leaving a guest life throws it away, so Keep playing is the main button and leaving wears the warning colour apart. */}
        {guest && leaving === "guest" ? (
          <>
            <p role="alert">{say("ui.guest.sign-out")}</p>
            <div>
              <Button variant="primary" disabled={busy} onClick={() => setLeaving("no")}>
                {say("ui.guest.sign-out.keep")}
              </Button>
            </div>
            <div className="mt-1 border-t border-sheet-line pt-3">
              <Button variant="warning" disabled={busy} onClick={() => void signOut(false)}>
                {say("ui.guest.sign-out.go")}
              </Button>
            </div>
          </>
        ) : null}
        {!guest && leaving === "no" ? (
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void signOut(false)}>
              {say("ui.account.sign-out")}
            </Button>
            <Button variant="quiet" disabled={busy} onClick={() => setLeaving("everywhere")}>
              {say("ui.account.sign-out.all")}
            </Button>
          </div>
        ) : null}
        {!guest && leaving === "everywhere" ? (
          <div className="motion-reveal flex flex-col gap-2" role="group">
            <p>{say("ui.account.sign-out.all.warn")}</p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void signOut(true)}>
                {say("ui.account.sign-out.all.go")}
              </Button>
              <Button disabled={busy} onClick={() => setLeaving("no")}>
                {say("ui.account.sign-out.all.keep")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <UsageCounts account={account} />

      {more}

      <DeleteAccount account={account} />

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
