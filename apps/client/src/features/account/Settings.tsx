// The account settings, in three blocks and a quiet foot: you (the username and its change, account:username-and-unconfirmed-email;
// the life's name; the way in, account:guest-reminded-to-secure), the passkeys once the life is saved (PasskeyList,
// account:passkeys-listed-and-removed), and leaving: a saved life signs out here or on every phone
// (account:sign-out-ends-the-session) or deletes the account (account:player-deletes-account) through the server's
// `DELETE /api/account`; a guest, whose session is its only way back, has "Delete my account" as its one costly row in place
// of both, its step saying first that the life on this phone ends. The foot holds the usage counts, any setting the shell
// places in the sheet and the legal links. A guest's sheet opens with the reminder and the way to save the life
// (account:guest-reminded-to-secure).
//
// One step at a time (steps.tsx): the username's change and deleting the account, a guest's or a saved life's, each take the body as
// their own view with one Back; signing out on every phone and removing a passkey ask in place, where the tap was.
//
// Deleting needs a session signed in within the last 10 minutes; when the server says it is older, the player shows it is
// them by one way first, a passkey where the account holds one, else a code to the account's email, with the others as
// quiet links. A guest has no other way in, so its own session confirms it. The account opens from its own row at the head
// of the phone's Settings (AccountButton.tsx). This file is the sheet: it and its words (content's ui/ui.accountSheet.text.ts)
// ride a chunk of their own, fetched by the row (engine:first-download-has-budget).
import type { AccountView } from "@japacity/api";
import { Check } from "lucide-react";
import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from "react";

import { useGame } from "../../authority/GameProvider";
import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { GoogleButton } from "../../shared/ui/GoogleButton";
import { say } from "../../shared/words/text";
import { setUsageCounts } from "../../shared/analytics/start";
import { browserStorage, DELETE_TRIP_KEY } from "../../shared/storage/storage";
import { Sheet } from "../../shared/ui/Sheet";
import { keptLine, NO_WAYS, useLifeName, waysOf } from "./AccountButton";
import { CodeForm, failureWords } from "./CodeForm";
import { FREE_WORDS, useFreeCheck } from "./GuestStart";
import { LegalLinks } from "../../shared/ui/LegalLinks";
import { PasskeyList, usePasskeysWork } from "./PasskeyList";
import { GuestReminder, SecureSheet } from "./Secure";
import { refreshAccount, useAccountView, useGuest } from "./standing";
import { FocusLine, StepsProvider, StepView, useShownWhole, useSteps } from "./steps";

// The card that offers a passkey after a way in rides this chunk, which holds the passkey code it shares (WayToast.tsx).
export { PasskeyCard } from "./PasskeyCard";

/**
 * analytics:player-can-stop-usage-counts: "Send usage counts", stored on the account and on by
 * default. Off stops the interface counters at once; the server's own game
 * counters go on, as the rule says. What they are folds behind a quiet "What is this?".
 */
export function UsageCounts({ account }: { account: AccountApi }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [told, setTold] = useState(false);
  const helpId = useId();

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
    <div className="flex flex-col gap-1" data-usage-counts>
      <div className="flex flex-wrap items-center gap-x-3">
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="size-5 accent-ink" checked={on ?? true} disabled={on === null || busy} onChange={(event) => void change(event.target.checked)} />
          {say("ui.account.usage")}
        </label>
        <Button variant="quiet" small aria-expanded={told} aria-controls={helpId} onClick={() => setTold(!told)}>
          {say("ui.account.usage.what")}
        </Button>
      </div>
      <p id={helpId} hidden={!told} className="text-sm text-text-2" data-usage-help>
        {say("ui.account.usage.help")}
      </p>
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
    <div className="flex min-w-0 flex-col gap-0.5">
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
    <p id={id} role="status" className={`text-sm font-bold ${free === "free" ? "text-in" : "text-text"}`} data-rename-check={free ?? ""}>
      {free === "free" && said !== null ? <Check size={14} strokeWidth={3} className="mr-1 inline-block align-[-2px]" aria-hidden /> : null}
      {said}
    </p>
  );
}

/**
 * account:username-and-unconfirmed-email: the username as a labelled row, with "Change it" as a quiet link while a change is
 * open, else the day the next one opens; and the line a saved change leaves.
 */
