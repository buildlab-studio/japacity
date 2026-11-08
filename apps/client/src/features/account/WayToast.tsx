// The one short line a way in leaves over the world (account:guest-secures-the-life): "Saved with
// Google" once a guest's life is saved, "Signed in with your email" once a kept life is signed back in to. The sign-in
// sheet closes as the life opens, so its welcome is handed here and told once the world is up; the keeping sheet hands
// its line here as it closes. One store for each account seam, as standing.ts keeps the account. The line is read out
// through one polite live region, mounted with the world before any line comes; the toast itself is for the eye. The
// region is polite by its `status` role alone: an `aria-live` attribute would keep it out of what an open sheet hides,
// so the sheet's hiding would reach down past the shell to each part of the world, the band among them. Once a kept life
// signed back in to by Google or the code has said its line, the card that offers a passkey follows it
// (account:passkey-offered-where-it-works), fetched then with the account sheet's code and words, so a first visit carries none of
// it (engine:first-download-has-budget); a life just kept is offered its passkey in the Kept sheet, so no card follows that line.
// A new life kept from the start hands its way here before the world is up: the Kept sheet is due over the world (Secure.tsx),
// and its line is told as that sheet closes.
import { ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

import type { AccountApi } from "../../shared/net/auth";
import { say } from "../../shared/words/text";
import { SAID_TOAST_MS } from "../../shared/world/SaidToast";
import { loadAccountSheet, type AccountSheet } from "./AccountButton";

/**
 * What was done and by which way: each names its line in the words (`ui.account.toast.<way>`). `taken.email`: a new life whose
 * proved address an account took meanwhile started as a guest (account:guest-secures-the-life). `start.email` and `start.google`:
 * a new life kept from the start, whose Kept sheet is due over the world and tells `kept.<way>` as it closes.
 */
export type Way = "kept.google" | "kept.email" | "in.google" | "in.email" | "in.passkey" | "taken.email" | "start.email" | "start.google";

/** The way a life was kept with: the Kept sheet's, and the one a new life kept from the start hands to the world. */
export type KeptWay = "google" | "email";

/** The lines no passkey's card follows: a passkey's own way in, a life that is still a guest's, and a life just kept, whose Kept sheet offered it. */
const NO_CARD: ReadonlySet<Way> = new Set(["in.passkey", "taken.email", "kept.google", "kept.email"]);

interface Held {
  told: { way: Way; at: number } | null;
  /** A line told and gone that a passkey's card may follow: a kept life's way back in. */
  after: boolean;
  /** A new life kept from the start: its Kept sheet waits to open over the world. */
  due: KeptWay | null;
}

const stores = new WeakMap<AccountApi, StoreApi<Held>>();
/** The key the hook reads with no account, so it is called the same way offline. */
const NO_ACCOUNT = {} as AccountApi;

function storeOf(account: AccountApi): StoreApi<Held> {
  const kept = stores.get(account);
  if (kept !== undefined) return kept;
  const made = createStore<Held>(() => ({ told: null, after: false, due: null }));
  stores.set(account, made);
  return made;
}

/** Hands the line to the world, to be told once it is up; a new life kept from the start hands its Kept sheet instead. */
export function tellWay(account: AccountApi, way: Way): void {
  if (way === "start.email" || way === "start.google") storeOf(account).setState({ due: way === "start.email" ? "email" : "google" });
  else storeOf(account).setState({ told: { way, at: Date.now() } });
}

/** The Kept sheet a new life kept from the start has due over the world, or null (account:guest-secures-the-life). */
export function useKeptDue(account: AccountApi | null): KeptWay | null {
  const due = useStore(storeOf(account ?? NO_ACCOUNT), (held) => held.due);
  return account === null ? null : due;
}

/** The due Kept sheet is opening: it is due no more. */
export function keptOpened(account: AccountApi): void {
  storeOf(account).setState({ due: null });
}

type Card = AccountSheet["PasskeyCard"];

/** The card rides the account sheet's chunk with its words, fetched once a line it may follow has been told. */
const loadCard = (): Promise<Card> => loadAccountSheet().then((sheet) => sheet.PasskeyCard);

/** The line, under the top of the screen for a few seconds and gone; under any sheet that is open, never over it. */
export function WayToast({ account }: { account: AccountApi }) {
  const store = storeOf(account);
  const told = useStore(store, (held) => held.told);
  const shown = useRef(store);
  shown.current = store;
  const after = useStore(store, (held) => held.after);
  const [Card, setCard] = useState<{ Card: Card } | null>(null);
  useEffect(() => {
    if (told === null) return;
    const timer = window.setTimeout(() => shown.current.setState({ told: null, after: !NO_CARD.has(told.way) }), SAID_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [told]);
  useEffect(() => {
    if (!after || Card !== null) return;
    let live = true;
    loadCard().then(
      (loaded) => {
        if (live) setCard({ Card: loaded });
      },
      // A card that cannot be fetched is simply not offered.
      () => shown.current.setState({ after: false }),
    );
    return () => {
      live = false;
    };
  }, [after, Card]);
  return (
    <>
      <p role="status" className="sr-only" data-way-said>
        {told === null ? "" : say(`ui.account.toast.${told.way}`)}
      </p>
      {told === null ? null : (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center px-4 pt-[calc(max(10px,env(safe-area-inset-top))+64px)]" aria-hidden>
          <p key={told.at} className="brief-toast slide-in flex items-center gap-2 px-4 py-2.5 text-[16px] leading-snug font-bold" data-way-toast={told.way}>
            {told.way === "taken.email" ? null : <ShieldCheck size={20} aria-hidden className="shrink-0" />}
            {say(`ui.account.toast.${told.way}`)}
          </p>
        </div>
      )}
      {after && Card !== null ? <Card.Card account={account} onDone={() => shown.current.setState({ after: false })} /> : null}
    </>
  );
}
