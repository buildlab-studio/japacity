// The kept life says so, and how it is kept (account:guest-secures-the-life, account:username-and-unconfirmed-email, account:guest-reminded-to-secure): the keeping sheet's kept
// state after the trip to Google, the short line over the world naming the way, the account's row at the head of the
// phone's Settings, and its sheet's rows for each shape of the ways back in.
import type { AccountView } from "@japacity/api";
import type { PlayerView } from "@japacity/sim";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import { pageOf } from "../../shared/datapage/PageSheet";
import { keepPerson } from "../../shared/front-door/person";
import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { engineView } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { failureWords } from "./CodeForm";
import { SecureAsk, SecureSheet } from "./Secure";
import { AccountButton, AccountSettings } from "./Settings";
import { WayToast } from "./WayToast";

const OK: AuthResult = { ok: true };
const PLAIN_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

type Ways = AccountView["ways"];
const NONE: Ways = { google: null, email: null, passkeys: 0 };

let made = 0;

function me(state: AccountView["state"], ways: Ways = state === "guest" ? NONE : { google: null, email: "ada@example.com", passkeys: 0 }): AccountView {
  made += 1;
  return { id: `account-ways-${String(made)}`, country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: "c-1", sendUsageCounts: true, admin: false, state, username: "ada_lagos", renameFrom: 0, ways };
}

function fakeAccount(view: AccountView, over: Partial<AccountApi> = {}): AccountApi & { calls: string[]; hold: (next: AccountView) => void } {
  const calls: string[] = [];
  let held = view;
  return {
    calls,
    hold: (next) => {
      held = next;
    },
    ageStatus: () => Promise.resolve("passed"),
    declareAge: () => Promise.resolve("passed"),
    startGuest: () => Promise.resolve({ ok: true }),
    view: () => (calls.push("view()"), Promise.resolve(held)),
    rename: () => Promise.resolve({ ok: true }),
    sendCode: () => Promise.resolve(OK),
    signInWithCode: () => ((held = { ...held, state: "secured", ways: { google: null, email: "ada@example.com", passkeys: 0 } }), Promise.resolve(OK)),
    signInWithGoogle: (_bot, trip) => (calls.push(`signInWithGoogle(${String(trip)})`), Promise.resolve(OK)),
    returnedFromGoogle: () => null,
    signInWithPasskey: () => Promise.resolve(OK),
    addPasskey: () => (calls.push("addPasskey()"), Promise.resolve(OK)),
    email: () => Promise.resolve(null),
    usageCounts: () => Promise.resolve(null),
    setUsageCounts: () => Promise.resolve(true),
    deleteAccount: () => Promise.resolve(OK),
    signOut: () => Promise.resolve(OK),
    signOutEverywhere: () => Promise.resolve(OK),
    passkeysWork: () => Promise.resolve(true),
    passkeys: () => Promise.resolve([]),
    removePasskey: () => Promise.resolve({ ok: true, signedIn: true }),
    confirmWithPasskey: () => Promise.resolve(OK),
    ...over,
  };
}

async function mount(account: AccountApi, ui: React.ReactElement, view: PlayerView = engineView()): Promise<void> {
  const store = createGameStore({ view: () => Promise.resolve(view), send: () => Promise.reject(new Error("unused")) }, { account });
  await store.getState().refresh();
  store.setState({ earlyWin: false, moments: [], reportOpen: false });
  render(<GameProvider store={store}>{ui}</GameProvider>);
}

const toast = () => document.querySelector<HTMLElement>("[data-way-toast]");

afterEach(() => {
  localStorage.clear();
});