function UsernameRow({ onChange, changed }: { onChange: () => void; changed: string | null }) {
  const me = useAccountView();
  if (me === null) return null;
  const waiting = me.renameFrom > Date.now();
  return (
    <div className="flex flex-col gap-1" data-username>
      <div className="flex items-end justify-between gap-3">
        <Row label={say("ui.account.name.label")}>{say("ui.account.name.current", { name: me.username })}</Row>
        {waiting ? null : (
          <Button variant="quiet" small className="shrink-0" onClick={onChange} data-step-opener="rename">
            {say("ui.account.name.change")}
          </Button>
        )}
      </div>
      {waiting ? <p className="text-sm text-text-2">{say("ui.account.name.wait", { date: dayOf(me.renameFrom) })}</p> : null}
      {changed === null ? null : <p role="status">{changed}</p>}
    </div>
  );
}

/**
 * account:username-and-unconfirmed-email: the change's own step: the box, its one line (whether the name is free, or the
 * refusal once saving says no), "Your first change is free" while it is, and Save. A refusal goes with the step.
 */
function RenameStep({ account, onSaved }: { account: AccountApi; onSaved: (name: string) => void }) {
  const me = useAccountView();
  const [name, setName] = useState(me?.username ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const checkId = useId();
  if (me === null) return null;

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
    onSaved(name.trim());
    void refreshAccount(account);
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => void save(event)} noValidate data-rename>
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
      {problem === null ? null : (
        <p role="alert" className="-mt-2 text-sm font-bold text-bad">
          {problem}
        </p>
      )}
      {me.renameFrom === 0 ? <p className="text-sm text-text-2">{say("ui.account.name.free")}</p> : null}
      <div>
        <Button type="submit" variant="primary" disabled={busy}>
          {say("ui.account.name.change.go")}
        </Button>
      </div>
    </form>
  );
}

/** A day as the player reads it, in their own calendar. */
function dayOf(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

/** account:player-deletes-account: marks, in the tab's storage, the account a trip to Google to confirm a deletion leaves from (read in marks.ts). */
function markDeleteTrip(account: string): void {
  try {
    browserStorage("session")?.setItem(DELETE_TRIP_KEY, account);
  } catch {
    // A tab that keeps nothing comes back to the world, and Delete my account is where it was.
  }
}

/** account:player-deletes-account: the delete confirmation opened again over the world after a sign-in with Google to confirm it. */
export function DeleteAgain({ account, onClose }: { account: AccountApi; onClose: () => void }) {
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())} title={say("ui.account.delete")}>
      <DeleteAccount account={account} onKept={onClose} />
    </Sheet>
  );
}

/** The ways a deletion is confirmed by when the session is older than the server allows. */
type Way = "passkey" | "code" | "google";

/**
 * account:player-deletes-account, world:costly-acts-confirmed: deleting the account. The warning's main button keeps the account and comes first; Delete for
 * good wears the warning colour, apart from it. A session older than the server allows is confirmed by one way shown first:
 * one of the account's own passkeys where it holds one and they work here, else the emailed code, else Google where Google is
 * linked, whose trip comes back to this warning (DeleteAgain). The others are quiet links, and Google's line shows only once
 * Google is picked. The button that deletes, by passkey or by code, wears the warning colour too.
 */
