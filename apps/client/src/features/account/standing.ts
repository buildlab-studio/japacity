// The account as the server last said it (`GET /api/account`), shared by the
// screens that change with it: whether the life is a guest's (account:guest-and-secured-states),
// the username (account:username-and-unconfirmed-email). One store for each account seam, read again
// whenever something changes it.
import type { AccountView } from "@japacity/api";
import { useEffect } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

import { useGame } from "../../authority/GameProvider";
import type { AccountApi } from "../../shared/net/auth";

interface Held {
  view: AccountView | null;
  asked: boolean;
}

const stores = new WeakMap<AccountApi, StoreApi<Held>>();
const none = createStore<Held>(() => ({ view: null, asked: true }));

function storeOf(account: AccountApi | null): StoreApi<Held> {
  if (account === null) return none;
  const kept = stores.get(account);
  if (kept !== undefined) return kept;
  const made = createStore<Held>(() => ({ view: null, asked: false }));
  stores.set(account, made);
  return made;
}

/** Reads the account again and tells every screen that shows it. */
export async function refreshAccount(account: AccountApi): Promise<AccountView | null> {
  const store = storeOf(account);
  store.setState({ asked: true });
  const view = await account.view();
  store.setState({ view });
  return view;
}

/** The account, read once when first needed; null while unknown and offline. */
export function useAccountView(): AccountView | null {
  const account = useGame((state) => state.account);
  const store = storeOf(account);
  const view = useStore(store, (held) => held.view);
  const asked = useStore(store, (held) => held.asked);
  useEffect(() => {
    if (account !== null && !asked) void refreshAccount(account);
  }, [account, asked]);
  return view;
}

/** account:guest-and-secured-states: true while the life is a guest's. */
export function useGuest(): boolean {
  return useAccountView()?.state === "guest";
}