describe("the kept life says so (account:guest-secures-the-life)", () => {
  test("[account:guest-secures-the-life] given the trip to Google came back having kept the guest's life, then the keeping sheet opens in its kept state, the account is read again, and as it closes the world says Kept with Google", async () => {
    const account = fakeAccount(me("secured", { google: "ada@example.com", email: "ada@example.com", passkeys: 0 }), { returnedFromGoogle: () => "kept" });
    await mount(account, <SecureAsk />);
    const sheet = await screen.findByRole("dialog", { name: say("ui.secure.done.title") });
    expect(within(sheet).getByText(say("ui.secure.done"))).toBeDefined();
    expect(within(sheet).queryByRole("button", { name: say("ui.secure.google") })).toBeNull();
    expect(within(sheet).queryByRole("button", { name: say("ui.secure.later") })).toBeNull();
    expect(account.calls).toContain("view()");
    expect(toast()).toBeNull();
    fireEvent.click(within(sheet).getByRole("button", { name: say("ui.report.close") }));
    await waitFor(() => expect(toast()?.textContent).toBe(say("ui.account.toast.kept.google")));
    expect(say("ui.account.toast.kept.google")).toBe("Kept with Google");
  });

  test("[account:guest-secures-the-life] given the trip to Google came back signed in to a kept life, then nothing opens and the world says Signed in with Google", async () => {
    const account = fakeAccount(me("secured"), { returnedFromGoogle: () => "signed-in" });
    await mount(account, <SecureAsk />);
    await waitFor(() => expect(toast()?.textContent).toBe(say("ui.account.toast.in.google")));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("[account:guest-secures-the-life] given a guest keeping the life, when Google is tapped, then the trip leaves marked as keeping; and an emailed code that keeps it says Kept with your email as the sheet closes", async () => {
    const account = fakeAccount(me("guest"));
    function Held() {
      return (
        <>
          <SecureSheet account={account} open onOpenChange={() => undefined} reason={null} agent={PLAIN_CHROME} />
          <WayToast account={account} />
        </>
      );
    }
    await mount(account, <Held />);
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.google") }));
    await waitFor(() => expect(account.calls).toContain("signInWithGoogle(keep)"));
    fireEvent.change(screen.getByLabelText(say("ui.account.email.label")), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.code.send") }));
    fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.code.go") }));
    expect(await screen.findByText(say("ui.secure.done"))).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.report.close") }));
    await waitFor(() => expect(toast()?.textContent).toBe(say("ui.account.toast.kept.email")));
  });

  test("[account:guest-secures-the-life] given Google on an address whose life was kept by a code, which the library would not join, then the player is pointed to the code in the game's words, never the library's", () => {
    const words = failureWords({ ok: false, why: "not-linked" }) ?? "";
    expect(words).toContain("code");
    expect(words).not.toMatch(/account_not_linked|linked|account/i);
  });
});

describe("Settings names the ways in (account:guest-reminded-to-secure, account:username-and-unconfirmed-email)", () => {
  test("[account:guest-reminded-to-secure] given each shape of the ways back in, then the account's sheet says it plainly: Google by its address, the email by its address, the passkeys held; a guest the reminder and no ways", async () => {
    const shapes: [AccountView, string[], string[]][] = [
      [me("guest"), [say("ui.guest.reminder")], [say("ui.account.passkeys.zero")]],
      [me("secured", { google: null, email: "ada@example.com", passkeys: 0 }), ["Kept with your email as ada@example.com", "Passkey: none yet"], ["Kept with Google as ada@example.com", say("ui.guest.reminder")]],
      [me("secured", { google: "ada.g@example.com", email: "ada.g@example.com", passkeys: 1 }), ["Kept with Google as ada.g@example.com", "1 passkey"], ["Kept with your email as ada.g@example.com", "Passkey: none yet"]],
      [me("secured", { google: "ada.g@example.com", email: "ada.g@example.com", passkeys: 2 }), ["Kept with Google as ada.g@example.com", "2 passkeys"], []],
    ];
    for (const [view, shown, hidden] of shapes) {
      const account = fakeAccount(view);
      await mount(account, <AccountSettings account={account} />);
      for (const line of shown) expect(await screen.findByText(line)).toBeDefined();
      for (const line of hidden) expect(screen.queryByText(line)).toBeNull();
      // A code to that address simply works, so nothing says it does.
      expect(screen.queryByText(/also opens/)).toBeNull();
      cleanup();
    }
  });

  test("[account:username-and-unconfirmed-email] given a life with a name, then the account's sheet shows the username and the name as two labelled rows", async () => {
    keepPerson({ look: "person_ada", name: "Adaeze", archetype: null });
    const view = engineView();
    const name = pageOf(view).name;
    expect(name).not.toBe("");
    const account = fakeAccount(me("secured"));
    await mount(account, <AccountSettings account={account} />, view);
    const username = (await screen.findByText("@ada_lagos")).closest("[data-username]");
    expect(username?.textContent).toContain(say("ui.account.name.label"));
    const person = document.querySelector("[data-life-name]");
    expect(person?.textContent).toBe(`${say("ui.account.person.label")}${name}`);
    expect(say("ui.account.person.label")).toBe("Name");
  });

  test("[account:passkey-needs-signed-in-session] [account:guest-reminded-to-secure] given a kept life, when a passkey is added, then the sheet says so and the passkeys held are read again", async () => {
    const account = fakeAccount(me("secured"));
    await mount(account, <AccountSettings account={account} />);
    expect(await screen.findByText("Passkey: none yet")).toBeDefined();
    account.hold(me("secured", { google: null, email: "ada@example.com", passkeys: 1 }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.passkey.add") }));
    expect(await screen.findByText(say("ui.account.passkey.added"))).toBeDefined();
    expect(await screen.findByText("1 passkey")).toBeDefined();
  });
});

describe("the account's row at the head of Settings", () => {
  test("[account:username-and-unconfirmed-email] [account:guest-reminded-to-secure] given a kept life, then the account is one button whose name holds the name, the username and the way it is kept, and a tap opens the account's sheet", async () => {
    keepPerson({ look: "person_ada", name: "Adaeze", archetype: null });
    const view = engineView();
    const name = pageOf(view).name;
    expect(name).toBe("Adaeze");
    const account = fakeAccount(me("secured", { google: "ada.g@example.com", email: "ada.g@example.com", passkeys: 0 }));
    await mount(account, <AccountButton />, view);
    const row = await screen.findByRole("button", { name: new RegExp(`${name}.*@ada_lagos.*Kept with Google as ada.g@example\\.com`) });
    expect(row.querySelector("[aria-hidden]")?.textContent).toBe(name.charAt(0).toUpperCase());
    fireEvent.click(row);
    const sheet = await screen.findByRole("dialog", { name: say("ui.account.settings") });
    expect(within(sheet).getByText("Kept with Google as ada.g@example.com")).toBeDefined();
  });

  test("[account:guest-reminded-to-secure] given a guest, then the row says the life is only on this phone until kept; a life kept by a code says Kept with your email", async () => {
    const guest = fakeAccount(me("guest"));
    await mount(guest, <AccountButton />);
    expect(await screen.findByRole("button", { name: /@ada_lagos.*Only on this phone until kept/ })).toBeDefined();
    cleanup();
    const kept = fakeAccount(me("secured"));
    await mount(kept, <AccountButton />);
    expect(await screen.findByRole("button", { name: /@ada_lagos.*Kept with your email$/ })).toBeDefined();
  });
});