export function DeleteAccount({ account, onKept }: { account: AccountApi; onKept: () => void }) {
  const leave = useGame((state) => state.leave);
  const me = useAccountView();
  const ways = me === null ? NO_WAYS : waysOf(me);
  const works = usePasskeysWork(account);
  const [stage, setStage] = useState<"warn" | "confirm">("warn");
  const [picked, setPicked] = useState<Way | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const offered: Way[] = [...(ways.passkeys > 0 && works === true ? (["passkey"] as const) : []), ...(email === null ? [] : (["code"] as const)), ...(ways.google === null ? [] : (["google"] as const))];
  const way = picked !== null && offered.includes(picked) ? picked : (offered[0] ?? null);

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
          setStage("confirm");
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

  const keep = (
    <div>
      <Button variant="primary" disabled={busy} onClick={onKept}>
        {say("ui.account.delete.keep")}
      </Button>
    </div>
  );
  const said =
    problem === null ? null : (
      <p role="alert" className="text-bad">
        {problem}
      </p>
    );

  if (stage === "warn") {
    return (
      <div className="flex flex-col gap-3" data-delete-step="warn">
        <p>{say("ui.account.delete.warn")}</p>
        {keep}
        <div className="mt-2 border-t border-sheet-line pt-4">
          <Button variant="warning" disabled={busy} onClick={() => void remove()}>
            {say("ui.account.delete.confirm")}
          </Button>
        </div>
        {said}
      </div>
    );
  }

  // Each way settles in where the last stood (world:motions-under-half-second).
  return (
    <div className="flex flex-col gap-3" data-delete-step="confirm">
      <FocusLine>{say("ui.account.delete.fresh")}</FocusLine>
      {keep}
      <div key={way ?? ""} className="motion-reveal mt-2 flex flex-col gap-3 border-t border-sheet-line pt-4" data-delete-way={way ?? ""}>
        {way === "passkey" ? (
          <div>
            <Button variant="warning" disabled={busy} onClick={() => void confirmWithPasskey()}>
              {say("ui.account.delete.passkey")}
            </Button>
          </div>
        ) : null}
        {way === "code" && email !== null ? (
          <CodeForm
            account={account}
            email={email}
            sendLabel={say("ui.account.delete.code", { email })}
            confirm={(code) => account.deleteAccount(code)}
            goLabel={say("ui.account.delete.code.go")}
            goVariant="warning"
            onSignedIn={gone}
          />
        ) : null}
        {way === "google" ? (
          <>
            <GoogleButton label={say("ui.account.google")} disabled={busy} onClick={() => void google()} />
            <p className="text-sm text-text-2">{say("ui.account.delete.google")}</p>
          </>
        ) : null}
        {said}
      </div>
      {offered.length > 1 ? (
        <div className="flex flex-col items-start gap-1" data-delete-others>
          {offered
            .filter((other) => other !== way)
            .map((other) => (
              <Button
                key={other}
                variant="quiet"
                small
                disabled={busy}
                onClick={() => {
                  setPicked(other);
                  setProblem(null);
                }}
              >
                {say(`ui.account.delete.use.${other}`)}
              </Button>
            ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * account:player-deletes-account, account:sign-out-ends-the-session, world:costly-acts-confirmed: a guest's one costly row.
 * A guest's life lives only in its session, so signing out and deleting end it alike: the step says that the life on this
 * phone ends, offers to save it first as its main button, and Delete for good, in the warning colour apart, deletes the guest
 * as a saved life's deletion does, confirmed by its own session.
 */
function DeleteGuest({ account, onStay }: { account: AccountApi; onStay: () => void }) {
  const leave = useGame((state) => state.leave);
  const guest = useGuest();
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setProblem(null);
    const result = await account.deleteAccount(null);
    setBusy(false);
    if (result.ok) return leave("ui.account.notice.deleted");
    setProblem(failureWords(result));
  }

  return (
    <div className="flex flex-col gap-3" data-delete-guest>
      <p>{say("ui.account.delete.guest")}</p>
      <div>
        <Button variant="primary" disabled={busy} onClick={() => setSaving(true)}>
          {say("ui.account.delete.save")}
        </Button>
      </div>
      <div className="mt-2 border-t border-sheet-line pt-4">
        <Button variant="warning" disabled={busy} onClick={() => void go()}>
          {say("ui.account.delete.confirm")}
        </Button>
      </div>
      {problem === null ? null : (
        <p role="alert" className="text-bad">
          {problem}
        </p>
      )}
      <SecureSheet
        account={account}
        open={saving}
        onOpenChange={(next) => {
          setSaving(next);
          // Saved, the life is no guest's any more: back to its sheet, which shows it saved.
          if (!next && !guest) onStay();
        }}
        reason={null}
      />
    </div>
  );
}

/** account:sign-out-ends-the-session: the player leaves only once the server has ended the session; signing out of every phone asks first, in place. */
function SignOutRows({ account }: { account: AccountApi }) {
  const leave = useGame((state) => state.leave);
  const [open, show] = useSteps();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const asking = open === "everywhere";

  async function signOut(everywhere: boolean) {
    setBusy(true);
    setProblem(null);
    const result = await (everywhere ? account.signOutEverywhere() : account.signOut());
    setBusy(false);
    if (result.ok) leave("ui.account.notice.signed-out");
    else setProblem(failureWords(result));
  }

  const ask = (next: string | null) => {
    setProblem(null);
    show(next);
  };

  return (
    <div className="flex flex-col gap-2" data-sign-out>
      {asking ? (
        <EverywhereAsk busy={busy} onGo={() => void signOut(true)} onStay={() => ask(null)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void signOut(false)}>
            {say("ui.account.sign-out")}
          </Button>
          <Button variant="quiet" disabled={busy} onClick={() => ask("everywhere")} data-step-opener="everywhere">
            {say("ui.account.sign-out.all")}
          </Button>
        </div>
      )}
      {problem === null ? null : (
        <p role="alert" className="text-bad">
          {problem}
        </p>
      )}
    </div>
  );
}

/** account:sign-out-ends-the-session: the question before every phone is signed out, where the two buttons stood, brought whole into view. */
function EverywhereAsk({ busy, onGo, onStay }: { busy: boolean; onGo: () => void; onStay: () => void }) {
  const group = useShownWhole<HTMLDivElement>();
  return (
    <div ref={group} className="motion-reveal flex flex-col gap-2" role="group" data-everywhere-ask>
      <FocusLine>{say("ui.account.sign-out.all.warn")}</FocusLine>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={onGo}>
          {say("ui.account.sign-out.all.go")}
        </Button>
        <Button disabled={busy} onClick={onStay}>
          {say("ui.account.sign-out.all.keep")}
        </Button>
      </div>
    </div>
  );
}

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

/** The ways in of a saved life (account:guest-reminded-to-secure): the way it is saved with its address; the passkeys held follow. */
function WaysIn({ view }: { view: AccountView }) {
  if (view.state === "guest") return null;
  return (
    <div className="flex flex-col gap-1" data-ways>
      <p>{keptLine(view, true)}</p>
    </div>
  );
}

/** One of the sheet's blocks, a line apart from the one before. */
function Block({ mark, children }: { mark: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-sheet-line pt-5 first:border-t-0 first:pt-0" data-block={mark}>
      {children}
    </section>
  );
}

export function AccountSettings({ account, more = null }: { account: AccountApi; more?: ReactNode }) {
  return (
    <StepsProvider>
      <AccountBody account={account} more={more} />
    </StepsProvider>
  );
}

function AccountBody({ account, more }: { account: AccountApi; more: ReactNode }) {
  const me = useAccountView();
  const guest = me?.state === "guest";
  const ways = me === null ? NO_WAYS : waysOf(me);
  const [open, show] = useSteps();
  const [changed, setChanged] = useState<string | null>(null);
  const back = () => show(null);

  if (open === "rename") {
    return (
      <StepView title={say("ui.account.name.step")} onBack={back} mark="rename">
        <RenameStep
          account={account}
          onSaved={(name) => {
            setChanged(say("ui.account.name.changed", { name }));
            back();
          }}
        />
      </StepView>
    );
  }
  if (open === "delete") {
    return (
      <StepView title={say("ui.account.delete")} onBack={back} mark="delete">
        <DeleteAccount account={account} onKept={back} />
      </StepView>
    );
  }
  // Its own step, so a guest that saves its life from inside it sees the save sheet through rather than a saved life's deletion.
  if (open === "delete-guest") {
    return (
      <StepView title={say("ui.account.delete")} onBack={back} mark="delete-guest">
        <DeleteGuest account={account} onStay={back} />
      </StepView>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <GuestReminder />
      <Block mark="you">
        <UsernameRow
          changed={changed}
          onChange={() => {
            setChanged(null);
            show("rename");
          }}
        />
        <LifeName />
        {me === null ? null : <WaysIn view={me} />}
      </Block>
      {guest ? null : (
        <Block mark="passkeys">
          <PasskeyList account={account} ways={ways} />
        </Block>
      )}
      <Block mark="leaving">
        {/* account:guest-and-secured-states: a guest's session is its only way back, so its one way out is deleting the life. */}
        {guest ? (
          <div>
            <Button variant="quiet" onClick={() => show("delete-guest")} data-step-opener="delete-guest">
              {say("ui.account.delete")}
            </Button>
          </div>
        ) : (
          <>
            <SignOutRows account={account} />
            <div>
              <Button variant="quiet" onClick={() => show("delete")} data-step-opener="delete">
                {say("ui.account.delete")}
              </Button>
            </div>
          </>
        )}
      </Block>
      <footer className="flex flex-col gap-3 border-t border-sheet-line pt-4 text-sm" data-quiet-foot>
        <UsageCounts account={account} />
        {more}
        <LegalLinks />
      </footer>
    </div>
  );
}
